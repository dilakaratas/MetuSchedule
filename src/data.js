const DAY_MAP = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  
    MONDAY: 0,
    TUESDAY: 1,
    WEDNESDAY: 2,
    THURSDAY: 3,
    FRIDAY: 4,
    SATURDAY: 5,
    SUNDAY: 6,
  
    Pzt: 0,
    Sal: 1,
    Çar: 2,
    Per: 3,
    Cum: 4,
  };
  
  const PROGRAM_CODE_TO_PREFIX = {
    // Engineering
    "571": "CENG",
    "567": "EEE",
    "562": "CE",
    "563": "CHE",
    "564": "GEOE",
    "565": "MINE",
    "566": "PETE",
    "568": "IE",
    "569": "ME",
    "570": "METE",
    "572": "AEE",
    "573": "FOOD",
    "574": "FDE",
    "575": "CENG",
    "576": "BME",
    "577": "AI",
  
    // Common service / institute / language codes from metu_courses_clean.json
    "901": "IS",
    "603": "FREN",
    "604": "GER",
    "605": "JAPN",
    "606": "ITAL",
    "607": "RUSS",
    "608": "SPAN",
    "609": "HEBR",
    "610": "GREE",
    "611": "CHIN",
    "612": "PERS",
    "613": "KORE",
  
    // Vocational school courses: prefix net değilse numeric bırakmamak için
    // İstersen bunu "MYO" yerine başka prefix yapabiliriz.
    "795": "MYO",
    "796": "FOOD",
    "797": "ELEC",
    "798": "ELT",
    "799": "AUTO",
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
  
    if (beforeParenMatch) {
      return Number(beforeParenMatch[0].replace(",", ".")) || 0;
    }
  
    const allNumbers = text.match(/\d+(?:[.,]\d+)?/g);
    if (!allNumbers || allNumbers.length === 0) return 0;
  
    return Number(allNumbers[0].replace(",", ".")) || 0;
  }
  
  function getPrefixFromDepartmentName(departmentName) {
    const name = cleanText(departmentName).toUpperCase();
  
    if (!name) return "";
  
    if (name.includes("COMPUTER ENGINEERING")) return "CENG";
    if (name.includes("ELECTRICAL") || name.includes("ELECTRONICS")) return "EEE";
    if (name.includes("INDUSTRIAL ENGINEERING")) return "IE";
    if (name.includes("MECHANICAL ENGINEERING")) return "ME";
    if (name.includes("CIVIL ENGINEERING")) return "CE";
    if (name.includes("CHEMICAL ENGINEERING")) return "CHE";
    if (name.includes("GEOLOGICAL ENGINEERING")) return "GEOE";
    if (name.includes("MINING ENGINEERING")) return "MINE";
    if (name.includes("PETROLEUM") || name.includes("NATURAL GAS")) return "PETE";
    if (name.includes("METALLURGICAL") || name.includes("MATERIALS ENGINEERING")) return "METE";
    if (name.includes("AEROSPACE ENGINEERING")) return "AEE";
    if (name.includes("FOOD ENGINEERING")) return "FOOD";
    if (name.includes("ARTIFICIAL INTELLIGENCE")) return "AI";
    if (name.includes("INFORMATION SYSTEMS")) return "IS";
  
    if (name.includes("MODERN LANGUAGE") && name.includes("FRENCH")) return "FREN";
    if (name.includes("MODERN LANGUAGE") && name.includes("GREEK")) return "GREE";
    if (name.includes("MODERN LANGUAGE") && name.includes("GERMAN")) return "GER";
    if (name.includes("MODERN LANGUAGE") && name.includes("SPANISH")) return "SPAN";
    if (name.includes("MODERN LANGUAGE") && name.includes("ITALIAN")) return "ITAL";
    if (name.includes("MODERN LANGUAGE") && name.includes("RUSSIAN")) return "RUSS";
    if (name.includes("MODERN LANGUAGE") && name.includes("JAPANESE")) return "JAPN";
    if (name.includes("MODERN LANGUAGE") && name.includes("CHINESE")) return "CHIN";
    if (name.includes("MODERN LANGUAGE") && name.includes("KOREAN")) return "KORE";
  
    return "";
  }
  
  function decodeNumericMetuCourseCode(courseCode, department = {}) {
    const raw = cleanText(courseCode).replace(/\s+/g, "").toUpperCase();
  
    if (!raw) return "";
  
    // Zaten CENG100, EEE400, MATH117 gibi geldiyse dokunma
    if (/^[A-Z]{2,8}\d{3,4}[A-Z]?$/.test(raw)) {
      return raw;
    }
  
    // Sadece sayı değilse dokunma
    if (!/^\d+$/.test(raw)) {
      return raw;
    }
  
    const departmentCode = cleanText(department?.departmentCode);
    const departmentName = cleanText(department?.departmentName);
  
    // 5670400 -> 567 + 0 + 400 -> EEE400
    // 5710100 -> 571 + 0 + 100 -> CENG100
    // 9010100 -> 901 + 0 + 100 -> IS100
    if (raw.length === 7) {
      const programCode = raw.slice(0, 3);
      const middleDigit = raw.slice(3, 4);
      const courseNumber = raw.slice(4);
  
      const prefix =
        PROGRAM_CODE_TO_PREFIX[programCode] ||
        PROGRAM_CODE_TO_PREFIX[departmentCode] ||
        getPrefixFromDepartmentName(departmentName);
  
      if (prefix && middleDigit === "0") {
        return `${prefix}${courseNumber}`;
      }
    }
  
    // 571100 gibi gelirse -> CENG100
    if (raw.length === 6) {
      const programCode = raw.slice(0, 3);
      const courseNumber = raw.slice(3);
  
      const prefix =
        PROGRAM_CODE_TO_PREFIX[programCode] ||
        PROGRAM_CODE_TO_PREFIX[departmentCode] ||
        getPrefixFromDepartmentName(departmentName);
  
      if (prefix) {
        return `${prefix}${courseNumber}`;
      }
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
  
    const prefixFromDepartmentCode = PROGRAM_CODE_TO_PREFIX[cleanText(departmentCode)];
    if (prefixFromDepartmentCode) return prefixFromDepartmentCode;
  
    const prefixFromName = getPrefixFromDepartmentName(departmentName);
    if (prefixFromName) return prefixFromName;
  
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
      section?.sectionNo ||
        section?.section_no ||
        section?.id ||
        section?.section ||
        ""
    );
  
    return {
      id: sectionNo.padStart(2, "0"),
      crn: section?.crn || `${courseCode}-${sectionNo}`,
      instructor: Array.isArray(section?.instructors)
        ? section.instructors
            .map(cleanInstructorName)
            .filter(Boolean)
            .join(", ")
        : cleanInstructorName(section?.instructor || ""),
      quota: Number(section?.quota) || 999,
      enrolled: Number(section?.enrolled) || 0,
      meetings: Array.isArray(section?.times)
        ? section.times
            .map(convertTimeToMeeting)
            .filter((m) => m.d !== undefined && m.s && m.e)
        : Array.isArray(section?.meetings)
        ? section.meetings
            .map(convertTimeToMeeting)
            .filter((m) => m.d !== undefined && m.s && m.e)
        : [],
    };
  }
  
  function getRawCourseCode(course) {
    return cleanText(
      course?.courseCode ||
        course?.course_code ||
        course?.code ||
        course?.dersKodu ||
        course?.kod ||
        ""
    );
  }
  
  function getCourseName(course) {
    return cleanText(
      course?.courseName ||
        course?.course_name ||
        course?.name ||
        course?.dersAdi ||
        course?.ad ||
        ""
    );
  }
  
  function convertCourse(course, department) {
    const originalCode = getRawCourseCode(course);
    const code = formatCourseCode(originalCode, department);
    const name = getCourseName(course);
  
    const dept = getDeptCode(
      department?.departmentName,
      code,
      department?.departmentCode
    );
  
    return {
      code,
      originalCode,
      name,
      nameTr: name,
      credits: parseCredits(course?.credit || course?.credits),
      dept,
      catalogUrl: `https://catalog.metu.edu.tr/course.php?course_code=${
        originalCode || code
      }`,
      sections: Array.isArray(course?.sections)
        ? course.sections.map((section) => convertSection(section, code))
        : [],
    };
  }
  
  export async function loadMetuCourses() {
    const res = await fetch("/metu_courses_clean.json");
  
    if (!res.ok) {
      throw new Error(`Veri yüklenemedi: ${res.status}`);
    }
  
    const rawMetuData = await res.json();
  
    const departments = Array.isArray(rawMetuData?.departments)
      ? rawMetuData.departments
      : [];
  
    return departments
      .filter((department) => {
        const name = cleanText(department?.departmentName).toLowerCase();
  
        // İstersen NCC derslerini ana katalogdan da gizleyelim
        return !name.includes("kuzey kıbrıs kampüsü");
      })
      .flatMap((department) =>
        (department.courses || []).map((course) =>
          convertCourse(course, department)
        )
      )
      .filter((course) => course.code && course.name && course.sections.length > 0);
  }