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
const SERVICE_URL = "http://144.122.198.33";

const TEST_USERS = [
  { username: "admin", password: "admin123", name: "Admin", role: "admin" },
];

// ── Test login ──────────────────────────────────────────────────────────────
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Kullanıcı adı ve şifre gerekli." });

  const user = TEST_USERS.find(
    (u) => u.username === username.trim() && u.password === password
  );
  if (!user)
    return res.status(401).json({ message: "Kullanıcı adı veya şifre hatalı." });

  const { password: _, ...userData } = user;
  const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
  return res.json({ token, user: userData });
});

// ── CAS ticket doğrulama ────────────────────────────────────────────────────
app.post("/api/auth/cas/validate", async (req, res) => {
  const { ticket } = req.body;

  if (!ticket)
    return res.status(400).json({ message: "ticket gerekli." });

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
    const serviceResponse = parsed["cas:serviceResponse"];

    if (serviceResponse["cas:authenticationFailure"]) {
      const reason =
        serviceResponse["cas:authenticationFailure"]._ || "CAS doğrulama başarısız.";
      return res.status(401).json({ message: reason.trim() });
    }

    const success = serviceResponse["cas:authenticationSuccess"];
    if (!success)
      return res.status(401).json({ message: "CAS yanıtı beklenmedik formatta." });

    const netid = success["cas:user"] || "";
    const attrs = success["cas:attributes"] || {};
    const name  =
      attrs["cas:cn"] ||
      attrs["cas:displayName"] ||
      attrs["cas:givenName"] ||
      netid;

    const userData = {
      username: netid,
      name: String(name),
      role: "student",
      source: "cas",
    };

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, user: userData });

  } catch (err) {
    console.error("CAS validate error:", err);
    return res.status(500).json({ message: "CAS doğrulaması sırasında sunucu hatası." });
  }
});

// ── Token doğrulama ─────────────────────────────────────────────────────────
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

// ── Logout ──────────────────────────────────────────────────────────────────
app.post("/api/auth/logout", (_req, res) => {
  res.json({ message: "Çıkış yapıldı." });
});

app.listen(PORT, () => {
  console.log(`✓ Backend çalışıyor → http://localhost:${PORT}`);
});