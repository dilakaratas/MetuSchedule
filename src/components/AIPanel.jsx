import React, { useState, useMemo } from "react";
import { toMin, sectionsConflict } from "../utils.js";

const DAYS_SHORT_TR = ["PZT", "SAL", "ÇAR", "PER", "CUM"];
const DAYS_SHORT_EN = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_KEYS = [0, 1, 2, 3, 4];

function sectionPassesConstraints(section, freeDays, avoidEarlyMorning, avoidLateAfternoon) {
  for (const m of section.meetings) {
    if (freeDays.has(m.d)) return false;
    if (avoidEarlyMorning && toMin(m.s) < toMin("09:40")) return false;
    if (avoidLateAfternoon && toMin(m.e) > toMin("15:40")) return false;
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

function findBestSchedule(courseList, freeDays, avoidEarlyMorning, avoidLateAfternoon, maxDailyHours) {
  const result = [];

  function backtrack(idx, chosen) {
    if (idx === courseList.length) {
      result.push([...chosen]);
      return true;
    }
    const course = courseList[idx];
    const validSections = course.sections.filter((s) =>
      sectionPassesConstraints(s, freeDays, avoidEarlyMorning, avoidLateAfternoon)
    );
    const candidates = validSections.length > 0 ? validSections : course.sections;
    for (const sec of candidates) {
      const hasConflict = chosen.some((c) => !!sectionsConflict(c.section, sec));
      if (hasConflict) continue;
      const chosenSections = chosen.map((c) => c.section);
      if (dailyHours([...chosenSections, sec]) > maxDailyHours) continue;
      chosen.push({ code: course.code, sectionId: sec.id, section: sec });
      if (backtrack(idx + 1, chosen)) return true;
      chosen.pop();
    }
    return false;
  }

  backtrack(0, []);
  return result[0] || null;
}

function getConstraintViolations(courseList, freeDays, avoidEarlyMorning, avoidLateAfternoon, lang) {
  const daysShort = lang === "tr" ? DAYS_SHORT_TR : DAYS_SHORT_EN;
  const violations = [];

  for (const course of courseList) {
    const hasValid = course.sections.some((s) =>
      sectionPassesConstraints(s, freeDays, avoidEarlyMorning, avoidLateAfternoon)
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

    if (avoidEarlyMorning) {
      const allEarly = course.sections.every((s) =>
        s.meetings.some((m) => toMin(m.s) < toMin("09:40"))
      );
      if (allEarly) reasons.push(lang === "tr" ? "tüm şubeleri 09:40 öncesi başlıyor" : "all sections start before 09:40");
    }

    if (avoidLateAfternoon) {
      const allLate = course.sections.every((s) =>
        s.meetings.some((m) => toMin(m.e) > toMin("15:40"))
      );
      if (allLate) reasons.push(lang === "tr" ? "tüm şubeleri 15:40 sonrası bitiyor" : "all sections end after 15:40");
    }

    if (reasons.length > 0) violations.push({ code: course.code, reasons });
  }

  return violations;
}

export default function AIPanel({ lang, courses, onApply, onClose }) {
  const [freeDays, setFreeDays] = useState(new Set());
  const [maxDailyHours, setMaxDailyHours] = useState(8);
  const [avoidEarlyMorning, setAvoidEarlyMorning] = useState(false);
  const [avoidLateAfternoon, setAvoidLateAfternoon] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [courseSearch, setCourseSearch] = useState("");
  const [error, setError] = useState(null);
  const [violations, setViolations] = useState([]);
  const [pendingSchedule, setPendingSchedule] = useState(null);

  const daysShort = lang === "tr" ? DAYS_SHORT_TR : DAYS_SHORT_EN;

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
      `${c.code} ${c.name} ${c.nameTr || ""}`.toLowerCase().includes(q)
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

    const schedule = findBestSchedule(courseList, freeDays, avoidEarlyMorning, avoidLateAfternoon, maxDailyHours);

    if (!schedule) {
      setError(lang === "tr"
        ? "Kısıtlara uyan bir program bulunamadı. Kısıtları gevşetip tekrar dene."
        : "No valid schedule found. Try relaxing the constraints.");
      return;
    }

    const found = getConstraintViolations(courseList, freeDays, avoidEarlyMorning, avoidLateAfternoon, lang);

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

        {/* Header */}
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <span className="ai-sparkle">✦</span>
            {lang === "tr" ? "Otomatik Program Oluştur" : "Auto Schedule"}
          </div>
          <button className="ai-panel-close" onClick={onClose}>✕</button>
        </div>

        {/* 2 sütunlu body */}
        <div className="ai-panel-body ai-panel-grid">

          {/* SOL SÜTUN — ders seçimi */}
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
                placeholder={lang === "tr" ? "Ara…" : "Search…"}
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

          {/* SAĞ SÜTUN — kısıtlar */}
          <div className="ai-col ai-col-right">

            {/* Boş günler */}
            <div className="ai-field">
              <label className="ai-label">
                {lang === "tr" ? "Boş kalsın" : "Free days"}
              </label>
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

            {/* Günlük max saat */}
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

            {/* Saat tercihleri */}
            <div className="ai-field">
              <label className="ai-label">
                {lang === "tr" ? "Saat tercihleri" : "Time prefs"}
              </label>
              <div className="ai-checks">
                <label className="ai-check">
                  <input type="checkbox" checked={avoidEarlyMorning} onChange={(e) => setAvoidEarlyMorning(e.target.checked)} />
                  <span>{lang === "tr" ? "09:40 öncesi olmasın" : "No classes before 09:40"}</span>
                </label>
                <label className="ai-check">
                  <input type="checkbox" checked={avoidLateAfternoon} onChange={(e) => setAvoidLateAfternoon(e.target.checked)} />
                  <span>{lang === "tr" ? "15:40 sonrası olmasın" : "No classes after 15:40"}</span>
                </label>
              </div>
            </div>

            {/* Uyarı */}
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
                    ? "En uygun şube seçildi. Devam edilsin mi?"
                    : "Best section selected. Continue anyway?"}
                </div>
              </div>
            )}

            {/* Hata */}
            {error && <div className="ai-error">{error}</div>}
          </div>
        </div>

        {/* Footer */}
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
