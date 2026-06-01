import React, { useEffect, useRef, useState } from "react";
import { toMin } from "../utils.js";

const DAY_NAMES_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const DAY_NAMES_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const DAY_PATTERNS = [
  { idx: 0, patterns: ["pazartesi", "pzt", "pt", "monday", "mon"] },
  { idx: 1, patterns: ["salı", "sali", "sal", "tuesday", "tue"] },
  { idx: 2, patterns: ["çarşamba", "carsamba", "çar", "car", "wednesday", "wed"] },
  { idx: 3, patterns: ["perşembe", "persembe", "per", "thursday", "thu"] },
  { idx: 4, patterns: ["cuma", "cum", "friday", "fri"] },
];

const COURSE_STOP_WORDS = new Set([
  "almak",
  "istiyorum",
  "istiyom",
  "dersini",
  "dersi",
  "ders",
  "den",
  "dan",
  "de",
  "da",
  "bir",
  "ve",
  "ile",
  "icin",
  "için",
  "almam",
  "lazim",
  "lazım",
  "gerek",
  "gerekiyor",
  "bana",
  "benim",
  "bu",
  "o",
  "şu",
  "su",
  "şuan",
  "suan",
  "simdi",
  "şimdi",
  "sezon",
  "take",
  "want",
  "course",
  "class",
  "from",
  "with",
  "and",
  "the",
  "for",
  "get",
]);

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCourseTitle(course, tr) {
  if (!course) return "";
  return tr ? course.nameTr || course.name : course.name || course.nameTr;
}

function getUniqueInstructors(course) {
  const seen = new Set();
  const result = [];

  for (const section of course?.sections || []) {
    const instructor = String(section.instructor || "").trim();
    if (!instructor) continue;

    const key = normalizeText(instructor);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(instructor);
  }

  return result;
}

function isNoPreference(text) {
  const t = normalizeText(text);
  return (
    !t ||
    /^(hayir|yok|yoo+|yo|fark etmez|farketmez|onemli degil|hic fark etmez|hepsi olur|hepsi uygun|olur|gec|geç|skip|no|nope|none|doesnt matter|doesn t matter|any|all)$/i.test(t) ||
    /(tercihim yok|hoca tercihim yok|saat tercihim yok|gun tercihim yok|fark etmez|farketmez|onemli degil|hepsi uygun|her gun uygun|her saat olur|serbest)/.test(t)
  );
}

function parseDays(text) {
  const normalized = normalizeText(text);
  const found = new Set();

  for (const day of DAY_PATTERNS) {
    if (day.patterns.some((pattern) => normalized.includes(normalizeText(pattern)))) {
      found.add(day.idx);
    }
  }

  return found;
}

function parseTimeToMinutes(hourRaw, minuteRaw) {
  const hour = Number(hourRaw);
  const minute = minuteRaw === undefined || minuteRaw === "" ? 40 : Number(minuteRaw);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

function extractFirstTime(text) {
  const normalized = normalizeText(text).replace(/\b(\d{1,2})\s+(\d{2})\b/g, "$1:$2");
  const match = normalized.match(/\b(\d{1,2})(?::|\.)(\d{2})\b|\b(\d{1,2})\b/);

  if (!match) return null;

  if (match[1]) return parseTimeToMinutes(match[1], match[2]);
  return parseTimeToMinutes(match[3], "40");
}

function parseTimeConstraints(text) {
  const normalized = normalizeText(text);

  if (isNoPreference(text)) {
    return { startMin: null, endMin: null };
  }

  let startMin = null;
  let endMin = null;
  const explicitTime = extractFirstTime(text);

  // Örnek: "13:40 sonrası olsun", "13:40'dan sonra başlasın"
  if (explicitTime !== null && /(sonrasi olsun|sonra olsun|sonra basla|sonra baslasin|after|en erken)/.test(normalized)) {
    startMin = explicitTime;
  }

  // Örnek: "09:40 öncesi olmasın", "sabah olmasın"
  if (explicitTime !== null && /(oncesi olmasin|once olmasin|once istemiyorum|before)/.test(normalized)) {
    startMin = explicitTime;
  }

  // Örnek: "16:30 sonrası olmasın", "17:40'dan sonra istemiyorum"
  if (explicitTime !== null && /(sonrasi olmasin|sonra olmasin|sonra istemiyorum|sonra istemem|gec olmasin|en gec|bitis|bitsin|end before)/.test(normalized)) {
    endMin = explicitTime;
  }

  // Örnek: "sabah olmasın", "erken ders istemiyorum"
  if (startMin === null && /(sabah|erken)/.test(normalized) && /(olmasin|istemiyorum|istemem|no|avoid)/.test(normalized)) {
    startMin = 9 * 60 + 40;
  }

  // Örnek: "akşam olmasın", "geç bitmesin"
  if (endMin === null && /(aksam|gec|geç|late)/.test(normalized) && /(olmasin|istemiyorum|istemem|bitmesin|no|avoid)/.test(normalized)) {
    endMin = 16 * 60 + 30;
  }

  return { startMin, endMin };
}

function minutesToTime(min) {
  if (min === null || min === undefined) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function searchCourses(query, allCourses) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const codeLikeTokens = normalizedQuery.match(/\b[a-z]{2,6}\s*\d{2,4}\b|\b\d{5,8}\b/g) || [];
  const queryWords = normalizedQuery
    .split(" ")
    .filter((word) => word.length >= 3 && !COURSE_STOP_WORDS.has(word));

  const results = allCourses
    .map((course) => {
      const code = normalizeText(course.code);
      const name = normalizeText(course.name);
      const nameTr = normalizeText(course.nameTr || "");
      const instructorText = normalizeText(
        (course.sections || []).map((section) => section.instructor).join(" ")
      );
      const fullText = `${code} ${name} ${nameTr} ${instructorText}`;

      let score = 0;

      for (const token of codeLikeTokens) {
        const cleanToken = normalizeText(token).replace(/\s+/g, "");
        const cleanCode = code.replace(/\s+/g, "");
        if (cleanCode === cleanToken) score += 300;
        else if (cleanCode.includes(cleanToken)) score += 160;
      }

      if (code === normalizedQuery || code.replace(/\s+/g, "") === normalizedQuery.replace(/\s+/g, "")) score += 260;
      if (name.includes(normalizedQuery) || nameTr.includes(normalizedQuery)) score += 180;

      for (const word of queryWords) {
        if (code.includes(word)) score += 60;
        if (name.includes(word)) score += 35;
        if (nameTr.includes(word)) score += 40;
        if (instructorText.includes(word)) score += 8;
      }

      // Türkçe günlük arama → İngilizce katalog adı özel eşleştirme
      if (
        normalizedQuery.includes("muhendislik") &&
        normalizedQuery.includes("matematik") &&
        name.includes("mathematics") &&
        name.includes("engineers")
      ) {
        score += 350;
      }

      // Kelimelerin tamamı ders adında geçiyorsa alakasız "Engineering" sonuçlarını geriye at.
      const allWordsInCourseTitle = queryWords.length > 0 && queryWords.every((word) => name.includes(word) || nameTr.includes(word));
      if (allWordsInCourseTitle) score += 120;

      // Sadece tek ortak kelime varsa zayıf kabul et. Örn: sadece "engineering" geçmesi yeterli olmasın.
      const titleHitCount = queryWords.filter((word) => name.includes(word) || nameTr.includes(word)).length;
      if (queryWords.length >= 2 && titleHitCount <= 1 && score < 250) score -= 30;

      return { course, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.course);

  return results;
}

function parsePickedNumbers(text, max) {
  return (text.match(/\d+/g) || [])
    .map((value) => Number(value) - 1)
    .filter((idx, index, arr) => idx >= 0 && idx < max && arr.indexOf(idx) === index);
}

function parseInstructorPreference(text, selectedCourses, instructorOptions) {
  if (isNoPreference(text)) return {};

  const normalized = normalizeText(text);
  const result = {};

  // Tek ders seçiliyken numara ile hoca seçimi
  if (selectedCourses.length === 1) {
    const selectedIndex = Number((text.match(/\d+/) || [])[0]) - 1;
    if (!Number.isNaN(selectedIndex) && instructorOptions[selectedIndex]) {
      result[selectedCourses[0].code] = instructorOptions[selectedIndex];
      return result;
    }
  }

  // İsim/soyisim ile hoca seçimi
  for (const course of selectedCourses) {
    let bestInstructor = null;
    let bestScore = 0;

    for (const instructor of getUniqueInstructors(course)) {
      const instNorm = normalizeText(instructor);
      const instWords = instNorm.split(" ").filter((word) => word.length >= 2);
      let score = 0;

      if (normalized.includes(instNorm)) score += 100;
      for (const word of instWords) {
        if (word.length >= 3 && normalized.includes(word)) score += 25;
      }

      if (score > bestScore) {
        bestScore = score;
        bestInstructor = instructor;
      }
    }

    if (bestInstructor && bestScore >= 25) {
      result[course.code] = bestInstructor;
    }
  }

  return result;
}

function sectionsConflict(a, b) {
  for (const m1 of a.meetings || []) {
    for (const m2 of b.meetings || []) {
      if (m1.d !== m2.d) continue;
      if (toMin(m1.s) < toMin(m2.e) && toMin(m2.s) < toMin(m1.e)) return true;
    }
  }
  return false;
}

function sectionPassesConstraints(section, freeDays, startMin, endMin) {
  for (const meeting of section.meetings || []) {
    if (freeDays.has(meeting.d)) return false;
    if (startMin !== null && startMin !== undefined && toMin(meeting.s) < startMin) return false;
    if (endMin !== null && endMin !== undefined && toMin(meeting.e) > endMin) return false;
  }
  return true;
}

function instructorMatches(sectionInstructor, preferredInstructor) {
  if (!preferredInstructor) return true;
  return normalizeText(sectionInstructor).includes(normalizeText(preferredInstructor));
}

function getSectionFilterProblem(courseList, freeDays, startMin, endMin, preferredInstructors, tr) {
  const dayNames = tr ? DAY_NAMES_TR : DAY_NAMES_EN;

  for (const course of courseList) {
    const preferredInstructor = preferredInstructors[course.code];
    let instructorCandidates = [...(course.sections || [])];

    if (preferredInstructor) {
      instructorCandidates = instructorCandidates.filter((section) =>
        instructorMatches(section.instructor, preferredInstructor)
      );
    }

    if (instructorCandidates.length === 0) {
      return tr
        ? `${course.code} için ${preferredInstructor} hocasına ait section bulamadım.`
        : `I could not find a section for ${course.code} with ${preferredInstructor}.`;
    }

    const validCandidates = instructorCandidates.filter((section) =>
      sectionPassesConstraints(section, freeDays, startMin, endMin)
    );

    if (validCandidates.length === 0) {
      const detailParts = [];

      if (preferredInstructor) {
        detailParts.push(tr ? `${preferredInstructor} hocası özelinde` : `with ${preferredInstructor}`);
      }

      if (startMin !== null && startMin !== undefined) {
        detailParts.push(tr ? `${minutesToTime(startMin)} öncesi olmayan` : `not before ${minutesToTime(startMin)}`);
      }

      if (endMin !== null && endMin !== undefined) {
        detailParts.push(tr ? `${minutesToTime(endMin)} sonrası olmayan` : `not after ${minutesToTime(endMin)}`);
      }

      if (freeDays.size > 0) {
        const days = [...freeDays].map((day) => dayNames[day]).join(", ");
        detailParts.push(tr ? `${days} günü boş kalacak şekilde` : `keeping ${days} free`);
      }

      const availableText = instructorCandidates
        .map((section) => {
          const meetings = (section.meetings || [])
            .map((meeting) => `${dayNames[meeting.d] || ""} ${meeting.s}-${meeting.e}`.trim())
            .join(", ");
          return `§${section.id} ${meetings}`.trim();
        })
        .join("; ");

      return tr
        ? `${course.code} için ${detailParts.join(", ")} uygun section yok. Mevcut sectionlar: ${availableText || "—"}. İstersen hoca tercihini "fark etmez" yapabilir ya da saat/gün tercihini gevşetebilirsin.`
        : `There is no suitable section for ${course.code} ${detailParts.join(", ")}. Available sections: ${availableText || "—"}. You can remove the instructor preference or relax the time/day preference.`;
    }
  }

  return tr
    ? "Bu tercihlerle çakışmasız bir program bulamadım. Saat/gün ya da hoca tercihini gevşeterek tekrar deneyebilirsin."
    : "I could not find a conflict-free schedule with these preferences. Try relaxing the instructor, time, or day preference.";
}

function getConstraintViolations(section, freeDays, startMin, endMin, tr) {
  const dayNames = tr ? DAY_NAMES_TR : DAY_NAMES_EN;
  const violations = [];

  for (const meeting of section.meetings || []) {
    if (freeDays.has(meeting.d)) {
      const dayName = dayNames[meeting.d] || "";
      const text = tr ? `${dayName} boş kalsın tercihine uymuyor` : `does not keep ${dayName} free`;
      if (!violations.includes(text)) violations.push(text);
    }

    if (startMin !== null && startMin !== undefined && toMin(meeting.s) < startMin) {
      const text = tr ? `${minutesToTime(startMin)} öncesi başlıyor` : `starts before ${minutesToTime(startMin)}`;
      if (!violations.includes(text)) violations.push(text);
    }

    if (endMin !== null && endMin !== undefined && toMin(meeting.e) > endMin) {
      const text = tr ? `${minutesToTime(endMin)} sonrası bitiyor` : `ends after ${minutesToTime(endMin)}`;
      if (!violations.includes(text)) violations.push(text);
    }
  }

  return violations;
}

function getRelaxedSectionOptions(courseList, freeDays, startMin, endMin, preferredInstructors, tr) {
  if (courseList.length !== 1) return [];

  const course = courseList[0];
  const preferredInstructor = preferredInstructors[course.code];
  let candidates = [...(course.sections || [])];

  if (preferredInstructor) {
    candidates = candidates.filter((section) => instructorMatches(section.instructor, preferredInstructor));
  }

  return candidates
    .map((section) => ({
      course,
      section,
      violations: getConstraintViolations(section, freeDays, startMin, endMin, tr),
    }))
    .sort((a, b) => a.violations.length - b.violations.length || String(a.section.id).localeCompare(String(b.section.id)))
    .slice(0, 6);
}

function formatSectionMeetings(section, tr) {
  const dayNames = tr ? DAY_NAMES_TR : DAY_NAMES_EN;
  return (section?.meetings || [])
    .map((meeting) => `${dayNames[meeting.d] || ""} ${meeting.s}-${meeting.e}`.trim())
    .join(", ");
}

function getSectionsForPreference(course, instPrefs) {
  if (!course) return [];

  const preferredInstructor = instPrefs?.[course.code];
  let sections = [...(course.sections || [])];

  if (preferredInstructor) {
    sections = sections.filter((section) =>
      instructorMatches(section.instructor, preferredInstructor)
    );
  }

  return sections.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function formatSectionOption(section, tr) {
  const meetings = formatSectionMeetings(section, tr) || (tr ? "Saat bilgisi yok" : "No meeting time");
  const instructor = section?.instructor || (tr ? "Hoca bilgisi yok" : "No instructor info");
  return `§${section?.id || "—"} — ${instructor} — ${meetings}`;
}

function buildSchedule(courseList, freeDays, startMin, endMin, preferredInstructors) {
  function getCandidates(course) {
    const preferredInstructor = preferredInstructors[course.code];
    let candidates = [...(course.sections || [])];

    // Hoca tercihi varsa önce sadece o hocanın sectionları alınır.
    // Hoca tercihi yoksa tüm sectionlar saat/gün filtrelerine devam eder.
    if (preferredInstructor) {
      candidates = candidates.filter((section) => instructorMatches(section.instructor, preferredInstructor));
    }

    // ÖNEMLİ: Saat/gün filtresinden sonra uygun section yoksa eski adaylara geri dönmüyoruz.
    // Çünkü kullanıcı "09:40 öncesi olmasın" dediyse 08:40 dersini önermemeliyiz.
    return candidates.filter((section) =>
      sectionPassesConstraints(section, freeDays, startMin, endMin)
    );
  }

  function backtrack(index, chosen) {
    if (index === courseList.length) return [...chosen];

    const course = courseList[index];
    const candidates = getCandidates(course);

    for (const section of candidates) {
      if (chosen.some((item) => sectionsConflict(item.section, section))) continue;

      chosen.push({ code: course.code, sectionId: section.id, section });
      const result = backtrack(index + 1, chosen);
      if (result) return result;
      chosen.pop();
    }

    return null;
  }

  return backtrack(0, []);
}

const PROGRESS_STEPS = ["courses", "instructor", "sectionSelect", "sectionConfirm"];

export default function ChatBot({ lang, courses, onApply, onClose }) {
  const tr = lang === "tr";

  const GREET = tr
    ? "Merhaba! 👋 Sana ders programı oluşturmana yardım edeyim.\n\nHangi dersi almak istiyorsun? Ders kodunu ya da ismini yazabilirsin. Örn: 5610202, MATH120, mühendislik matematiği"
    : "Hey! 👋 Let me help you build your course schedule.\n\nWhich course do you want to take? You can write the course code or name.";

  const [messages, setMessages] = useState([{ role: "bot", text: GREET }]);
  const [step, setStep] = useState("courses");
  const [input, setInput] = useState("");

  const [courseOptions, setCourseOptions] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [instructorOptions, setInstructorOptions] = useState([]);
  const [preferredInstructors, setPreferredInstructors] = useState({});
  const [timeConstraints, setTimeConstraints] = useState({ startMin: null, endMin: null });
  const [freeDays, setFreeDays] = useState(new Set());
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [scheduleError, setScheduleError] = useState(null);
  const [fallbackOptions, setFallbackOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [selectedSectionDraft, setSelectedSectionDraft] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingSchedule]);

  const pushBot = (text) => setMessages((prev) => [...prev, { role: "bot", text }]);
  const pushUser = (text) => setMessages((prev) => [...prev, { role: "user", text }]);

  const resetChat = () => {
    setMessages([{ role: "bot", text: GREET }]);
    setStep("courses");
    setInput("");
    setCourseOptions([]);
    setSelectedCourses([]);
    setInstructorOptions([]);
    setPreferredInstructors({});
    setTimeConstraints({ startMin: null, endMin: null });
    setFreeDays(new Set());
    setPendingSchedule(null);
    setScheduleError(null);
    setFallbackOptions([]);
    setSectionOptions([]);
    setSelectedSectionDraft(null);
  };

  const goToInstructorStep = (pickedCourses) => {
    setSelectedCourses(pickedCourses);

    const courseListText = pickedCourses
      .map((course) => `• ${course.code} — ${getCourseTitle(course, tr)}`)
      .join("\n");

    if (pickedCourses.length === 1) {
      const instructors = getUniqueInstructors(pickedCourses[0]);
      setInstructorOptions(instructors);

      if (instructors.length === 0) {
        pushBot(
          tr
            ? `Seçilen ders:
${courseListText}

Bu ders için hoca bilgisi bulamadım. Mevcut sectionları listeleyeceğim.`
            : `Selected course:
${courseListText}

I could not find instructor info for this course. I will list the available sections.`
        );
        setTimeout(() => goToSectionStep({}, pickedCourses), 0);
        return;
      }

      const instructorText = instructors.map((name, index) => `${index + 1}. ${name}`).join("\n");
      pushBot(
        tr
          ? `Seçilen ders:\n${courseListText}\n\nBu dersi veren hocalar:\n\n${instructorText}\n${instructors.length + 1}. Hoca tercihim yok / fark etmez\n\nBir hoca numarası yazabilirsin ya da "fark etmez" diyebilirsin.`
          : `Selected course:\n${courseListText}\n\nInstructors:\n\n${instructorText}\n${instructors.length + 1}. No instructor preference\n\nType an instructor number or say "doesn't matter".`
      );
      setStep("instructor");
      return;
    }

    const instructorList = pickedCourses
      .map((course) => {
        const names = getUniqueInstructors(course);
        return `• ${course.code}: ${names.length > 0 ? names.join(", ") : "—"}`;
      })
      .join("\n");

    setInstructorOptions([]);
    pushBot(
      tr
        ? `Seçilen dersler:\n${courseListText}\n\nHoca tercihin varsa hoca adını/soyadını yazabilirsin.\n\n${instructorList}\n\nHoca tercihin yoksa "fark etmez" yaz.`
        : `Selected courses:\n${courseListText}\n\nIf you have an instructor preference, write the instructor name/surname.\n\n${instructorList}\n\nOtherwise say "doesn't matter".`
    );
    setStep("instructor");
  };

  const goToSectionStep = (instPrefs = preferredInstructors, courseList = selectedCourses) => {
    if (courseList.length !== 1) {
      setStep("time");
      pushBot(
        tr
          ? `Tamam. Birden fazla ders seçtiğin için çakışmasız program oluşturacağım.

Saat tercihin var mı? Örn: "13:40 sonrası olsun", "09:40 öncesi olmasın" ya da "fark etmez".`
          : `Okay. Since you selected multiple courses, I will build a conflict-free schedule.

Any time preference? For example: "after 13:40" or "doesn't matter".`
      );
      return;
    }

    const course = courseList[0];
    const options = getSectionsForPreference(course, instPrefs);
    setSectionOptions(options);
    setSelectedSectionDraft(null);
    setScheduleError(null);
    setPendingSchedule(null);
    setFallbackOptions([]);

    if (options.length === 0) {
      pushBot(
        tr
          ? `Bu tercih için uygun section bulamadım. Hoca tercihini "fark etmez" yapabilir ya da başka bir ders seçebilirsin.`
          : `I could not find a section for this preference. You can say "doesn't matter" for instructor or choose another course.`
      );
      setStep("instructor");
      return;
    }

    const optionText = options
      .map((section, index) => `${index + 1}. ${formatSectionOption(section, tr)}`)
      .join("\n");

    pushBot(
      tr
        ? `Uygun sectionlar bunlar. Hangisini eklemek istiyorsun? Numarasını yaz:

${optionText}`
        : `Here are the matching sections. Which one do you want to add? Type the number:

${optionText}`
    );
    setStep("sectionSelect");
  };

  const generateAndShow = (days, timeC, instPrefs) => {
    setScheduleError(null);
    setPendingSchedule(null);
    setFallbackOptions([]);

    const schedule = buildSchedule(
      selectedCourses,
      days,
      timeC.startMin,
      timeC.endMin,
      instPrefs
    );

    if (!schedule) {
      const errorMessage = getSectionFilterProblem(
        selectedCourses,
        days,
        timeC.startMin,
        timeC.endMin,
        instPrefs,
        tr
      );
      const relaxedOptions = getRelaxedSectionOptions(
        selectedCourses,
        days,
        timeC.startMin,
        timeC.endMin,
        instPrefs,
        tr
      );

      setScheduleError(errorMessage);
      setFallbackOptions(relaxedOptions);
      pushBot(
        relaxedOptions.length > 0
          ? `${errorMessage}

Yine de mevcut sectionları aşağıya koydum. İstersen birini seçip takvime uygulayabilirsin.`
          : errorMessage
      );
      return;
    }

    setPendingSchedule(schedule);
    pushBot(
      tr
        ? "Program hazır! ✅ Aşağıdan takvime uygulayabilirsin."
        : "Schedule is ready! ✅ You can apply it to the calendar below."
    );
  };

  const processStep = (currentStep, text) => {
    if (currentStep === "courses") {
      const foundCourses = searchCourses(text, courses);

      if (foundCourses.length === 0) {
        pushBot(
          tr
            ? "Bu isimle bir ders bulamadım 🤔 Ders kodunu veya adını biraz daha net yazar mısın? Örn: 5610202, MATH120, mühendislik matematiği"
            : "I couldn't find a course with that text 🤔 Could you write the code or name more clearly?"
        );
        return;
      }

      setCourseOptions(foundCourses);
      setStep("courseSelect");

      const optionsText = foundCourses
        .map((course, index) => `${index + 1}. ${course.code} — ${getCourseTitle(course, tr)}`)
        .join("\n");

      pushBot(
        tr
          ? `Birkaç ders buldum, hangisini istiyorsun? Numarasını yaz:\n\n${optionsText}\n\nBirden fazlasını istiyorsan numaraları virgülle yazabilirsin. Örn: 1, 3`
          : `I found a few matches. Which one do you want? Type the number:\n\n${optionsText}\n\nFor multiple courses, write numbers with commas. Ex: 1, 3`
      );
      return;
    }

    if (currentStep === "courseSelect") {
      const pickedIndexes = parsePickedNumbers(text, courseOptions.length);

      if (pickedIndexes.length === 0) {
        pushBot(tr ? "Lütfen listedeki ders numarasını yaz. Örn: 1" : "Please type a course number from the list. Ex: 1");
        return;
      }

      const pickedCourses = pickedIndexes.map((index) => courseOptions[index]).filter(Boolean);
      setCourseOptions([]);
      goToInstructorStep(pickedCourses);
      return;
    }

    if (currentStep === "instructor") {
      const noPreferenceIndex = selectedCourses.length === 1 ? getUniqueInstructors(selectedCourses[0]).length + 1 : null;
      const firstNumber = Number((text.match(/\d+/) || [])[0]);
      const userSaidNoPreference = isNoPreference(text) || (noPreferenceIndex !== null && firstNumber === noPreferenceIndex);

      let instPrefs = {};

      if (!userSaidNoPreference) {
        instPrefs = parseInstructorPreference(text, selectedCourses, instructorOptions);

        if (Object.keys(instPrefs).length === 0) {
          pushBot(
            tr
              ? "Hocayı anlayamadım. Listedeki hoca numarasını yazabilir ya da hoca tercihin yoksa 'fark etmez' diyebilirsin."
              : "I couldn't understand the instructor. Type an instructor number or say 'doesn't matter'."
          );
          return;
        }
      }

      setPreferredInstructors(instPrefs);

      const selectedTeacherText = Object.values(instPrefs).join(", ");
      pushBot(
        tr
          ? `${selectedTeacherText ? `${selectedTeacherText} hocasını tercih ettin.` : "Tamam, hoca tercihini dikkate almayacağım."}`
          : `${selectedTeacherText ? `Preferred instructor: ${selectedTeacherText}.` : "Okay, I won't filter by instructor."}`
      );

      goToSectionStep(instPrefs, selectedCourses);
      return;
    }

    if (currentStep === "sectionSelect") {
      const pickedIndexes = parsePickedNumbers(text, sectionOptions.length);

      if (pickedIndexes.length === 0) {
        pushBot(tr ? "Lütfen listedeki section numarasını yaz. Örn: 1" : "Please type a section number from the list. Ex: 1");
        return;
      }

      const section = sectionOptions[pickedIndexes[0]];
      const course = selectedCourses[0];

      if (!section || !course) {
        pushBot(tr ? "Section seçimini bulamadım. Lütfen tekrar dene." : "I could not find that section. Please try again.");
        return;
      }

      setSelectedSectionDraft({ course, section });
      setStep("sectionConfirm");

      pushBot(
        tr
          ? `${course.code} için ${formatSectionOption(section, tr)} seçtin.

Aşağıdan "Ekle ve Devam Et" ya da "Ekle ve Çık" seçebilirsin.`
          : `You selected ${formatSectionOption(section, tr)} for ${course.code}.

Choose "Add and Continue" or "Add and Exit" below.`
      );
      return;
    }

    if (currentStep === "time") {
      const parsedTime = parseTimeConstraints(text);
      setTimeConstraints(parsedTime);

      let summary = tr ? "Tamam! " : "Got it! ";
      if (parsedTime.startMin !== null) summary += tr ? `${minutesToTime(parsedTime.startMin)} öncesi ders olmasın. ` : `No classes before ${minutesToTime(parsedTime.startMin)}. `;
      if (parsedTime.endMin !== null) summary += tr ? `${minutesToTime(parsedTime.endMin)} sonrası ders olmasın. ` : `No classes after ${minutesToTime(parsedTime.endMin)}. `;
      if (parsedTime.startMin === null && parsedTime.endMin === null) summary += tr ? "Saat kısıtı yok. " : "No time constraint. ";

      pushBot(
        summary +
          (tr
            ? "\nHangi günler boş kalsın? Örn: 'Cuma boş kalsın', 'Pazartesi olmasın' ya da 'hepsi uygun'."
            : "\nWhich days should stay free? Ex: 'keep Friday free' or 'all days are fine'.")
      );
      setStep("days");
      return;
    }

    if (currentStep === "days") {
      const days = isNoPreference(text) || /hepsi|hepsinde|all|her gun|her gün/i.test(text)
        ? new Set()
        : parseDays(text);

      setFreeDays(days);

      const dayNames = tr ? DAY_NAMES_TR : DAY_NAMES_EN;
      const dayList = days.size > 0
        ? [...days].map((day) => dayNames[day]).join(", ")
        : tr ? "Yok, her gün uygun" : "None, all days are fine";

      pushBot(
        tr
          ? `Boş gün tercihi: ${dayList}\n\nProgramı oluşturuyorum... ⏳`
          : `Free day preference: ${dayList}\n\nBuilding the schedule... ⏳`
      );
      setStep("confirm");
      setTimeout(() => generateAndShow(days, timeConstraints, preferredInstructors), 250);
      return;
    }

    if (currentStep === "sectionConfirm") {
      if (/devam|continue/i.test(text)) {
        handleApplySelectedSection(false);
      } else if (/cik|çık|exit|kapat|close/i.test(text)) {
        handleApplySelectedSection(true);
      }
      return;
    }

    if (currentStep === "confirm") {
      if (/tekrar|yeniden|again|redo|reset|restart|yeni/i.test(text)) {
        resetChat();
      }
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setInput("");
    pushUser(text);
    processStep(step, text);
  };

  const handleApply = () => {
    if (!pendingSchedule) return;
    onApply(pendingSchedule.map(({ code, sectionId }) => ({ code, sectionId })));
    onClose();
  };

  const clearForNextCourse = () => {
    setStep("courses");
    setInput("");
    setCourseOptions([]);
    setSelectedCourses([]);
    setInstructorOptions([]);
    setPreferredInstructors({});
    setSectionOptions([]);
    setSelectedSectionDraft(null);
    setTimeConstraints({ startMin: null, endMin: null });
    setFreeDays(new Set());
    setPendingSchedule(null);
    setScheduleError(null);
    setFallbackOptions([]);
  };

  const handleApplySelectedSection = (shouldClose) => {
    if (!selectedSectionDraft?.course || !selectedSectionDraft?.section) return;

    onApply([{
      code: selectedSectionDraft.course.code,
      sectionId: selectedSectionDraft.section.id,
    }]);

    if (shouldClose) {
      onClose();
      return;
    }

    const addedCode = selectedSectionDraft.course.code;
    clearForNextCourse();
    pushBot(
      tr
        ? `${addedCode} takvime eklendi ✅

Başka bir ders eklemek ister misin? Ders kodunu ya da adını yazabilirsin.`
        : `${addedCode} was added to the calendar ✅

Would you like to add another course? Type the course code or name.`
    );
  };

  const handleApplyFallback = (option) => {
    if (!option?.course || !option?.section) return;
    onApply([{ code: option.course.code, sectionId: option.section.id }]);
    onClose();
  };

  const relaxTimeAndRetry = () => {
    const relaxedTime = { startMin: null, endMin: null };
    setTimeConstraints(relaxedTime);
    pushUser(tr ? "Saat tercihini gevşet" : "Relax time preference");
    pushBot(tr ? "Tamam, saat tercihini kaldırıp tekrar deniyorum..." : "Okay, I will remove the time preference and try again...");
    setTimeout(() => generateAndShow(freeDays, relaxedTime, preferredInstructors), 150);
  };

  const relaxDaysAndRetry = () => {
    const relaxedDays = new Set();
    setFreeDays(relaxedDays);
    pushUser(tr ? "Gün tercihini gevşet" : "Relax day preference");
    pushBot(tr ? "Tamam, boş gün tercihini kaldırıp tekrar deniyorum..." : "Okay, I will remove the free-day preference and try again...");
    setTimeout(() => generateAndShow(relaxedDays, timeConstraints, preferredInstructors), 150);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const quickReplies = () => {
    if (step === "instructor") return tr ? ["Fark etmez"] : ["Doesn't matter"];
    if (step === "time") {
      return tr
        ? ["13:40 sonrası olsun", "09:40 öncesi olmasın", "Fark etmez"]
        : ["After 13:40", "Nothing before 09:40", "Doesn't matter"];
    }
    if (step === "days") {
      return tr
        ? ["Pazartesi boş kalsın", "Salı boş kalsın", "Çarşamba boş kalsın", "Perşembe boş kalsın", "Cuma boş kalsın", "Hepsi uygun"]
        : ["Keep Monday free", "Keep Tuesday free", "Keep Wednesday free", "Keep Thursday free", "Keep Friday free", "All days fine"];
    }
    if (step === "sectionConfirm" && selectedSectionDraft) return tr ? ["Ekle ve devam et", "Ekle ve çık"] : ["Add and continue", "Add and exit"];
    if (step === "confirm" && pendingSchedule) return tr ? ["Tekrar oluştur"] : ["Restart"];
    return [];
  };

  const currentProgressStep = step === "courseSelect" ? "courses" : (["time", "days", "confirm"].includes(step) ? "sectionConfirm" : step);

  return (
    <div className="ai-panel-overlay" onClick={onClose}>
      <div className="ai-panel chatbot-panel" onClick={(event) => event.stopPropagation()}>
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <span className="ai-sparkle">💬</span>
            {tr ? "Schedule AI — Ders Programı Asistanı" : "Schedule AI — Course Assistant"}
          </div>
          <button className="ai-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="chatbot-progress">
          {PROGRESS_STEPS.map((progressStep, index) => {
            const labels = tr
              ? ["Ders", "Hoca", "Section", "Ekle"]
              : ["Course", "Instructor", "Section", "Add"];
            const currentIndex = PROGRESS_STEPS.indexOf(currentProgressStep);
            const thisIndex = PROGRESS_STEPS.indexOf(progressStep);

            return (
              <div
                key={progressStep}
                className={`chatbot-progress-step${thisIndex <= currentIndex ? " done" : ""}${thisIndex === currentIndex ? " active" : ""}`}
              >
                <div className="chatbot-progress-dot">{thisIndex < currentIndex ? "✓" : index + 1}</div>
                <span>{labels[index]}</span>
              </div>
            );
          })}
        </div>

        <div className="chatbot-messages">
          {messages.map((message, index) => (
            <div key={index} className={`chatbot-bubble chatbot-bubble-${message.role}`}>
              {message.role === "bot" && <div className="chatbot-avatar">✦</div>}
              <div className="chatbot-text">
                {message.text.split("\n").map((line, lineIndex, lines) => (
                  <React.Fragment key={lineIndex}>
                    {line}
                    {lineIndex < lines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}

          {selectedSectionDraft && (
            <div className="chatbot-schedule-card">
              <div className="chatbot-schedule-title">
                {tr ? "✅ Section seçildi" : "✅ Section selected"}
              </div>

              <div className="chatbot-schedule-list">
                <div className="chatbot-schedule-row">
                  <span className="chatbot-schedule-code">{selectedSectionDraft.course.code}</span>
                  <span className="chatbot-schedule-sec">§{selectedSectionDraft.section.id}</span>
                  <span className="chatbot-schedule-instructor">{selectedSectionDraft.section?.instructor || "—"}</span>
                  <span className="chatbot-schedule-time" style={{ minWidth: 190, textAlign: "left" }}>
                    {formatSectionMeetings(selectedSectionDraft.section, tr)}
                  </span>
                </div>
              </div>

              <button
                className="ai-generate-btn"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => handleApplySelectedSection(false)}
              >
                <span>✦</span> {tr ? "Ekle ve Devam Et" : "Add and Continue"}
              </button>

              <button
                className="ai-cancel-btn"
                style={{ width: "100%", marginTop: 6 }}
                onClick={() => handleApplySelectedSection(true)}
              >
                {tr ? "Ekle ve Çık" : "Add and Exit"}
              </button>
            </div>
          )}

          {pendingSchedule && (
            <div className="chatbot-schedule-card">
              <div className="chatbot-schedule-title">
                {tr ? "✅ Program hazır!" : "✅ Schedule ready!"}
              </div>

              <div className="chatbot-schedule-list">
                {pendingSchedule.map(({ code, sectionId, section }) => (
                  <div key={`${code}-${sectionId}`} className="chatbot-schedule-row">
                    <span className="chatbot-schedule-code">{code}</span>
                    <span className="chatbot-schedule-sec">§{sectionId}</span>
                    <span className="chatbot-schedule-instructor">{section?.instructor || "—"}</span>
                    <span className="chatbot-schedule-time">
                      {section?.meetings?.[0] ? `${section.meetings[0].s}–${section.meetings[0].e}` : ""}
                    </span>
                  </div>
                ))}
              </div>

              <button className="ai-generate-btn" style={{ width: "100%", marginTop: 10 }} onClick={handleApply}>
                <span>✦</span> {tr ? "Takvime Uygula" : "Apply to Calendar"}
              </button>

              <button className="ai-cancel-btn" style={{ width: "100%", marginTop: 6 }} onClick={resetChat}>
                {tr ? "Yeniden Oluştur" : "Start Over"}
              </button>
            </div>
          )}

          {scheduleError && !pendingSchedule && (
            <div className="chatbot-schedule-card">
              <div className="chatbot-schedule-title">⚠️ {tr ? "Program bulunamadı" : "No schedule found"}</div>

              {fallbackOptions.length > 0 && (
                <div className="chatbot-schedule-list">
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    {tr ? "Mevcut sectionlar — bunu ister misin?" : "Available sections — would you like one of these?"}
                  </div>

                  {fallbackOptions.map((option) => (
                    <div key={`${option.course.code}-${option.section.id}`} className="chatbot-schedule-row" style={{ alignItems: "flex-start" }}>
                      <span className="chatbot-schedule-code">{option.course.code}</span>
                      <span className="chatbot-schedule-sec">§{option.section.id}</span>
                      <span className="chatbot-schedule-instructor">{option.section?.instructor || "—"}</span>
                      <span className="chatbot-schedule-time" style={{ minWidth: 190, textAlign: "left" }}>
                        {formatSectionMeetings(option.section, tr)}
                        {option.violations.length > 0 && (
                          <small style={{ display: "block", marginTop: 4, opacity: 0.75 }}>
                            {tr ? "Uymayan tercih: " : "Conflict: "}{option.violations.join(", ")}
                          </small>
                        )}
                      </span>
                      <button
                        className="ai-generate-btn"
                        style={{ padding: "8px 12px", whiteSpace: "nowrap" }}
                        onClick={() => handleApplyFallback(option)}
                      >
                        {tr ? "Bunu Uygula" : "Apply This"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {timeConstraints.startMin !== null || timeConstraints.endMin !== null ? (
                  <button className="ai-cancel-btn" style={{ width: "100%" }} onClick={relaxTimeAndRetry}>
                    {tr ? "Saat Tercihini Gevşet ve Tekrar Dene" : "Relax Time Preference and Try Again"}
                  </button>
                ) : null}

                {freeDays.size > 0 ? (
                  <button className="ai-cancel-btn" style={{ width: "100%" }} onClick={relaxDaysAndRetry}>
                    {tr ? "Gün Tercihini Gevşet ve Tekrar Dene" : "Relax Day Preference and Try Again"}
                  </button>
                ) : null}

                <button className="ai-cancel-btn" style={{ width: "100%" }} onClick={resetChat}>
                  {tr ? "En Baştan Başla" : "Start Over"}
                </button>
              </div>
            </div>
          )}

          {quickReplies().length > 0 && !pendingSchedule && (
            <div className="chatbot-quick-replies">
              {quickReplies().map((reply) => (
                <button
                  key={reply}
                  className="chatbot-quick-btn"
                  onClick={() => {
                    pushUser(reply);
                    processStep(step, reply);
                  }}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="chatbot-input-row">
          <input
            ref={inputRef}
            className="chatbot-input"
            type="text"
            placeholder={tr ? "Mesajını yaz…" : "Type your message…"}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button className="chatbot-send-btn" onClick={handleSend} disabled={!input.trim()}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M2 9L16 9M16 9L10 3M16 9L10 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
