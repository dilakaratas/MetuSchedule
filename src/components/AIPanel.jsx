import React, { useState, useMemo } from "react";
import { toMin, sectionsConflict } from "../utils.js";

const DAYS_SHORT_TR = ["PZT", "SAL", "ÇAR", "PER", "CUM"];
const DAYS_SHORT_EN = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_KEYS = [0, 1, 2, 3, 4];
const TIME_OPTIONS = ["08:40", "09:40", "10:40", "11:40", "12:40", "13:40", "14:40", "15:40", "16:40", "17:40"];

const DAY_WORDS = [
  { key: 0, words: ["pazartesi", "pzt", "monday", "mon"] },
  { key: 1, words: ["salı", "sali", "sal", "tuesday", "tue"] },
  { key: 2, words: ["çarşamba", "carsamba", "çar", "car", "wednesday", "wed"] },
  { key: 3, words: ["perşembe", "persembe", "per", "thursday", "thu"] },
  { key: 4, words: ["cuma", "cum", "friday", "fri"] },
];

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function splitTeacherNames(value) {
  return String(value || "")
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function instructorMatches(instructor, names) {
  const hay = normalizeText(instructor);
  return names.some((name) => {
    const needle = normalizeText(name);
    return needle.length >= 2 && hay.includes(needle);
  });
}

function sectionPassesConstraints(section, freeDays, earliestStart, latestEnd) {
  for (const m of section.meetings) {
    if (freeDays.has(m.d)) return false;
    if (earliestStart && toMin(m.s) < toMin(earliestStart)) return false;
    if (latestEnd && toMin(m.e) > toMin(latestEnd)) return false;
  }
  return true;
}

function dailyHours(sections) {
  const byDay = {};
  for (const sec of sections) {
    for (const m of sec.meetings) {
      const dur = (toMin(m.e) - toMin(m.s)) / 60;
      byDay[m.d] = (byDay[m.d] || 0) + dur;
    }
  }
  return Math.max(...Object.values(byDay), 0);
}

function scheduleStats(schedule) {
  const byDay = {};

  for (const item of schedule) {
    for (const m of item.section.meetings) {
      if (!byDay[m.d]) byDay[m.d] = [];
      byDay[m.d].push({ start: toMin(m.s), end: toMin(m.e), code: item.code });
    }
  }

  let totalGap = 0;
  let maxGap = 0;
  let singleCourseDays = 0;
  const campusDays = Object.keys(byDay).length;

  Object.values(byDay).forEach((meetings) => {
    const sorted = meetings.sort((a, b) => a.start - b.start);
    const courseCount = new Set(sorted.map((m) => m.code)).size;
    if (courseCount === 1) singleCourseDays += 1;

    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.max(0, sorted[i].start - sorted[i - 1].end);
      totalGap += gap;
      maxGap = Math.max(maxGap, gap);
    }
  });

  return { campusDays, totalGap, maxGap, singleCourseDays };
}

function scoreSchedule(schedule, options) {
  const stats = scheduleStats(schedule);
  const preferredTeachers = splitTeacherNames(options.preferredTeachers);
  let score = 1000;

  if (options.maxCampusDays) {
    score -= Math.max(0, stats.campusDays - options.maxCampusDays) * 120;
    score += Math.max(0, options.maxCampusDays - stats.campusDays) * 20;
  }

  if (options.maxGapMinutes) {
    score -= Math.max(0, stats.maxGap - options.maxGapMinutes) * 2;
  }

  if (options.avoidSingleCourseDay) {
    score -= stats.singleCourseDays * 80;
  }

  if (options.compactMode === "compact") {
    score -= stats.totalGap * 1.2;
  }

  if (options.compactMode === "spaced") {
    const shortGapPenalty = Math.max(0, 60 - stats.maxGap);
    score -= shortGapPenalty;
  }

  for (const item of schedule) {
    const instructor = item.section.instructor || "";
    if (instructorMatches(instructor, preferredTeachers)) score += 90;
  }

  return score;
}

function findBestSchedule(courseList, options) {
  const result = [];
  const maxResults = 350;

  function backtrack(idx, chosen) {
    if (result.length >= maxResults) return true;

    if (idx === courseList.length) {
      result.push([...chosen]);
      return false;
    }

    const course = courseList[idx];
    const validSections = course.sections.filter((s) =>
      sectionPassesConstraints(s, options.freeDays, options.earliestStart, options.latestEnd)
    );
    const candidates = validSections.length > 0 ? validSections : course.sections;

    for (const sec of candidates) {
      const hasConflict = chosen.some((c) => !!sectionsConflict(c.section, sec));
      if (hasConflict) continue;

      const chosenSections = chosen.map((c) => c.section);
      if (dailyHours([...chosenSections, sec]) > options.maxDailyHours) continue;

      chosen.push({ code: course.code, sectionId: sec.id, section: sec });
      backtrack(idx + 1, chosen);
      chosen.pop();
    }

    return false;
  }

  backtrack(0, []);

  if (result.length === 0) return null;

  return result
    .map((schedule) => ({ schedule, score: scoreSchedule(schedule, options) }))
    .sort((a, b) => b.score - a.score)[0].schedule;
}

function getConstraintViolations(courseList, freeDays, earliestStart, latestEnd, lang) {
  const daysShort = lang === "tr" ? DAYS_SHORT_TR : DAYS_SHORT_EN;
  const violations = [];

  for (const course of courseList) {
    const hasValid = course.sections.some((s) =>
      sectionPassesConstraints(s, freeDays, earliestStart, latestEnd)
    );
    if (hasValid) continue;

    const reasons = [];

    if (freeDays.size > 0) {
      const blockedDays = [...freeDays].filter((d) =>
        course.sections.every((s) => s.meetings.some((m) => m.d === d))
      );
      if (blockedDays.length > 0) {
        const names = blockedDays.map((d) => daysShort[d]).join(", ");
        reasons.push(lang === "tr" ? `tüm şubeleri ${names} günü var` : `all sections on ${names}`);
      }
    }

    if (earliestStart) {
      const allEarly = course.sections.every((s) =>
        s.meetings.some((m) => toMin(m.s) < toMin(earliestStart))
      );
      if (allEarly) reasons.push(lang === "tr" ? `tüm şubeleri ${earliestStart} öncesi başlıyor` : `all sections start before ${earliestStart}`);
    }

    if (latestEnd) {
      const allLate = course.sections.every((s) =>
        s.meetings.some((m) => toMin(m.e) > toMin(latestEnd))
      );
      if (allLate) reasons.push(lang === "tr" ? `tüm şubeleri ${latestEnd} sonrası bitiyor` : `all sections end after ${latestEnd}`);
    }

    if (reasons.length > 0) violations.push({ code: course.code, reasons });
  }

  return violations;
}

function parsePreferenceText(text, allTeachers, lang) {
  const raw = String(text || "");
  const normalized = normalizeText(raw);
  const parsed = { notes: [] };

  const freeDays = new Set();
  for (const day of DAY_WORDS) {
    const matched = day.words.some((word) => normalized.includes(normalizeText(word)));
    if (matched && /(bos|free|off|olmasin|istemiyorum|kalmasin|kalsin)/.test(normalized)) {
      freeDays.add(day.key);
    }
  }
  if (freeDays.size > 0) parsed.freeDays = freeDays;

  const dailyHourMatch = normalized.match(/gunluk[^0-9]*(\d{1,2})\s*(saat|hour|hrs?)/) || normalized.match(/max[^0-9]*(\d{1,2})\s*(saat|hour|hrs?)/);
  if (dailyHourMatch) parsed.maxDailyHours = Math.min(10, Math.max(2, Number(dailyHourMatch[1])));

  const campusDayMatch = normalized.match(/hafta(?:lik|da)?[^0-9]*(?:en fazla|maksimum|max)?[^0-9]*(\d)\s*(gun|day)/) || normalized.match(/(\d)\s*(gun|day)[^\.\n]*(okul|kampus|campus)/);
  if (campusDayMatch) parsed.maxCampusDays = Math.min(5, Math.max(1, Number(campusDayMatch[1])));

  const gapMatch = normalized.match(/bosluk[^0-9]*(\d{1,2})\s*(saat|hour|dk|dakika|min)/) || normalized.match(/ara[^0-9]*(\d{1,2})\s*(saat|hour|dk|dakika|min)/);
  if (gapMatch) {
    const value = Number(gapMatch[1]);
    parsed.maxGapMinutes = /dk|dakika|min/.test(gapMatch[2]) ? value : value * 60;
  }

  if (/(sabah|early|erken)/.test(normalized) && /(olmasin|istemiyorum|istemem|no|avoid)/.test(normalized)) {
    parsed.earliestStart = "09:40";
  }
  if (/(gec|aksam|late|evening)/.test(normalized) && /(olmasin|istemiyorum|istemem|no|avoid)/.test(normalized)) {
    parsed.latestEnd = "15:40";
  }

  const explicitEarliest = normalized.match(/(?:en erken|sonra basla|start after|after)\D*(\d{1,2})[:.]?(\d{2})?/);
  if (explicitEarliest) {
    const h = explicitEarliest[1].padStart(2, "0");
    const m = explicitEarliest[2] || "40";
    parsed.earliestStart = `${h}:${m}`;
  }

  const explicitLatest = normalized.match(/(?:en gec|once bitsin|bitis|end before|before)\D*(\d{1,2})[:.]?(\d{2})?/);
  if (explicitLatest) {
    const h = explicitLatest[1].padStart(2, "0");
    const m = explicitLatest[2] || "40";
    parsed.latestEnd = `${h}:${m}`;
  }

  if (/(tek ders|1 ders|bir ders)/.test(normalized) && /(gelmek istemiyorum|olmasin|istemem|no)/.test(normalized)) {
    parsed.avoidSingleCourseDay = true;
  }

  if (/(arka arkaya|pes pese|compact|sikistir)/.test(normalized)) parsed.compactMode = "compact";
  if (/(aralikli|mola|break|spaced)/.test(normalized)) parsed.compactMode = "spaced";

  const preferred = [];
  for (const teacher of allTeachers) {
    const teacherNorm = normalizeText(teacher);
    if (!teacherNorm) continue;
    const idx = normalized.indexOf(teacherNorm);
    if (idx === -1) continue;
    const windowText = normalized.slice(Math.max(0, idx - 30), Math.min(normalized.length, idx + teacherNorm.length + 40));
    if (/(tercih|istiyorum|olsun|preferred|want)/.test(windowText)) preferred.push(teacher);
  }

  if (preferred.length > 0) parsed.preferredTeachers = preferred.join(", ");
  return parsed;
}

function summarizeParsed(parsed, lang) {
  const daysShort = lang === "tr" ? DAYS_SHORT_TR : DAYS_SHORT_EN;
  const notes = [];

  if (parsed.freeDays?.size > 0) notes.push(`${lang === "tr" ? "Boş gün" : "Free day"}: ${[...parsed.freeDays].map((d) => daysShort[d]).join(", ")}`);
  if (parsed.maxDailyHours) notes.push(`${lang === "tr" ? "Günlük maks." : "Daily max"}: ${parsed.maxDailyHours} ${lang === "tr" ? "saat" : "hrs"}`);
  if (parsed.earliestStart) notes.push(`${lang === "tr" ? "En erken başlangıç" : "Earliest start"}: ${parsed.earliestStart}`);
  if (parsed.latestEnd) notes.push(`${lang === "tr" ? "En geç bitiş" : "Latest end"}: ${parsed.latestEnd}`);
  if (parsed.maxCampusDays) notes.push(`${lang === "tr" ? "Maks. kampüs günü" : "Max campus days"}: ${parsed.maxCampusDays}`);
  if (parsed.maxGapMinutes) notes.push(`${lang === "tr" ? "Maks. boşluk" : "Max gap"}: ${parsed.maxGapMinutes} dk`);
  if (parsed.avoidSingleCourseDay) notes.push(lang === "tr" ? "Tek ders için kampüse gelme azaltıldı" : "Avoids single-course campus days");
  if (parsed.compactMode === "compact") notes.push(lang === "tr" ? "Dersler arka arkaya tercih edildi" : "Compact classes preferred");
  if (parsed.compactMode === "spaced") notes.push(lang === "tr" ? "Aralıklı ders tercih edildi" : "Breaks preferred");
  if (parsed.preferredTeachers) notes.push(`${lang === "tr" ? "Tercih edilen hoca" : "Preferred teacher"}: ${parsed.preferredTeachers}`);
  return notes;
}

export default function AIPanel({ lang, courses, onApply, onClose }) {
  const [freeDays, setFreeDays] = useState(new Set());
  const [maxDailyHours, setMaxDailyHours] = useState(8);
  const [earliestStart, setEarliestStart] = useState("");
  const [latestEnd, setLatestEnd] = useState("");
  const [maxCampusDays, setMaxCampusDays] = useState("");
  const [maxGapMinutes, setMaxGapMinutes] = useState("");
  const [avoidSingleCourseDay, setAvoidSingleCourseDay] = useState(false);
  const [compactMode, setCompactMode] = useState("any");
  const [preferredTeachers, setPreferredTeachers] = useState("");
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [courseSearch, setCourseSearch] = useState("");
  const [error, setError] = useState(null);
  const [violations, setViolations] = useState([]);
  const [pendingSchedule, setPendingSchedule] = useState(null);

  const daysShort = lang === "tr" ? DAYS_SHORT_TR : DAYS_SHORT_EN;

  const selectedCourseList = useMemo(() => {
    return [...selectedCourses]
      .map((code) => courses.find((c) => c.code === code))
      .filter(Boolean);
  }, [selectedCourses, courses]);

  const selectedTeachers = useMemo(() => {
    return [...new Set(
      selectedCourseList.flatMap((c) =>
        c.sections.map((s) => s.instructor).filter(Boolean)
      )
    )].sort((a, b) => a.localeCompare(b, "tr"));
  }, [selectedCourseList]);

  const toggleDay = (day) => {
    const next = new Set(freeDays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setFreeDays(next);
  };

  const toggleCourse = (code) => {
    const next = new Set(selectedCourses);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedCourses(next);
  };

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses.slice(0, 60);
    return courses.filter((c) =>
      `${c.code} ${c.name} ${c.nameTr || ""} ${c.sections.map((s) => s.instructor).join(" ")}`.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [courses, courseSearch]);

  const totalCredits = useMemo(() => {
    return [...selectedCourses].reduce((sum, code) => {
      const c = courses.find((c) => c.code === code);
      return sum + (c?.credits || 0);
    }, 0);
  }, [selectedCourses, courses]);

  const handleGenerate = () => {
    setError(null);
    setViolations([]);
    setPendingSchedule(null);

    if (selectedCourses.size === 0) {
      setError(lang === "tr" ? "En az bir ders seç." : "Select at least one course.");
      return;
    }

    const courseList = [...selectedCourses]
      .map((code) => courses.find((c) => c.code === code))
      .filter(Boolean);

    const options = {
      freeDays,
      maxDailyHours,
      earliestStart: earliestStart || null,
      latestEnd: latestEnd || null,
      maxCampusDays: maxCampusDays ? Number(maxCampusDays) : null,
      maxGapMinutes: maxGapMinutes ? Number(maxGapMinutes) : null,
      avoidSingleCourseDay,
      compactMode,
      preferredTeachers,
    };

    const schedule = findBestSchedule(courseList, options);

    if (!schedule) {
      setError(lang === "tr"
        ? "Kısıtlara uyan bir program bulunamadı. Kısıtları gevşetip tekrar dene."
        : "No valid schedule found. Try relaxing the constraints.");
      return;
    }

    const found = getConstraintViolations(courseList, freeDays, earliestStart || null, latestEnd || null, lang);

    if (found.length > 0) {
      setViolations(found);
      setPendingSchedule(schedule);
      return;
    }

    onApply(schedule.map(({ code, sectionId }) => ({ code, sectionId })));
    onClose();
  };

  const handleConfirm = () => {
    if (!pendingSchedule) return;
    onApply(pendingSchedule.map(({ code, sectionId }) => ({ code, sectionId })));
    onClose();
  };

  return (
    <div className="ai-panel-overlay" onClick={onClose}>
      <div className="ai-panel" onClick={(e) => e.stopPropagation()}>

        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <span className="ai-sparkle">✦</span>
            {lang === "tr" ? "Otomatik Program Oluştur" : "Auto Schedule"}
          </div>
          <button className="ai-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-panel-body ai-panel-grid">

          <div className="ai-col ai-col-left">
            <div className="ai-field" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <label className="ai-label">
                {lang === "tr" ? "Dersler" : "Courses"}
                {selectedCourses.size > 0 && (
                  <span className="ai-label-badge">
                    {selectedCourses.size} · {totalCredits}k
                  </span>
                )}
              </label>
              <input
                type="text"
                className="ai-course-search"
                placeholder={lang === "tr" ? "Ders veya hoca ara…" : "Search course or instructor…"}
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
              />
              <div className="ai-course-list" style={{ flex: 1 }}>
                {filteredCourses.map((c) => (
                  <label key={c.code} className={`ai-course-item${selectedCourses.has(c.code) ? " selected" : ""}`}>
                    <input type="checkbox" checked={selectedCourses.has(c.code)} onChange={() => toggleCourse(c.code)} />
                    <span className="ai-course-code">{c.code}</span>
                    <span className="ai-course-name">{lang === "tr" ? (c.nameTr || c.name) : c.name}</span>
                    <span className="ai-course-cr">{c.credits}k</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="ai-col ai-col-right">

            <div className="ai-field">
              <label className="ai-label">{lang === "tr" ? "Boş kalsın" : "Free days"}</label>
              <div className="ai-day-pills">
                {daysShort.map((d, i) => (
                  <button
                    key={DAY_KEYS[i]}
                    className={`ai-day-pill${freeDays.has(DAY_KEYS[i]) ? " active" : ""}`}
                    onClick={() => toggleDay(DAY_KEYS[i])}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-field">
              <label className="ai-label">
                {lang === "tr" ? "Günlük maks." : "Daily max"}
                <span className="ai-label-badge">{maxDailyHours} {lang === "tr" ? "saat" : "hrs"}</span>
              </label>
              <input
                type="range" min={2} max={10} step={1}
                value={maxDailyHours}
                onChange={(e) => setMaxDailyHours(Number(e.target.value))}
                className="ai-slider"
                style={{ width: "100%" }}
              />
            </div>

            <div className="ai-field">
              <label className="ai-label">{lang === "tr" ? "Saat tercihleri" : "Time prefs"}</label>
              <div className="ai-inline-grid">
                <label className="ai-mini-label">
                  {lang === "tr" ? "En erken" : "Earliest"}
                  <select className="ai-select" value={earliestStart} onChange={(e) => setEarliestStart(e.target.value)}>
                    <option value="">{lang === "tr" ? "Fark etmez" : "Any"}</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="ai-mini-label">
                  {lang === "tr" ? "En geç" : "Latest"}
                  <select className="ai-select" value={latestEnd} onChange={(e) => setLatestEnd(e.target.value)}>
                    <option value="">{lang === "tr" ? "Fark etmez" : "Any"}</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="ai-field">
              <label className="ai-label">
                {lang === "tr" ? "Hoca tercihleri" : "Instructor preferences"}
                {selectedTeachers.length > 0 && (
                  <span className="ai-label-badge">
                    {selectedTeachers.length} {lang === "tr" ? "hoca" : "instructors"}
                  </span>
                )}
              </label>
              <input
                className="ai-course-search"
                list="selected-course-teachers"
                placeholder={selectedCourses.size === 0
                  ? (lang === "tr" ? "Önce soldan ders seç" : "Select courses first")
                  : (lang === "tr" ? "Tercih edilen hoca" : "Preferred instructor")}
                value={preferredTeachers}
                disabled={selectedCourses.size === 0 || selectedTeachers.length === 0}
                onChange={(e) => setPreferredTeachers(e.target.value)}
              />
              <datalist id="selected-course-teachers">
                {selectedTeachers.map((t) => <option key={t} value={t} />)}
              </datalist>
              {selectedCourses.size > 0 && selectedTeachers.length === 0 && (
                <div className="ai-muted-note">
                  {lang === "tr" ? "Seçili derslerde hoca bilgisi bulunamadı." : "No instructor data found for selected courses."}
                </div>
              )}
            </div>

            {violations.length > 0 && (
              <div className="ai-warning">
                <div className="ai-warning-title">
                  ⚠ {lang === "tr" ? "Kısıt karşılanamıyor" : "Constraint conflict"}
                </div>
                <div className="ai-warning-list">
                  {violations.map((v, i) => (
                    <div key={i} className="ai-warning-item">
                      <span className="ai-warning-code">{v.code}</span>
                      <span className="ai-warning-reason">{v.reasons.join(" · ")}</span>
                    </div>
                  ))}
                </div>
                <div className="ai-warning-hint">
                  {lang === "tr"
                    ? "Bazı kısıtlar gevşetilerek en uygun şube seçildi. Devam edilsin mi?"
                    : "Some constraints were relaxed and the best section was selected. Continue anyway?"}
                </div>
              </div>
            )}

            {error && <div className="ai-error">{error}</div>}
          </div>
        </div>

        <div className="ai-panel-footer">
          {pendingSchedule ? (
            <>
              <button className="ai-cancel-btn" onClick={() => { setPendingSchedule(null); setViolations([]); }}>
                ← {lang === "tr" ? "Geri" : "Back"}
              </button>
              <button className="ai-generate-btn" onClick={handleConfirm}>
                <span>✦</span> {lang === "tr" ? "Yine de Uygula" : "Apply Anyway"}
              </button>
            </>
          ) : (
            <>
              <button className="ai-cancel-btn" onClick={onClose}>
                {lang === "tr" ? "İptal" : "Cancel"}
              </button>
              <button className="ai-generate-btn" onClick={handleGenerate}>
                <span>✦</span> {lang === "tr" ? "Program Oluştur" : "Generate"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
