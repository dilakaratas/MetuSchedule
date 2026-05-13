import React, { useState, useMemo } from "react";
import { toMin, sectionsConflict } from "../utils.js";

const DAYS_SHORT = ["PZT", "SAL", "ÇAR", "PER", "CUM"];
const DAY_KEYS = ["MON", "TUE", "WED", "THU", "FRI"];

// Kısıtlara göre bir şubenin uygun olup olmadığını kontrol et
function sectionPassesConstraints(section, freeDays, avoidEarlyMorning, avoidLateAfternoon, maxDailyHours) {
  for (const m of section.meetings) {
    // Boş gün kısıtı
    if (freeDays.has(m.d)) return false;
    // Sabah erken kısıtı (08:40 başlayanlar)
    if (avoidEarlyMorning && toMin(m.s) < toMin("09:40")) return false;
    // Akşam geç kısıtı
    if (avoidLateAfternoon && toMin(m.e) > toMin("15:40")) return false;
  }
  return true;
}

// Seçili şubelerin günlük ders saatini hesapla
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

// İki şube çakışıyor mu
function conflicts(secA, secB) {
  return !!sectionsConflict(secA, secB);
}

// Backtracking ile çakışmasız kombinasyon bul
function findBestSchedule(courseList, freeDays, avoidEarlyMorning, avoidLateAfternoon, maxDailyHours) {
  const result = [];

  function backtrack(idx, chosen) {
    if (idx === courseList.length) {
      result.push([...chosen]);
      return true; // İlk geçerli kombinasyonu bul
    }

    const course = courseList[idx];
    const validSections = course.sections.filter((s) =>
      sectionPassesConstraints(s, freeDays, avoidEarlyMorning, avoidLateAfternoon, maxDailyHours)
    );

    // Eğer bu ders için hiç geçerli şube yoksa, kısıtları yok say ve tüm şubeleri dene
    const candidates = validSections.length > 0 ? validSections : course.sections;

    for (const sec of candidates) {
      // Mevcut seçimlerle çakışma var mı?
      const hasConflict = chosen.some((c) => conflicts(c.section, sec));
      if (hasConflict) continue;

      // Günlük saat kısıtı
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

export default function AIPanel({ lang, courses, onApply, onClose }) {
  const [freeDays, setFreeDays] = useState(new Set());
  const [maxDailyHours, setMaxDailyHours] = useState(8);
  const [avoidEarlyMorning, setAvoidEarlyMorning] = useState(false);
  const [avoidLateAfternoon, setAvoidLateAfternoon] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [courseSearch, setCourseSearch] = useState("");
  const [error, setError] = useState(null);

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

    if (selectedCourses.size === 0) {
      setError(lang === "tr" ? "En az bir ders seç." : "Select at least one course.");
      return;
    }

    const courseList = [...selectedCourses]
      .map((code) => courses.find((c) => c.code === code))
      .filter(Boolean);

    const schedule = findBestSchedule(
      courseList,
      freeDays,
      avoidEarlyMorning,
      avoidLateAfternoon,
      maxDailyHours
    );

    if (!schedule) {
      setError(
        lang === "tr"
          ? "Kısıtlara uyan bir program bulunamadı. Kısıtları gevşetip tekrar dene."
          : "No valid schedule found. Try relaxing the constraints."
      );
      return;
    }

    onApply(schedule.map(({ code, sectionId }) => ({ code, sectionId })));
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

        <div className="ai-panel-body">
          {/* Course selection */}
          <div className="ai-field">
            <label className="ai-label">
              {lang === "tr"
                ? `Almak istediğin dersler${selectedCourses.size > 0 ? ` — ${selectedCourses.size} ders, ${totalCredits} kredi` : ""}`
                : `Courses to take${selectedCourses.size > 0 ? ` — ${selectedCourses.size} courses, ${totalCredits} credits` : ""}`}
            </label>
            <input
              type="text"
              className="ai-course-search"
              placeholder={lang === "tr" ? "Ders kodu veya isim ara…" : "Search course code or name…"}
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
            />
            <div className="ai-course-list">
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

          {/* Free days */}
          <div className="ai-field">
            <label className="ai-label">
              {lang === "tr" ? "Boş kalsın istediğin günler" : "Days you want free"}
            </label>
            <div className="ai-day-pills">
              {DAYS_SHORT.map((d, i) => (
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

          {/* Max daily hours */}
          <div className="ai-field">
            <label className="ai-label">
              {lang === "tr" ? "Günlük maksimum ders saati" : "Max daily class hours"}
            </label>
            <div className="ai-range-row">
              <input
                type="range" min={2} max={10} step={1}
                value={maxDailyHours}
                onChange={(e) => setMaxDailyHours(Number(e.target.value))}
                className="ai-slider"
              />
              <span className="ai-slider-val">{maxDailyHours} {lang === "tr" ? "saat" : "hrs"}</span>
            </div>
          </div>

          {/* Time preferences */}
          <div className="ai-field">
            <label className="ai-label">
              {lang === "tr" ? "Saat tercihleri" : "Time preferences"}
            </label>
            <div className="ai-checks">
              <label className="ai-check">
                <input type="checkbox" checked={avoidEarlyMorning} onChange={(e) => setAvoidEarlyMorning(e.target.checked)} />
                <span>{lang === "tr" ? "09:40 öncesi ders olmasın" : "No classes before 09:40"}</span>
              </label>
              <label className="ai-check">
                <input type="checkbox" checked={avoidLateAfternoon} onChange={(e) => setAvoidLateAfternoon(e.target.checked)} />
                <span>{lang === "tr" ? "15:40 sonrası ders olmasın" : "No classes after 15:40"}</span>
              </label>
            </div>
          </div>

          {error && <div className="ai-error">{error}</div>}
        </div>

        <div className="ai-panel-footer">
          <button className="ai-cancel-btn" onClick={onClose}>
            {lang === "tr" ? "İptal" : "Cancel"}
          </button>
          <button className="ai-generate-btn" onClick={handleGenerate}>
            <span>✦</span> {lang === "tr" ? "Program Oluştur" : "Generate Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
