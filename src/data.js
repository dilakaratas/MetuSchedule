const DAY_MAP = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
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

function getDeptCode(departmentName, courseCode) {
  const deptText = cleanText(departmentName);
  const firstPart = deptText.split("/")[0].trim();
  const words = firstPart.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 5);
  }

  if (words.length === 1) {
    return words[0].slice(0, 5).toUpperCase();
  }

  return String(courseCode || "GEN").slice(0, 4);
}

function formatCourseCode(courseCode) {
  return cleanText(courseCode);
}

function convertTimeToMeeting(time) {
  return {
    d: DAY_MAP[time.day],
    s: time.start,
    e: time.end,
    room: time.place || "",
  };
}

function convertSection(section, courseCode) {
  const sectionNo = cleanText(section.sectionNo);

  return {
    id: sectionNo.padStart(2, "0"),
    crn: `${courseCode}-${sectionNo}`,
    instructor: Array.isArray(section.instructors)
      ? section.instructors
          .map(cleanInstructorName)
          .filter(Boolean)
          .join(", ")
      : "",
    quota: 999,
    enrolled: 0,
    meetings: Array.isArray(section.times)
      ? section.times
          .map(convertTimeToMeeting)
          .filter((m) => m.d !== undefined && m.s && m.e)
      : [],
  };
}

function convertCourse(course, department) {
  const code = formatCourseCode(course.courseCode);
  const name = cleanText(course.courseName);
  const dept = getDeptCode(department.departmentName, code);

  return {
    code,
    name,
    nameTr: name,
    credits: parseCredits(course.credit),
    dept,
    sections: Array.isArray(course.sections)
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

  return rawMetuData.departments
    .flatMap((department) =>
      (department.courses || []).map((course) =>
        convertCourse(course, department)
      )
    )
    .filter(
      (course) => course.code && course.name && course.sections.length > 0
    );
}