const DAY_MAP = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4,
  Saturday: 5, Sunday: 6,
  MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4,
  SATURDAY: 5, SUNDAY: 6,
  Pzt: 0, Sal: 1, Çar: 2, Per: 3, Cum: 4,
};

/*
  DEPT_CODE_TO_PREFIX
  ─────────────────────────────────────────────────────────────────
  metu_courses_clean.json'daki departmentCode → ders kodu prefix'i

  Sayısal ham kod formatı: DDDXNNN (7 hane)
    DDD = departmentCode (3 hane)
    X   = herhangi bir rakam (0 olmak zorunda değil)
    NNN = ders numarası (3 hane)
  Dönüşüm: prefix + int(raw[3:])
  Örnek: 2331010 → dept=233 → PSY → PSY + int("1010") = PSY1010
  Örnek: 5710140 → dept=571 → CENG → CENG + int("0140") = CENG140
*/
const DEPT_CODE_TO_PREFIX = {
  // Mühendislik Fakültesi
  "571": "CENG",  // Computer Engineering
  "567": "EE",    // Electrical and Electronics Engineering
  "562": "CE",    // Civil Engineering
  "563": "CHE",   // Chemical Engineering
  "564": "GEOE",  // Geological Engineering
  "565": "MINE",  // Mining Engineering
  "566": "PETE",  // Petroleum and Natural Gas Engineering
  "568": "IE",    // Industrial Engineering
  "569": "ME",    // Mechanical Engineering
  "570": "METE",  // Metallurgical and Materials Engineering
  "572": "AEE",   // Aerospace Engineering
  "573": "FDE",   // Food Engineering
  "560": "ENVE",  // Environmental Engineering
  "561": "ES",    // Engineering Sciences
  "575": "CNGB",  // Computer Engineering (Türkiye-Azerbaijan)
  "576": "BME",   // Biomedical Engineering
  "577": "AI",    // Artificial Intelligence Engineering
  "887": "AI",    // Artificial Intelligence Engineering (grad)
  "393": "AI",    // Artificial Intelligence Engineering (NCC?)
  "384": "AEE",   // Aerospace Engineering (grad/NCC)
  "388": "IE",    // Industrial Engineering (NCC)
  "364": "CE",    // Civil Engineering (NCC)
  "365": "ME",    // Mechanical Engineering (NCC)
  "367": "CHE",   // Chemical Engineering (NCC)
  "356": "EE",    // EEE (NCC)
  "355": "CENG",  // Computer Engineering (NCC)
  "374": "PETE",  // Petroleum (NCC)
  "383": "ES",    // Engineering Sciences (NCC)
  "389": "SW",    // Software Engineering (NCC)
  "390": "SEES",  // Sustainable Environment and Energy Systems

  // Fen-Edebiyat Fakültesi
  "230": "PHYS",  // Physics
  "236": "MATH",  // Mathematics
  "234": "CHEM",  // Chemistry
  "238": "BIO",   // Biology
  "219": "GENE",  // Molecular Biology and Genetics
  "241": "PHIL",  // Philosophy
  "233": "PSY",   // Psychology
  "232": "SOC",   // Sociology
  "246": "STAT",  // Statistics
  "240": "HIST",  // History
  "358": "PHYS",  // Physics (NCC)
  "357": "MATH",  // Mathematics (NCC)
  "360": "CHEM",  // Chemistry (NCC)
  "371": "PSY",   // Psychology (NCC)
  "372": "SOC",   // Sociology (NCC)
  "362": "HIST",  // History (NCC)
  "363": "STAT",  // Statistics (NCC)
  "377": "PHIL",  // Philosophy (NCC)

  // İktisadi ve İdari Bilimler
  "311": "ECON",  // Economics
  "312": "BA",    // Business Administration
  "314": "IR",    // International Relations
  "310": "ADM",   // Political Science and Public Administration
  "315": "GIA",   // Global and International Affairs
  "316": "BAS",   // Business Administration (International)
  "352": "ECON",  // Economics (NCC)
  "353": "BA",    // Business Administration (NCC)
  "354": "IR",    // Political Science and International Relations (NCC)

  // Mimarlık Fakültesi
  "120": "ARCH",  // Architecture
  "121": "CRP",   // City and Regional Planning
  "125": "ID",    // Industrial Design
  "801": "ARCH",  // History of Architecture (grad)
  "853": "CP",    // City Planning (grad)
  "854": "BS",    // Building Science (grad)
  "855": "UD",    // Urban Design (grad)
  "856": "CONS",  // Conservation of Cultural Heritage
  "858": "CDF",   // Computational Design and Fabrication
  "811": "UPL",   // Urban Policy Planning

  // Eğitim Fakültesi
  "411": "ECE",   // Early Childhood Education
  "430": "CEIT",  // Computer Education and Instructional Technology
  "450": "FLE",   // Foreign Language Education
  "451": "TEFL",  // English Language Teaching (International)
  "453": "PES",   // Physical Education and Sports
  "454": "EDS",   // Educational Sciences
  "460": "MSE",   // Mathematics and Science Education
  "820": "TEFL",  // English Language Teaching
  "821": "ELIT",  // English Literature
  "366": "TEFL",  // Teaching English as a Foreign Language (NCC)
  "368": "EDS",   // Educational Sciences (NCC)
  "391": "TEFL",  // English Language Teaching (NCC)
  "378": "GPC",   // Guidance and Psychological Counseling
  "420": "SSME",  // Secondary Science and Mathematics Education

  // Dil bölümleri
  "642": "TURK",  // Turkish Language
  "629": "TURK",  // Turkish as a Foreign Language
  "639": "ENG",   // Modern Languages (English)
  "603": "FREN",  // Modern Languages (French)
  "604": "GER",   // Modern Languages (German)
  "605": "JAPN",  // Modern Languages (Japanese)
  "606": "ITAL",  // Modern Languages (Italian)
  "607": "RUSS",  // Modern Languages (Russian)
  "608": "SPAN",  // Modern Languages (Spanish)
  "609": "HEBR",  // Modern Languages (Hebrew)
  "610": "GREE",  // Modern Language (Greek)
  "611": "CHIN",  // Modern Languages (Chinese)
  "612": "PERS",  // Modern Languages (Persian)
  "613": "KORE",  // Modern Languages (Korean)
  "602": "ARA",   // Modern Languages (Arabic)
  "369": "GER",   // Modern Languages German (NCC)
  "380": "CHIN",  // Modern Languages Chinese (NCC)
  "359": "ENG",   // Modern Languages English (NCC)
  "361": "TURK",  // Turkish Language (NCC)

  // Müzik ve Güzel Sanatlar
  "651": "MUS",
  "682": "MUS",
  "643": "MUS",
  "644": "MUS",

  // Bilişim / IS
  "901": "IS",    // Information Systems
  "795": "MYO",   // Meslek Yüksekokulu

  // Yüksek lisans / disiplinlerarası
  "863": "ARCHM", // Archaeometry
  "864": "ASTRO", // Astrophysics
  "860": "BCHM",  // Biochemistry
  "908": "BION",  // Bioinformatics
  "861": "BIOT",  // Biotechnology
  "872": "BME",   // Biomedical Engineering
  "902": "COS",   // Cognitive Sciences
  "870": "CEM",   // Cement Engineering
  "910": "CS",    // Cyber Security
  "886": "DDS",   // Data and Decision Sciences
  "911": "DI",    // Data Informatics
  "874": "ESS",   // Earth System Science
  "873": "EQS",   // Earthquake Studies
  "866": "EM",    // Engineering Management
  "865": "GGIT",  // Geodetic and Geographical Information Technologies
  "810": "GWS",   // Gender and Women Studies
  "906": "MI",    // Medical Informatics
  "832": "MES",   // Middle East Studies
  "909": "MM",    // Multimedia Informatics
  "871": "MNT",   // Micro and Nanotechnology
  "878": "NEUR",  // Neuroscience
  "877": "OHS",   // Occupational Health and Safety
  "387": "OHS",   // Occupational Health and Safety (NCC)
  "880": "OR",    // Operational Research
  "862": "POLY",  // Polymer Science and Technology
  "885": "ROB",   // Robotics
  "831": "STP",   // Science and Technology Policy Studies
  "814": "SEAR",  // Settlement Archaeology
  "815": "AREA",  // Area Studies
  "816": "MCS",   // Media and Cultural Studies
  "833": "EU",    // European Studies
  "835": "EURS",  // Eurasian Studies
  "837": "EMBA",  // Executive MBA
  "838": "EUINT", // European Integration
  "839": "SP",    // Social Policy
  "840": "ANTH",  // Social Anthropology
  "841": "SOSC",  // Social Sciences
  "842": "AS",    // Asian Studies
  "843": "LNAS",  // Latin and North American Studies
  "852": "REG",   // Regional Planning
  "857": "DRI",   // Design Research for Interaction
  "950": "MARE",  // Graduate School of Marine Sciences
  "970": "IAM",   // Institute of Applied Mathematics
  "976": "ACT",   // Actuarial Science
};

function cleanText(value) {
  return String(value || "").trim();
}

function cleanInstructorName(value) {
  return cleanText(value)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.toUpperCase() !== "STAFF")
    .join(", ");
}

function parseCredits(credit) {
  if (credit === null || credit === undefined) return 0;
  const text = String(credit).trim();
  if (!text) return 0;
  const beforeParen = text.split("(")[0];
  const beforeParenMatch = beforeParen.match(/\d+(?:[.,]\d+)?/);
  if (beforeParenMatch) return Number(beforeParenMatch[0].replace(",", ".")) || 0;
  const allNumbers = text.match(/\d+(?:[.,]\d+)?/g);
  if (!allNumbers || allNumbers.length === 0) return 0;
  return Number(allNumbers[0].replace(",", ".")) || 0;
}

/*
  decodeNumericMetuCourseCode
  ─────────────────────────────────────────────────────────────────
  Sayısal OIBS kodunu insan-okunabilir ders koduna çevirir.

  Format: DDDXNNN (7 hane)
    DDD = departmentCode
    X   = herhangi rakam (0 olmak zorunda değil)
    NNN = ders numarası
  → prefix + int(raw[3:]) → örn: PSY1010, CENG140, MATH112

  Zaten alfabetik format (CENG100 vb.) geldiyse dokunmaz.
*/
function decodeNumericMetuCourseCode(courseCode, department = {}) {
  const raw = cleanText(courseCode).replace(/\s+/g, "").toUpperCase();
  if (!raw) return "";

  // Zaten alfabetik formattaysa dokunma
  if (/^[A-Z]{2,8}\d+[A-Z]?$/.test(raw)) return raw;

  // Sayısal değilse dokunma
  if (!/^\d+$/.test(raw)) return raw;

  const deptCode = cleanText(department?.departmentCode);
  const prefix = DEPT_CODE_TO_PREFIX[deptCode] ||
                 DEPT_CODE_TO_PREFIX[raw.slice(0, 3)];

  if (prefix && (raw.length === 7 || raw.length === 6)) {
    const numPart = raw.slice(3);          // son 4 (veya 3) hane
    const numInt = parseInt(numPart, 10);  // leading zero'ları at
    return `${prefix}${numInt}`;
  }

  return raw;
}

function formatCourseCode(courseCode, department) {
  return decodeNumericMetuCourseCode(courseCode, department);
}

function getDeptCode(departmentName, courseCode, departmentCode) {
  const code = cleanText(courseCode).toUpperCase();
  const fromCode = code.match(/^([A-Z]{2,8})\d/);
  if (fromCode?.[1]) return fromCode[1];

  const prefixFromDeptCode = DEPT_CODE_TO_PREFIX[cleanText(departmentCode)];
  if (prefixFromDeptCode) return prefixFromDeptCode;

  return "GEN";
}

function convertTimeToMeeting(time) {
  const dayRaw = time?.day;
  const day = DAY_MAP[dayRaw] ?? DAY_MAP[String(dayRaw || "").trim()];
  return {
    d: day,
    s: time?.start || time?.s || "",
    e: time?.end || time?.e || "",
    room: time?.place || time?.room || "",
  };
}

function convertSection(section, courseCode) {
  const sectionNo = cleanText(
    section?.sectionNo || section?.section_no ||
    section?.id || section?.section || ""
  );
  return {
    id: sectionNo.padStart(2, "0"),
    crn: section?.crn || `${courseCode}-${sectionNo}`,
    instructor: Array.isArray(section?.instructors)
      ? section.instructors.map(cleanInstructorName).filter(Boolean).join(", ")
      : cleanInstructorName(section?.instructor || ""),
    quota: Number(section?.quota) || 999,
    enrolled: Number(section?.enrolled) || 0,
    meetings: Array.isArray(section?.times)
      ? section.times.map(convertTimeToMeeting).filter((m) => m.d !== undefined && m.s && m.e)
      : Array.isArray(section?.meetings)
      ? section.meetings.map(convertTimeToMeeting).filter((m) => m.d !== undefined && m.s && m.e)
      : [],
  };
}

function getRawCourseCode(course) {
  return cleanText(
    course?.courseCode || course?.course_code || course?.code ||
    course?.dersKodu || course?.kod || ""
  );
}

function getCourseName(course) {
  return cleanText(
    course?.courseName || course?.course_name || course?.name ||
    course?.dersAdi || course?.ad || ""
  );
}

function convertCourse(course, department) {
  const originalCode = getRawCourseCode(course);
  const code = formatCourseCode(originalCode, department);
  const name = getCourseName(course);
  const dept = getDeptCode(department?.departmentName, code, department?.departmentCode);

  return {
    code,
    originalCode,
    name,
    nameTr: name,
    credits: parseCredits(course?.credit || course?.credits),
    dept,
    catalogUrl: `https://catalog.metu.edu.tr/course.php?course_code=${originalCode || code}`,
    sections: Array.isArray(course?.sections)
      ? course.sections.map((section) => convertSection(section, code))
      : [],
    prerequisite: null, // metu_courses_new.json merge sonrası doldurulur
  };
}

/*
  parsePrerequisiteString
  ─────────────────────────────────────────────────────────────────
  "Set 1: 1200101 Set 2: 3590101" formatını parse eder.
  Her "Set N:" bir alternatif koşul grubudur (OR ilişkisi).
  Grup içindeki kodlar ise AND ilişkisindedir.
  Sayısal kodlar DEPT_CODE_TO_PREFIX ile human-readable'a çevrilir.
*/
function decodeNumericPrereqCode(raw) {
  const s = String(raw).trim();
  if (!s || !/^\d+$/.test(s)) return s;
  if (s.length === 6 || s.length === 7) {
    const prefix = DEPT_CODE_TO_PREFIX[s.slice(0, 3)];
    if (prefix) {
      const num = parseInt(s.slice(3), 10);
      return `${prefix}${num}`;
    }
  }
  return s;
}

export function parsePrerequisiteString(raw) {
  if (!raw || !raw.trim()) return null;
  // "Set 1: 1200101 , 1200102 Set 2: 6390101" → [{codes:[...]}, ...]
  const setRegex = /Set\s+\d+\s*:\s*([^S]*)/gi;
  const sets = [];
  let match;
  while ((match = setRegex.exec(raw)) !== null) {
    const codes = match[1]
      .split(/[\s,]+/)
      .map((c) => c.trim())
      .filter(Boolean)
      .map(decodeNumericPrereqCode)
      .filter(Boolean);
    if (codes.length) sets.push(codes);
  }
  // "Set N:" formatı yoksa düz kod listesi olarak dene
  if (!sets.length) {
    const codes = raw
      .split(/[\s,]+/)
      .map((c) => c.trim())
      .filter(Boolean)
      .map(decodeNumericPrereqCode)
      .filter(Boolean);
    if (codes.length) sets.push(codes);
  }
  return sets.length ? sets : null;
}

/*
  loadPrerequisiteMap
  ─────────────────────────────────────────────────────────────────
  metu_courses_new.json'ı yükler ve { courseCode → parsedPrereqs } map'i döner.
*/
async function loadPrerequisiteMap() {
  try {
    const res = await fetch("/metu_courses_new.json");
    if (!res.ok) return {};
    const faculties = await res.json();
    const map = {};
    for (const fac of faculties) {
      for (const dept of fac.departments || []) {
        for (const course of dept.courses || []) {
          const code = String(course.code || "").trim();
          const prereqRaw = course?.detail?.prerequisite || "";
          if (code && prereqRaw.trim()) {
            const parsed = parsePrerequisiteString(prereqRaw);
            if (parsed) map[code] = parsed;
          }
        }
      }
    }
    return map;
  } catch {
    return {};
  }
}

export async function loadMetuCourses() {
  // İki fetch'i paralel çalıştır
  const [coursesRes, prereqMap] = await Promise.all([
    fetch("/metu_courses_clean.json"),
    loadPrerequisiteMap(),
  ]);

  if (!coursesRes.ok) throw new Error(`Veri yüklenemedi: ${coursesRes.status}`);

  const rawMetuData = await coursesRes.json();
  const departments = Array.isArray(rawMetuData?.departments) ? rawMetuData.departments : [];

  const allCourses = departments
    .filter((department) => {
      const name = cleanText(department?.departmentName).toLowerCase();
      return !name.includes("kuzey kıbrıs kampüsü");
    })
    .flatMap((department) =>
      (department.courses || []).map((course) => convertCourse(course, department))
    )
    .filter((course) => course.code && course.name && course.sections.length > 0);

  // Duplicate dedupe: aynı kod birden fazla dept'ten gelirse
  // en fazla section'ı olan (ya da ilk gelen) tercihen kullan.
  const seen = new Map();
  for (const course of allCourses) {
    const existing = seen.get(course.code);
    if (!existing || course.sections.length > existing.sections.length) {
      seen.set(course.code, course);
    }
  }

  // Prerequisite merge: metu_courses_new.json'dan gelen prereq'ları ekle
  for (const course of seen.values()) {
    if (prereqMap[course.code]) {
      course.prerequisite = prereqMap[course.code];
    }
  }

  return Array.from(seen.values());
}