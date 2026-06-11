import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import https from "https";
import { parseStringPromise } from "xml2js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT        = process.env.PORT        || 3001;
const JWT_SECRET  = process.env.JWT_SECRET  || "degistir-beni-gizli-key";
const SERVICE_URL = process.env.SERVICE_URL || "http://planify.metu.edu.tr/";


const OIBS_HOST = "kultepe.cc.metu.edu.tr";
const OIBS_PATH = "/~webservice/OIBSStudentCardInfo/OIBSStudentCardInfo.php";
const OIBS_NS   = `https://${OIBS_HOST}${OIBS_PATH}`;

async function fetchOibsStudentInfo(idNumber, userCode) {
  // SOAP XML paketi hazırla
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:tns="${OIBS_NS}">
  <soapenv:Header/>
  <soapenv:Body>
    <tns:getOibsStudentCardInfo>
      <oibsStudentCardIn>
        <idNumber>${idNumber}</idNumber>
        <userCode>${userCode}</userCode>
      </oibsStudentCardIn>
    </tns:getOibsStudentCardInfo>
  </soapenv:Body>
</soapenv:Envelope>`;

  const postData = Buffer.from(soap, "utf-8");

  // HTTPS ile OIBS'e gönder (self-signed cert kabul et)
  const xmlText = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: OIBS_HOST,
        path:     OIBS_PATH,
        method:   "POST",
        rejectUnauthorized: false,
        headers: {
          "Content-Type":   "text/xml; charset=utf-8",
          "SOAPAction":     `${OIBS_NS}#getOibsStudentCardInfo`,
          "Content-Length": postData.length,
        },
      },
      (res) => {
        let d = "";
        res.on("data", (ch) => (d += ch));
        res.on("end", () => resolve(d));
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("OIBS timeout")); });
    req.write(postData);
    req.end();
  });

  // XML → JSON parse
  const parsed = await parseStringPromise(xmlText, { explicitArray: false });

  // Namespace prefix'lerini kaldır (cas:user → user, tns:major → major vb.)
  const flatten = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = k.includes(":") ? k.split(":").pop() : k;
      out[key] = typeof v === "object" && !Array.isArray(v) ? flatten(v) : v;
    }
    return out;
  };

  const flat  = flatten(parsed);
  const body  = flat?.Envelope?.Body || {};
  const resp  = body?.getOibsStudentCardInfoResponse
             || body?.getOibsStudentCardInfoReturn
             || body || {};
  const ret   = resp?.return || resp || {};
  const msg   = ret?.message     || {};
  const si    = ret?.studentInfo || {};
  const major = ret?.major       || {};
  const minor = ret?.minor       || {};
  const dm    = ret?.doubleMajor || {};

  return {
    messageCode: msg?.messageCode || "",
    student: {
      idNumber:  si?.idNumber  || "",
      userCode:  si?.userCode  || "",
      firstName: si?.firstName || "",
      lastName:  si?.lastName  || "",
      semester:  si?.semester  || "",
      telephone: si?.telephone || "",
    },
    major: {
      programCode:        major?.programCode        || "",
      programNameTr:      major?.programNameTr      || "",
      programNameEng:     major?.programNameEng     || "",
      facultyLongNameEng: major?.facultyLongNameEng || "",
      year:               major?.yeer               || "",   // OIBS'de "yeer" yazıyor
      statusDescEng:      major?.statusDescEng      || "",
      cgpa:               major?.cgpa               || "",
      entryDate:          major?.entryDate          || "",
    },
    minor:       minor?.programCode ? { programCode: minor.programCode, programNameEng: minor.programNameEng || "" } : null,
    doubleMajor: dm?.programCode    ? { programCode: dm.programCode,    programNameEng: dm.programNameEng    || "" } : null,
  };
}

const TEST_USERS = [
  { username: "admin",   password: "admin123", name: "Admin",        role: "admin"   },
  // Test öğrencisi — şifre "test123", OIBS'den gerçek bilgiler çekilir
  { username: "e251702", password: "test123",  name: "Test Öğrenci", role: "student",
    source: "test", studentId: "2517025",
    firstName: "", lastName: "", semester: "",
    programCode: "", programName: "", faculty: "", year: "", cgpa: "" },
];

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Kullanıcı adı ve şifre gerekli." });

  const user = TEST_USERS.find(
    (u) => u.username === username.trim() && u.password === password
  );
  if (!user)
    return res.status(401).json({ message: "Kullanıcı adı veya şifre hatalı." });

  const { password: _, ...userData } = user;


  if (userData.role === "student" && userData.studentId) {
    try {
      const oibs = await fetchOibsStudentInfo(userData.studentId, userData.username);
      userData.firstName   = oibs.student?.firstName          || "";
      userData.lastName    = oibs.student?.lastName           || "";
      userData.semester    = oibs.student?.semester           || "";
      userData.programCode = oibs.major?.programCode          || "";
      userData.programName = oibs.major?.programNameEng       || "";
      userData.faculty     = oibs.major?.facultyLongNameEng   || "";
      userData.year        = oibs.major?.year                 || "";
      userData.cgpa        = oibs.major?.cgpa                 || "";
    } catch (e) {
      console.warn("OIBS fetch failed:", e.message);
    }
  }

  const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
  return res.json({ token, user: userData });
});


app.post("/api/auth/cas/validate", async (req, res) => {
  const { ticket } = req.body;
  if (!ticket) return res.status(400).json({ message: "ticket gerekli." });

  const validateUrl =
    `https://login.metu.edu.tr/cas/p3/serviceValidate` +
    `?ticket=${encodeURIComponent(ticket)}` +
    `&service=${encodeURIComponent(SERVICE_URL)}`;

  try {
    const xmlText = await new Promise((resolve, reject) => {
      https.get(validateUrl, (resp) => {
        let data = "";
        resp.on("data", (chunk) => (data += chunk));
        resp.on("end", () => resolve(data));
        resp.on("error", reject);
      }).on("error", reject);
    });

    const parsed = await parseStringPromise(xmlText, { explicitArray: false });
    const sr     = parsed["cas:serviceResponse"];

    if (sr["cas:authenticationFailure"]) {
      const reason = sr["cas:authenticationFailure"]._ || "CAS doğrulama başarısız.";
      return res.status(401).json({ message: reason.trim() });
    }

    const success = sr["cas:authenticationSuccess"];
    if (!success)
      return res.status(401).json({ message: "CAS yanıtı beklenmedik formatta." });

    const netid     = success["cas:user"] || "";
    const attrs     = success["cas:attributes"] || {};
    const name      = attrs["cas:cn"] || attrs["cas:displayName"] || attrs["cas:givenName"] || netid;
    const studentId = attrs["cas:studentId"] || attrs["cas:uid"] || "";

    // OIBS'den öğrenci bilgilerini çek
    let oibsData = null;
    try {
      oibsData = await fetchOibsStudentInfo(studentId || netid, netid);
    } catch (e) {
      console.warn(`OIBS fetch failed for ${netid}:`, e.message);
    }

    const userData = {
      username:    netid,
      name:        String(name),
      role:        "student",
      source:      "cas",
      studentId:   oibsData?.student?.idNumber          || studentId || "",
      firstName:   oibsData?.student?.firstName         || "",
      lastName:    oibsData?.student?.lastName          || "",
      semester:    oibsData?.student?.semester          || "",
      programCode: oibsData?.major?.programCode         || "",
      programName: oibsData?.major?.programNameEng      || "",
      faculty:     oibsData?.major?.facultyLongNameEng  || "",
      year:        oibsData?.major?.year                || "",
      cgpa:        oibsData?.major?.cgpa                || "",
    };

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, user: userData });

  } catch (err) {
    console.error("CAS validate error:", err);
    return res.status(500).json({ message: "CAS doğrulaması sırasında sunucu hatası." });
  }
});


app.post("/api/admin/student-lookup", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Token gerekli." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin")
      return res.status(403).json({ message: "Sadece admin kullanabilir." });
  } catch {
    return res.status(401).json({ message: "Token geçersiz." });
  }

  const { idNumber, userCode } = req.body;
  if (!idNumber?.trim() || !userCode?.trim())
    return res.status(400).json({ message: "idNumber ve userCode gerekli." });

  try {
    const data = await fetchOibsStudentInfo(idNumber.trim(), userCode.trim());
    console.log(`[ADMIN LOOKUP] ${userCode} → cgpa=${data.major?.cgpa} program=${data.major?.programCode}`);
    return res.json(data);
  } catch (err) {
    console.error("Admin OIBS lookup error:", err.message);
    return res.status(500).json({ message: `OIBS hatası: ${err.message}` });
  }
});


app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Token bulunamadı." });
  try {
    const { iat, exp, ...user } = jwt.verify(token, JWT_SECRET);
    return res.json({ user });
  } catch {
    return res.status(401).json({ message: "Token geçersiz veya süresi dolmuş." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.json({ message: "Çıkış yapıldı." });
});

app.listen(PORT, () => {
  console.log(`✓ Backend çalışıyor → http://localhost:${PORT}`);
});