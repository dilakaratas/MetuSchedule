import React, { useState, useMemo } from "react";
import { toMin, sectionsConflict } from "../utils.js";

const DAYS_SHORT_TR = ["PZT", "SAL", "ÇAR", "PER", "CUM"];
const DAYS_SHORT_EN = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_NAMES_TR  = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma"];
const DAY_NAMES_EN  = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const DAY_KEYS      = [0, 1, 2, 3, 4];
const TIME_OPTIONS  = ["08:40","09:40","10:40","11:40","12:40","13:40","14:40","15:40","16:40","17:40"];

// ─── yardımcılar ────────────────────────────────────────────────────────────
function normalizeText(v) {
  return String(v||"").toLocaleLowerCase("tr-TR")
    .replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ü/g,"u")
    .replace(/ş/g,"s").replace(/ö/g,"o").replace(/ç/g,"c");
}
function instructorMatches(instructor, names) {
  const hay = normalizeText(instructor);
  return names.some(n => { const nn=normalizeText(n); return nn.length>=2 && hay.includes(nn); });
}
function sectionPassesConstraints(section, freeDays, earliestStart, latestEnd) {
  for (const m of section.meetings) {
    if (freeDays.has(m.d)) return false;
    if (earliestStart && toMin(m.s) < toMin(earliestStart)) return false;
    if (latestEnd   && toMin(m.e) > toMin(latestEnd))   return false;
  }
  return true;
}
function dailyHours(sections) {
  const byDay = {};
  for (const sec of sections) for (const m of sec.meetings)
    byDay[m.d] = (byDay[m.d]||0) + (toMin(m.e)-toMin(m.s))/60;
  return Math.max(...Object.values(byDay), 0);
}
function scheduleStats(schedule) {
  const byDay = {};
  for (const item of schedule) for (const m of item.section.meetings) {
    if (!byDay[m.d]) byDay[m.d] = [];
    byDay[m.d].push({ start: toMin(m.s), end: toMin(m.e) });
  }
  let totalGap=0, maxGap=0;
  const campusDays = Object.keys(byDay).length;
  Object.values(byDay).forEach(ms => {
    const s = ms.sort((a,b)=>a.start-b.start);
    for (let i=1;i<s.length;i++) {
      const g=Math.max(0,s[i].start-s[i-1].end);
      totalGap+=g; maxGap=Math.max(maxGap,g);
    }
  });
  return { campusDays, totalGap, maxGap };
}
function scoreSchedule(schedule, options) {
  const stats = scheduleStats(schedule);
  let score = 1000;
  if (options.maxCampusDays) {
    score -= Math.max(0, stats.campusDays - options.maxCampusDays) * 120;
    score += Math.max(0, options.maxCampusDays - stats.campusDays) * 20;
  }
  if (options.compactMode==="compact") score -= stats.totalGap * 1.2;
  if (options.compactMode==="spaced")  score -= Math.max(0, 60-stats.maxGap);
  for (const item of schedule)
    if (instructorMatches(item.section.instructor||"", options.preferredTeachers||[])) score += 90;
  return score;
}
function findBestSchedule(courseList, options) {
  const result = [];
  function bt(idx, chosen) {
    if (result.length>=350) return;
    if (idx===courseList.length) { result.push([...chosen]); return; }
    const course = courseList[idx];
    const valid  = course.sections.filter(s =>
      sectionPassesConstraints(s, options.freeDays, options.earliestStart, options.latestEnd));
    const cands  = valid.length>0 ? valid : course.sections;
    for (const sec of cands) {
      if (chosen.some(c => !!sectionsConflict(c.section, sec))) continue;
      if (dailyHours([...chosen.map(c=>c.section), sec]) > options.maxDailyHours) continue;
      chosen.push({ code: course.code, sectionId: sec.id, section: sec });
      bt(idx+1, chosen);
      chosen.pop();
    }
  }
  bt(0, []);
  if (result.length===0) return null;
  return result
    .map(s => ({ schedule: s, score: scoreSchedule(s, options) }))
    .sort((a,b) => b.score-a.score)[0].schedule;
}

// ─── KAPSAMLI HATA ANALİZİ ──────────────────────────────────────────────────
function analyzeFailure(courseList, freeDays, earliestStart, latestEnd, lang) {
  const dayNames = lang==="tr" ? DAY_NAMES_TR  : DAY_NAMES_EN;

  const evaluated = courseList.map(course => {
    const sections = course.sections.map(sec => {
      const constraintViolations = [];
      for (const m of sec.meetings) {
        if (freeDays.has(m.d))
          constraintViolations.push(lang==="tr"
            ? `📅 ${dayNames[m.d]} günü boş istenmiş`
            : `📅 ${dayNames[m.d]} must stay free`);
        if (earliestStart && toMin(m.s) < toMin(earliestStart))
          constraintViolations.push(lang==="tr"
            ? `⏰ ${m.s} başlangıcı, minimum ${earliestStart}'den erken`
            : `⏰ starts at ${m.s}, before earliest ${earliestStart}`);
        if (latestEnd && toMin(m.e) > toMin(latestEnd))
          constraintViolations.push(lang==="tr"
            ? `⏰ ${m.e} bitişi, maksimum ${latestEnd}'den geç`
            : `⏰ ends at ${m.e}, after latest ${latestEnd}`);
      }
      const uniq = [...new Set(constraintViolations)];
      const meetingStr = sec.meetings.map(m =>
        `${lang==="tr" ? DAYS_SHORT_TR[m.d] : DAYS_SHORT_EN[m.d]} ${m.s}–${m.e}`
      ).join(", ");
      return { sec, constraintViolations: uniq, meetingStr, passesConstraints: uniq.length===0 };
    });
    const hasAnyPassing = sections.some(s => s.passesConstraints);
    return { course, sections, hasAnyPassing };
  });

  const conflictMatrix = {};
  for (let i=0; i<evaluated.length; i++) {
    for (let j=i+1; j<evaluated.length; j++) {
      const a = evaluated[i];
      const b = evaluated[j];
      const passA = a.sections.filter(s => s.passesConstraints);
      const passB = b.sections.filter(s => s.passesConstraints);
      let allConflict = false;
      if (passA.length > 0 && passB.length > 0) {
        const hasNonConflicting = passA.some(sa =>
          passB.some(sb => !sectionsConflict(sa.sec, sb.sec))
        );
        allConflict = !hasNonConflicting;
      }
      if (allConflict) {
        const examples = [];
        for (const sa of passA.slice(0,3)) {
          for (const sb of passB.slice(0,3)) {
            const cf = sectionsConflict(sa.sec, sb.sec);
            if (cf) {
              const dayIdx = cf.m1.d;
              examples.push({
                secA: sa, secB: sb,
                info: lang==="tr"
                  ? `§${sa.sec.id} & §${sb.sec.id} — ${dayNames[dayIdx]} ${cf.m1.s}–${cf.m1.e} çakışıyor`
                  : `§${sa.sec.id} & §${sb.sec.id} — ${dayNames[dayIdx]} ${cf.m1.s}–${cf.m1.e} overlap`
              });
            }
          }
        }
        const key = `${a.course.code}|||${b.course.code}`;
        conflictMatrix[key] = examples.slice(0,2);
      }
    }
  }

  return evaluated.map(({ course, sections, hasAnyPassing }) => {
    const constraintReasons = [];
    if (!hasAnyPassing) {
      const allViolations = sections.flatMap(s => s.constraintViolations);
      const freq = {};
      allViolations.forEach(v => freq[v] = (freq[v]||0)+1);
      Object.entries(freq)
        .sort((a,b) => b[1]-a[1])
        .forEach(([v]) => constraintReasons.push(v));
    }

    const timeConflictWith = [];
    for (const key of Object.keys(conflictMatrix)) {
      const [cA, cB] = key.split("|||");
      if (cA === course.code || cB === course.code) {
        const other = cA === course.code ? cB : cA;
        timeConflictWith.push({ other, examples: conflictMatrix[key] });
      }
    }

    const alternatives = [...sections]
      .sort((a, b) => a.constraintViolations.length - b.constraintViolations.length)
      .slice(0, 4);

    // Kombinatöryel tıkanma: dersin kendi section'ları kısıtları geçiyor ama
    // diğer derslerle kombine edilemiyor — bunu da göster
    const hasCombinatorialBlock = hasAnyPassing && timeConflictWith.length === 0 &&
      constraintReasons.length === 0;

    return { course, constraintReasons, timeConflictWith, alternatives, hasAnyPassing, hasCombinatorialBlock };
  // Hiçbir sorun yoksa gösterme; ama sorun varsa (kısıt, conflict, veya hiç geçen yok) göster
  }).filter(d =>
    d.constraintReasons.length > 0 ||
    d.timeConflictWith.length > 0 ||
    !d.hasAnyPassing
  );
}

// ─── Loading ekranı ─────────────────────────────────────────────────────────
function LoadingScreen({ lang }) {
  return (
    <div style={{
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      flex:1, gap:16, padding:40,
    }}>
      <div style={{
        width:40, height:40,
        border:"3px solid #e5e7eb",
        borderTop:"3px solid #7a1f2b",
        borderRadius:"50%",
        animation:"ai-spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize:"0.9rem", color:"#6b7280" }}>
        {lang==="tr" ? "Program hesaplanıyor…" : "Finding best schedule…"}
      </div>
      <style>{`@keyframes ai-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Önizleme ekranı ────────────────────────────────────────────────────────
function PreviewScreen({ schedule, courses, lang, onApply, onBack }) {
  const dayNames = lang==="tr" ? DAY_NAMES_TR : DAY_NAMES_EN;
  const byDay = useMemo(() => {
    const map = {};
    for (const item of schedule) {
      const course = courses.find(c => c.code===item.code);
      if (!course) continue;
      for (const m of item.section.meetings) {
        if (!map[m.d]) map[m.d] = [];
        map[m.d].push({
          code: item.code,
          name: lang==="tr" ? (course.nameTr||course.name) : course.name,
          instructor: item.section.instructor || "—",
          start: m.s, end: m.e,
        });
      }
    }
    Object.values(map).forEach(arr => arr.sort((a,b) => toMin(a.start)-toMin(b.start)));
    return map;
  }, [schedule, courses, lang]);

  const totalCredits = schedule.reduce((sum,item) =>
    sum + (courses.find(c=>c.code===item.code)?.credits||0), 0);

  return (
    <div className="ai-preview">
      <div className="ai-preview-header">
        <div className="ai-preview-stats">
          <div className="ai-preview-stat">
            <span className="ai-preview-stat-num">{schedule.length}</span>
            <span className="ai-preview-stat-lbl">{lang==="tr"?"ders":"courses"}</span>
          </div>
          <div className="ai-preview-stat-sep" />
          <div className="ai-preview-stat">
            <span className="ai-preview-stat-num">{totalCredits}</span>
            <span className="ai-preview-stat-lbl">{lang==="tr"?"kredi":"credits"}</span>
          </div>
          <div className="ai-preview-stat-sep" />
          <div className="ai-preview-stat">
            <span className="ai-preview-stat-num">{Object.keys(byDay).length}</span>
            <span className="ai-preview-stat-lbl">{lang==="tr"?"kampüs günü":"campus days"}</span>
          </div>
        </div>
      </div>
      <div className="ai-preview-body">
        {[0,1,2,3,4].map(d => {
          const items = byDay[d];
          if (!items) return null;
          return (
            <div key={d} className="ai-preview-day">
              <div className="ai-preview-day-label">{dayNames[d]}</div>
              <div className="ai-preview-day-items">
                {items.map((item, i) => (
                  <div key={i} className="ai-preview-card">
                    <div className="ai-preview-card-time">{item.start} – {item.end}</div>
                    <div className="ai-preview-card-info">
                      <span className="ai-preview-card-code">{item.code}</span>
                      <span className="ai-preview-card-name">{item.name}</span>
                    </div>
                    <div className="ai-preview-card-instructor">{item.instructor}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="ai-panel-footer">
        <button className="ai-cancel-btn" onClick={onBack}>← {lang==="tr"?"Değiştir":"Edit"}</button>
        <button className="ai-generate-btn" onClick={onApply}>✓ {lang==="tr"?"Programı Uygula":"Apply Schedule"}</button>
      </div>
    </div>
  );
}

// ─── Hata analiz kartı ──────────────────────────────────────────────────────
function FailureCard({ diagnosis, lang }) {
  const [open, setOpen] = useState(false);
  const tr = lang === "tr";
  const { course, constraintReasons, timeConflictWith, alternatives } = diagnosis;
  const hasIssue = constraintReasons.length > 0 || timeConflictWith.length > 0;

  return (
    <div style={{
      background: hasIssue ? "#fff8f0" : "#f0fdf4",
      border: hasIssue ? "1px solid #f5c6a0" : "1px solid #86efac",
      borderRadius:10, padding:"10px 12px", marginBottom:8,
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:700, fontSize:"0.83rem", color:"#7a1f2b" }}>
            {course.code}
          </span>
          <span style={{ fontSize:"0.76rem", color:"#555", marginLeft:6 }}>
            {tr ? (course.nameTr||course.name) : course.name}
          </span>

          {constraintReasons.length > 0 && (
            <div style={{ marginTop:4 }}>
              {[...new Set(constraintReasons)].map((r,i) => (
                <div key={i} style={{ fontSize:"0.77rem", color:"#c05621", lineHeight:1.5 }}>{r}</div>
              ))}
            </div>
          )}

          {timeConflictWith.length > 0 && (
            <div style={{ marginTop:4 }}>
              {timeConflictWith.map(({ other, examples }, i) => (
                <div key={i} style={{ fontSize:"0.77rem", color:"#7c3aed", lineHeight:1.5 }}>
                  ⚡ {tr ? `${other} ile çakışıyor` : `conflicts with ${other}`}
                  {examples[0] && (
                    <span style={{ opacity:.8 }}> — {examples[0].info}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setOpen(v => !v)}
          style={{
            fontSize:"0.72rem", padding:"4px 9px", borderRadius:6,
            border:"1px solid #e07b39",
            background: open ? "#e07b39" : "transparent",
            color: open ? "#fff" : "#e07b39",
            cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
          }}
        >
          {open
            ? (tr ? "Gizle ▲" : "Hide ▲")
            : (tr ? `Şubeler (${alternatives.length}) ▼` : `Sections (${alternatives.length}) ▼`)}
        </button>
      </div>

      {open && (
        <div style={{ marginTop:8, borderTop:"1px solid #f5c6a0", paddingTop:8 }}>
          <div style={{ fontSize:"0.72rem", fontWeight:600, color:"#7a5c1f", marginBottom:5 }}>
            {tr ? "Mevcut şubeler (en uygundan):" : "Available sections (best first):"}
          </div>
          {alternatives.map(({ sec, constraintViolations, meetingStr }, i) => (
            <div key={i} style={{
              fontSize:"0.73rem", padding:"6px 8px", borderRadius:6, marginBottom:4,
              background: constraintViolations.length===0 ? "#f0fdf4" : "#fffbeb",
              border:`1px solid ${constraintViolations.length===0 ? "#86efac" : "#fde68a"}`,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:6 }}>
                <span style={{ fontWeight:700 }}>§{sec.id}</span>
                <span style={{ color:"#374151" }}>{sec.instructor || "—"}</span>
              </div>
              <div style={{ color:"#374151", marginTop:2 }}>{meetingStr}</div>
              {constraintViolations.length > 0 ? (
                <div style={{ color:"#b45309", marginTop:3, fontSize:"0.7rem" }}>
                  {constraintViolations.map((v,vi) => <div key={vi}>{v}</div>)}
                </div>
              ) : (
                <div style={{ color:"#15803d", marginTop:3, fontWeight:600, fontSize:"0.7rem" }}>
                  ✓ {tr ? "Kısıtları karşılıyor" : "Meets all constraints"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ana bileşen ────────────────────────────────────────────────────────────
export default function AIPanel({ lang, courses, initialCourses, onApply, onClose }) {
  const [freeDays,        setFreeDays]        = useState(new Set());
  const [maxDailyHours,   setMaxDailyHours]   = useState(8);
  const [earliestStart,   setEarliestStart]   = useState("");
  const [latestEnd,       setLatestEnd]       = useState("");
  const [compactMode,     setCompactMode]     = useState("any");
  const [creditLimit,     setCreditLimit]     = useState("");
  const [preferredByCode, setPreferredByCode] = useState({});
  const [selectedCourses, setSelectedCourses] = useState(initialCourses instanceof Set ? initialCourses : new Set());
  const [courseSearch,    setCourseSearch]    = useState("");
  const [error,           setError]           = useState(null);
  const [diagnoses,       setDiagnoses]       = useState([]);
  const [violations,      setViolations]      = useState([]);
  const [stage,           setStage]           = useState("form"); // form | loading | conflict | preview
  const [generatedSchedule, setGeneratedSchedule] = useState(null);

  const daysShort = lang==="tr" ? DAYS_SHORT_TR : DAYS_SHORT_EN;

  const selectedCourseList = useMemo(() =>
    [...selectedCourses].map(code => courses.find(c=>c.code===code)).filter(Boolean),
  [selectedCourses, courses]);

  const totalCredits = useMemo(() =>
    [...selectedCourses].reduce((sum,code) =>
      sum+(courses.find(c=>c.code===code)?.credits||0), 0),
  [selectedCourses, courses]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses.slice(0,60);
    return courses.filter(c =>
      `${c.code} ${c.name} ${c.nameTr||""} ${c.sections.map(s=>s.instructor).join(" ")}`
        .toLowerCase().includes(q)
    ).slice(0,40);
  }, [courses, courseSearch]);

  const creditLimitNum = creditLimit ? Number(creditLimit) : null;
  const creditOver     = creditLimitNum && totalCredits > creditLimitNum;

  const allPreferredTeachers = useMemo(() =>
    Object.values(preferredByCode).flatMap(s=>[...s]),
  [preferredByCode]);

  const toggleDay    = d    => { const n=new Set(freeDays); n.has(d)?n.delete(d):n.add(d); setFreeDays(n); };
  const toggleCourse = code => { const n=new Set(selectedCourses); n.has(code)?n.delete(code):n.add(code); setSelectedCourses(n); };

  const handleGenerate = () => {
    setError(null); setDiagnoses([]); setViolations([]);
    if (selectedCourses.size===0) {
      setError(lang==="tr"?"En az bir ders seç.":"Select at least one course.");
      return;
    }
    if (creditOver) {
      setError(lang==="tr"
        ?`Kredi limiti aşıldı (${totalCredits}/${creditLimitNum}).`
        :"Credit limit exceeded.");
      return;
    }

    const courseList = [...selectedCourses]
      .map(code=>courses.find(c=>c.code===code)).filter(Boolean);
    const options = {
      freeDays,
      maxDailyHours,
      earliestStart: earliestStart||null,
      latestEnd:     latestEnd||null,
      compactMode,
      preferredTeachers: allPreferredTeachers,
    };

    // Hesaplamayı async yap — tarayıcı donmasın
    setStage("loading");
    setTimeout(() => {
      const schedule = findBestSchedule(courseList, options);

      if (!schedule) {
        let diag = analyzeFailure(
          courseList, freeDays,
          earliestStart||null, latestEnd||null, lang
        );
        // Eğer analiz boş dönerse (kombinatöryel tıkanma) — tüm dersleri section bilgisiyle göster
        if (diag.length === 0) {
          diag = courseList.map(course => {
            const sections = course.sections.map(sec => {
              const violations = [];
              for (const m of sec.meetings) {
                if (freeDays.has(m.d)) violations.push(lang==="tr" ? `📅 ${["Pzt","Sal","Çar","Per","Cum"][m.d]} boş istenmiş` : `📅 ${["Mon","Tue","Wed","Thu","Fri"][m.d]} must stay free`);
                if (earliestStart && toMin(m.s) < toMin(earliestStart)) violations.push(lang==="tr" ? `⏰ ${m.s} başlangıcı çok erken (min ${earliestStart})` : `⏰ ${m.s} starts before ${earliestStart}`);
                if (latestEnd && toMin(m.e) > toMin(latestEnd)) violations.push(lang==="tr" ? `⏰ ${m.e} bitişi çok geç (max ${latestEnd})` : `⏰ ${m.e} ends after ${latestEnd}`);
              }
              const uniq = [...new Set(violations)];
              const meetingStr = sec.meetings.map(m => `${["Pzt","Sal","Çar","Per","Cum"][m.d]} ${m.s}–${m.e}`).join(", ");
              return { sec, constraintViolations: uniq, meetingStr, passesConstraints: uniq.length===0 };
            });
            const hasAnyPassing = sections.some(s => s.passesConstraints);
            const alternatives = [...sections].sort((a,b) => a.constraintViolations.length - b.constraintViolations.length).slice(0,4);
            const constraintReasons = hasAnyPassing ? [] : [...new Set(sections.flatMap(s => s.constraintViolations))];
            return { course, constraintReasons, timeConflictWith: [], alternatives, hasAnyPassing };
          });
        }
        setDiagnoses(diag);

        const hints = [];
        if (freeDays.size > 0)  hints.push(lang==="tr" ? `${freeDays.size} boş gün` : `${freeDays.size} free days`);
        if (earliestStart)      hints.push(lang==="tr" ? `en erken ${earliestStart}` : `earliest ${earliestStart}`);
        if (latestEnd)          hints.push(lang==="tr" ? `en geç ${latestEnd}` : `latest ${latestEnd}`);
        if (maxDailyHours < 6)  hints.push(lang==="tr" ? `günlük max ${maxDailyHours}s` : `max ${maxDailyHours}h/day`);
        const hintStr = hints.length ? " (" + hints.join(", ") + ")" : "";

        setError(lang==="tr"
          ? `Kısıtlara uyan program bulunamadı${hintStr}. Aşağıda sorunlu dersler ve mevcut şubeler gösteriliyor:`
          : `No valid schedule found${hintStr}. Problematic courses and available sections are shown below:`);
        setStage("form");
        return;
      }

      const forcedCourses = courseList.filter(course =>
        !course.sections.some(s =>
          sectionPassesConstraints(s, freeDays, earliestStart||null, latestEnd||null)
        )
      );
      if (forcedCourses.length > 0) {
        const diag = analyzeFailure(
          forcedCourses, freeDays, earliestStart||null, latestEnd||null, lang
        );
        setViolations(forcedCourses.map(c => ({ code: c.code })));
        setDiagnoses(diag);
        setGeneratedSchedule(schedule);
        setStage("conflict");
        return;
      }

      setGeneratedSchedule(schedule);
      setStage("preview");
    }, 30);
  };

  const handleApply = () => {
    onApply(generatedSchedule.map(({code,sectionId}) => ({code,sectionId})));
    onClose();
  };

  // ─── Loading ekranı ───────────────────────────────────────────────────────
  if (stage==="loading") {
    return (
      <div className="ai-panel-overlay" onClick={onClose}>
        <div className="ai-panel" onClick={e=>e.stopPropagation()}>
          <div className="ai-panel-header">
            <div className="ai-panel-title">
              <span className="ai-sparkle">✦</span>
              {lang==="tr"?"Otomatik Program Oluştur":"Auto Schedule"}
            </div>
            <button className="ai-panel-close" onClick={onClose}>✕</button>
          </div>
          <LoadingScreen lang={lang} />
        </div>
      </div>
    );
  }

  // ─── Önizleme ekranı ──────────────────────────────────────────────────────
  if (stage==="preview") {
    return (
      <div className="ai-panel-overlay" onClick={onClose}>
        <div className="ai-panel" onClick={e=>e.stopPropagation()}>
          <div className="ai-panel-header">
            <div className="ai-panel-title">
              <span className="ai-sparkle">✦</span>
              {lang==="tr"?"Program Önizlemesi":"Schedule Preview"}
            </div>
            <button className="ai-panel-close" onClick={onClose}>✕</button>
          </div>
          <PreviewScreen
            schedule={generatedSchedule}
            courses={courses}
            lang={lang}
            onApply={handleApply}
            onBack={() => setStage("form")}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  // ─── Form ekranı ──────────────────────────────────────────────────────────
  return (
    <div className="ai-panel-overlay" onClick={onClose}>
      <div className="ai-panel" onClick={e=>e.stopPropagation()}>

        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <span className="ai-sparkle">✦</span>
            {lang==="tr"?"Otomatik Program Oluştur":"Auto Schedule"}
          </div>
          <button className="ai-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-panel-body ai-panel-grid">

          {/* ── Sol kolon: ders listesi ── */}
          <div className="ai-col ai-col-left">
            <div className="ai-field" style={{height:"100%",display:"flex",flexDirection:"column"}}>
              <label className="ai-label">
                {lang==="tr"?"Dersler":"Courses"}
                {selectedCourses.size>0 && (
                  <span className={`ai-label-badge${creditOver?" ai-badge-warn":""}`}>
                    {selectedCourses.size} ders · {totalCredits} kredi
                    {creditLimitNum?` / ${creditLimitNum}`:""}
                  </span>
                )}
              </label>
              <input
                type="text" className="ai-course-search"
                placeholder={lang==="tr"?"Ders kodu, isim veya hoca...":"Code, name or instructor..."}
                value={courseSearch} onChange={e=>setCourseSearch(e.target.value)}
              />
              <div className="ai-course-list" style={{flex:1}}>
                {filteredCourses.map(c => (
                  <label key={c.code}
                    className={`ai-course-item${selectedCourses.has(c.code)?" selected":""}`}>
                    <input
                      type="checkbox"
                      checked={selectedCourses.has(c.code)}
                      onChange={() => toggleCourse(c.code)}
                    />
                    <span className="ai-course-code">{c.code}</span>
                    <span className="ai-course-name">
                      {lang==="tr"?(c.nameTr||c.name):c.name}
                    </span>
                    <span className="ai-course-cr">{c.credits}k</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sağ kolon: kısıtlar + hata ── */}
          <div className="ai-col ai-col-right">

            {/* Boş günler */}
            <div className="ai-field">
              <label className="ai-label">{lang==="tr"?"Boş kalsın":"Free days"}</label>
              <div className="ai-day-pills">
                {daysShort.map((d,i) => (
                  <button
                    key={DAY_KEYS[i]}
                    className={`ai-day-pill${freeDays.has(DAY_KEYS[i])?" active":""}`}
                    onClick={() => toggleDay(DAY_KEYS[i])}
                  >{d}</button>
                ))}
              </div>
              <div className="ai-campus-row">
                {daysShort.map((d,i) => (
                  <div key={i} className={`ai-campus-pip${freeDays.has(DAY_KEYS[i])?" off":""}`}>{d}</div>
                ))}
                <span className="ai-campus-count">{5-freeDays.size}/5 {lang==="tr"?"gün":"days"}</span>
              </div>
            </div>

            {/* Günlük max */}
            <div className="ai-field">
              <label className="ai-label">
                {lang==="tr"?"Günlük max ders saati":"Daily max hours"}
                <span className="ai-label-badge">{maxDailyHours} {lang==="tr"?"saat":"hrs"}</span>
              </label>
              <div className="ai-hours-track">
                {[2,3,4,5,6,7,8,9,10].map(h => (
                  <button key={h}
                    className={`ai-hours-step${maxDailyHours===h?" active":""}${maxDailyHours>h?" past":""}`}
                    onClick={() => setMaxDailyHours(h)}
                  >{h}</button>
                ))}
              </div>
            </div>

            {/* Saat aralığı */}
            <div className="ai-field">
              <label className="ai-label">{lang==="tr"?"Saat aralığı":"Time range"}</label>
              <div className="ai-time-range-box">
                <div className="ai-time-slot">
                  <span className="ai-time-slot-label">
                    {lang==="tr"?"En erken başlangıç":"Earliest start"}
                  </span>
                  <select className="ai-select" value={earliestStart}
                    onChange={e=>setEarliestStart(e.target.value)}>
                    <option value="">{lang==="tr"?"Fark etmez":"Any"}</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="ai-time-range-sep" />
                <div className="ai-time-slot">
                  <span className="ai-time-slot-label">
                    {lang==="tr"?"En geç bitiş":"Latest end"}
                  </span>
                  <select className="ai-select" value={latestEnd}
                    onChange={e=>setLatestEnd(e.target.value)}>
                    <option value="">{lang==="tr"?"Fark etmez":"Any"}</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Kredi limiti */}
            <div className="ai-field">
              <label className="ai-label">{lang==="tr"?"Kredi limiti":"Credit limit"}</label>
              <div className="ai-credit-row">
                {[15,18,21,24].map(n => (
                  <button key={n}
                    className={`ai-credit-chip${creditLimit==n?" active":""}`}
                    onClick={() => setCreditLimit(creditLimit==n?"":String(n))}
                  >{n}</button>
                ))}
                <input
                  className="ai-credit-input" type="number" min={1} max={30}
                  placeholder={lang==="tr"?"özel":"custom"}
                  value={creditLimit} onChange={e=>setCreditLimit(e.target.value)}
                />
              </div>
              {creditOver && (
                <div className="ai-credit-warn">
                  ⚠ {lang==="tr"
                    ?`${totalCredits} kredi seçildi, limit ${creditLimitNum}`
                    :`${totalCredits} credits, limit ${creditLimitNum}`}
                </div>
              )}
            </div>

            {/* Hoca tercihi */}
            {selectedCourseList.length>0 && (
              <div className="ai-field">
                <label className="ai-label">
                  {lang==="tr"?"Tercih edilen hocalar":"Preferred instructors"}
                  {allPreferredTeachers.length>0 &&
                    <span className="ai-label-badge">{allPreferredTeachers.length} seçili</span>}
                </label>
                <div className="ai-instructor-selects">
                  {selectedCourseList.map(course => {
                    const instructors = [...new Set(
                      course.sections.map(s=>s.instructor).filter(Boolean)
                    )];
                    if (!instructors.length) return null;
                    const sel = preferredByCode[course.code] || new Set();
                    const currentVal = [...sel].find(t => instructors.includes(t)) || "";
                    return (
                      <div key={course.code} className="ai-instructor-select-row">
                        <div className="ai-instructor-select-label">
                          <span className="ai-instructor-course-code">{course.code}</span>
                          <span className="ai-instructor-select-name">
                            {lang==="tr"?(course.nameTr||course.name):course.name}
                          </span>
                        </div>
                        <select
                          className="ai-select"
                          value={currentVal}
                          onChange={e => {
                            const val = e.target.value;
                            setPreferredByCode(prev => ({
                              ...prev,
                              [course.code]: val ? new Set([val]) : new Set()
                            }));
                          }}
                        >
                          <option value="">{lang==="tr"?"— Fark etmez":"— Any instructor"}</option>
                          {instructors.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Conflict aşaması ── */}
            {stage==="conflict" && diagnoses.length>0 && (
              <div className="ai-warning">
                <div className="ai-warning-title">
                  ⚠ {lang==="tr"
                    ?"Bazı dersler kısıtlara tam uymadı — en uygun şube seçildi:"
                    :"Some courses couldn't fully match constraints — best section was chosen:"}
                </div>
                <div style={{ marginTop:8 }}>
                  {diagnoses.map((d,i) => <FailureCard key={i} diagnosis={d} lang={lang} />)}
                </div>
                <div className="ai-warning-hint">
                  {lang==="tr"
                    ?"Önizlemeye devam etmek istiyor musun?"
                    :"Would you like to continue to preview?"}
                </div>
              </div>
            )}

            {/* ── Program bulunamadı hatası ── */}
            {error && (
              <div className="ai-error" style={{ padding:"10px 12px" }}>
                <div style={{ fontWeight:600, marginBottom: diagnoses.length>0 ? 10 : 0 }}>
                  {error}
                </div>
                {diagnoses.length>0 && (
                  <div>
                    {diagnoses.map((d,i) => <FailureCard key={i} diagnosis={d} lang={lang} />)}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="ai-panel-footer">
          {stage==="conflict" ? (
            <>
              <button className="ai-cancel-btn"
                onClick={() => { setStage("form"); setViolations([]); setDiagnoses([]); }}>
                ← {lang==="tr"?"Geri":"Back"}
              </button>
              <button className="ai-generate-btn" onClick={() => setStage("preview")}>
                {lang==="tr"?"Önizle →":"Preview →"}
              </button>
            </>
          ) : (
            <>
              <button className="ai-cancel-btn" onClick={onClose}>
                {lang==="tr"?"İptal":"Cancel"}
              </button>
              <button className="ai-generate-btn" onClick={handleGenerate}
                disabled={selectedCourses.size===0||creditOver}>
                <span>✦</span> {lang==="tr"?"Önizle →":"Preview →"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
