import React, { useState, useMemo } from "react";
import { toMin, sectionsConflict } from "../utils.js";

const DAYS_SHORT_TR = ["PZT", "SAL", "ÇAR", "PER", "CUM"];
const DAYS_SHORT_EN = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_KEYS = [0, 1, 2, 3, 4];
const TIME_OPTIONS = ["08:40","09:40","10:40","11:40","12:40","13:40","14:40","15:40","16:40","17:40"];

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
    if (latestEnd && toMin(m.e) > toMin(latestEnd)) return false;
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
    for (let i=1;i<s.length;i++) { const g=Math.max(0,s[i].start-s[i-1].end); totalGap+=g; maxGap=Math.max(maxGap,g); }
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
  if (options.compactMode==="spaced") score -= Math.max(0, 60-stats.maxGap);
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
    const valid = course.sections.filter(s => sectionPassesConstraints(s, options.freeDays, options.earliestStart, options.latestEnd));
    const cands = valid.length>0 ? valid : course.sections;
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
  return result.map(s => ({ schedule: s, score: scoreSchedule(s, options) }))
    .sort((a,b) => b.score-a.score)[0].schedule;
}
function getConstraintViolations(courseList, freeDays, earliestStart, latestEnd, lang) {
  const ds = lang==="tr" ? DAYS_SHORT_TR : DAYS_SHORT_EN;
  return courseList.filter(course => !course.sections.some(s =>
    sectionPassesConstraints(s, freeDays, earliestStart, latestEnd)
  )).map(course => {
    const reasons = [];
    if (freeDays.size>0) {
      const bl = [...freeDays].filter(d => course.sections.every(s => s.meetings.some(m => m.d===d)));
      if (bl.length) reasons.push(lang==="tr" ? `${ds[bl[0]]} günü yok` : `no section on ${ds[bl[0]]}`);
    }
    if (latestEnd && course.sections.every(s => s.meetings.some(m => toMin(m.e)>toMin(latestEnd))))
      reasons.push(lang==="tr" ? `${latestEnd} sonrası bitiyor` : `ends after ${latestEnd}`);
    return { code: course.code, reasons };
  });
}

// ── Önizleme ekranı ───────────────────────────────────────────
const DAY_NAMES_TR = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma"];
const DAY_NAMES_EN = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

function PreviewScreen({ schedule, courses, lang, onApply, onBack, onClose }) {
  // schedule: [{ code, sectionId, section }]
  const dayNames = lang==="tr" ? DAY_NAMES_TR : DAY_NAMES_EN;

  // Günlere göre grupla
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
          start: m.s,
          end: m.e,
          credits: course.credits,
        });
      }
    }
    // Sırala
    Object.values(map).forEach(arr => arr.sort((a,b) => toMin(a.start)-toMin(b.start)));
    return map;
  }, [schedule, courses, lang]);

  const totalCredits = schedule.reduce((sum, item) => {
    return sum + (courses.find(c=>c.code===item.code)?.credits||0);
  }, 0);

  const campusDays = Object.keys(byDay).length;

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
            <span className="ai-preview-stat-num">{campusDays}</span>
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
        <button className="ai-cancel-btn" onClick={onBack}>
          ← {lang==="tr"?"Değiştir":"Edit"}
        </button>
        <button className="ai-generate-btn" onClick={onApply}>
          ✓ {lang==="tr"?"Programı Uygula":"Apply Schedule"}
        </button>
      </div>
    </div>
  );
}

export default function AIPanel({ lang, courses, onApply, onClose }) {
  const [freeDays, setFreeDays]               = useState(new Set());
  const [maxDailyHours, setMaxDailyHours]     = useState(8);
  const [earliestStart, setEarliestStart]     = useState("");
  const [latestEnd, setLatestEnd]             = useState("");
  const [compactMode, setCompactMode]         = useState("any");
  const [creditLimit, setCreditLimit]         = useState("");
  const [preferredByCode, setPreferredByCode] = useState({});
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [courseSearch, setCourseSearch]       = useState("");
  const [error, setError]                     = useState(null);
  const [violations, setViolations]           = useState([]);
  // null = form, "conflict" = çakışma onayı, "preview" = önizleme
  const [stage, setStage]                     = useState("form");
  const [generatedSchedule, setGeneratedSchedule] = useState(null);

  const daysShort = lang==="tr" ? DAYS_SHORT_TR : DAYS_SHORT_EN;

  const selectedCourseList = useMemo(() =>
    [...selectedCourses].map(code => courses.find(c=>c.code===code)).filter(Boolean),
  [selectedCourses, courses]);

  const totalCredits = useMemo(() =>
    [...selectedCourses].reduce((sum,code) => sum+(courses.find(c=>c.code===code)?.credits||0), 0),
  [selectedCourses, courses]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses.slice(0,60);
    return courses.filter(c =>
      `${c.code} ${c.name} ${c.nameTr||""} ${c.sections.map(s=>s.instructor).join(" ")}`.toLowerCase().includes(q)
    ).slice(0,40);
  }, [courses, courseSearch]);

  const creditLimitNum = creditLimit ? Number(creditLimit) : null;
  const creditOver = creditLimitNum && totalCredits > creditLimitNum;

  const allPreferredTeachers = useMemo(() =>
    Object.values(preferredByCode).flatMap(s=>[...s]),
  [preferredByCode]);

  const toggleDay = d => { const n=new Set(freeDays); n.has(d)?n.delete(d):n.add(d); setFreeDays(n); };
  const toggleCourse = code => { const n=new Set(selectedCourses); n.has(code)?n.delete(code):n.add(code); setSelectedCourses(n); };
  const toggleInstructor = (code, t) => {
    const prev = preferredByCode[code] ? new Set(preferredByCode[code]) : new Set();
    prev.has(t) ? prev.delete(t) : prev.add(t);
    setPreferredByCode({ ...preferredByCode, [code]: prev });
  };

  const handleGenerate = () => {
    setError(null); setViolations([]);
    if (selectedCourses.size===0) { setError(lang==="tr"?"En az bir ders seç.":"Select at least one course."); return; }
    if (creditOver) { setError(lang==="tr"?`Kredi limiti aşıldı (${totalCredits}/${creditLimitNum}).`:"Credit limit exceeded."); return; }
    const courseList = [...selectedCourses].map(code=>courses.find(c=>c.code===code)).filter(Boolean);
    const options = { freeDays, maxDailyHours, earliestStart: earliestStart||null, latestEnd: latestEnd||null, compactMode, preferredTeachers: allPreferredTeachers };
    const schedule = findBestSchedule(courseList, options);
    if (!schedule) { setError(lang==="tr"?"Kısıtlara uyan program bulunamadı. Bazı kısıtları gevşet.":"No valid schedule found."); return; }
    const found = getConstraintViolations(courseList, freeDays, earliestStart||null, latestEnd||null, lang);
    if (found.length>0) { setViolations(found); setGeneratedSchedule(schedule); setStage("conflict"); return; }
    // Önizleme aşamasına geç
    setGeneratedSchedule(schedule);
    setStage("preview");
  };

  const handleApply = () => {
    onApply(generatedSchedule.map(({code,sectionId}) => ({code,sectionId})));
    onClose();
  };

  // Önizleme ekranı
  if (stage==="preview") {
    return (
      <div className="ai-panel-overlay" onClick={onClose}>
        <div className="ai-panel" onClick={e=>e.stopPropagation()}>
          <div className="ai-panel-header">
            <div className="ai-panel-title"><span className="ai-sparkle">✦</span>{lang==="tr"?"Program Önizlemesi":"Schedule Preview"}</div>
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

  return (
    <div className="ai-panel-overlay" onClick={onClose}>
      <div className="ai-panel" onClick={e=>e.stopPropagation()}>

        <div className="ai-panel-header">
          <div className="ai-panel-title"><span className="ai-sparkle">✦</span>{lang==="tr"?"Otomatik Program Oluştur":"Auto Schedule"}</div>
          <button className="ai-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-panel-body ai-panel-grid">

          {/* Sol */}
          <div className="ai-col ai-col-left">
            <div className="ai-field" style={{height:"100%",display:"flex",flexDirection:"column"}}>
              <label className="ai-label">
                {lang==="tr"?"Dersler":"Courses"}
                {selectedCourses.size>0 && (
                  <span className={`ai-label-badge${creditOver?" ai-badge-warn":""}`}>
                    {selectedCourses.size} ders · {totalCredits} kredi{creditLimitNum?` / ${creditLimitNum}`:""}
                  </span>
                )}
              </label>
              <input type="text" className="ai-course-search"
                placeholder={lang==="tr"?"Ders kodu, isim veya hoca...":"Code, name or instructor..."}
                value={courseSearch} onChange={e=>setCourseSearch(e.target.value)} />
              <div className="ai-course-list" style={{flex:1}}>
                {filteredCourses.map(c => (
                  <label key={c.code} className={`ai-course-item${selectedCourses.has(c.code)?" selected":""}`}>
                    <input type="checkbox" checked={selectedCourses.has(c.code)} onChange={() => toggleCourse(c.code)} />
                    <span className="ai-course-code">{c.code}</span>
                    <span className="ai-course-name">{lang==="tr"?(c.nameTr||c.name):c.name}</span>
                    <span className="ai-course-cr">{c.credits}k</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ */}
          <div className="ai-col ai-col-right">

            {/* Boş günler */}
            <div className="ai-field">
              <label className="ai-label">{lang==="tr"?"Boş kalsın":"Free days"}</label>
              <div className="ai-day-pills">
                {daysShort.map((d,i) => (
                  <button key={DAY_KEYS[i]} className={`ai-day-pill${freeDays.has(DAY_KEYS[i])?" active":""}`} onClick={() => toggleDay(DAY_KEYS[i])}>{d}</button>
                ))}
              </div>
              {/* Sadece görsel kutucuklar + X/5 gün — liste YOK */}
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
                  <button key={h} className={`ai-hours-step${maxDailyHours===h?" active":""}${maxDailyHours>h?" past":""}`} onClick={() => setMaxDailyHours(h)}>{h}</button>
                ))}
              </div>
            </div>

            {/* Saat aralığı */}
            <div className="ai-field">
              <label className="ai-label">{lang==="tr"?"Saat aralığı":"Time range"}</label>
              <div className="ai-time-range-box">
                <div className="ai-time-slot">
                  <span className="ai-time-slot-label">{lang==="tr"?"En erken başlangıç":"Earliest start"}</span>
                  <select className="ai-select" value={earliestStart} onChange={e=>setEarliestStart(e.target.value)}>
                    <option value="">{lang==="tr"?"Fark etmez":"Any"}</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="ai-time-range-sep" />
                <div className="ai-time-slot">
                  <span className="ai-time-slot-label">{lang==="tr"?"En geç bitiş":"Latest end"}</span>
                  <select className="ai-select" value={latestEnd} onChange={e=>setLatestEnd(e.target.value)}>
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
                  <button key={n} className={`ai-credit-chip${creditLimit==n?" active":""}`} onClick={() => setCreditLimit(creditLimit==n?"":String(n))}>{n}</button>
                ))}
                <input className="ai-credit-input" type="number" min={1} max={30} placeholder={lang==="tr"?"özel":"custom"} value={creditLimit} onChange={e=>setCreditLimit(e.target.value)} />
              </div>
              {creditOver && <div className="ai-credit-warn">⚠ {lang==="tr"?`${totalCredits} kredi seçildi, limit ${creditLimitNum}`:`${totalCredits} credits, limit ${creditLimitNum}`}</div>}
            </div>

            {/* Hoca — her ders için select dropdown */}
            {selectedCourseList.length>0 && (
              <div className="ai-field">
                <label className="ai-label">
                  {lang==="tr"?"Tercih edilen hocalar":"Preferred instructors"}
                  {allPreferredTeachers.length>0 && <span className="ai-label-badge">{allPreferredTeachers.length} seçili</span>}
                </label>
                <div className="ai-instructor-selects">
                  {selectedCourseList.map(course => {
                    const instructors = [...new Set(course.sections.map(s=>s.instructor).filter(Boolean))];
                    if (!instructors.length) return null;
                    const sel = preferredByCode[course.code] || new Set();
                    // select value: seçili hoca varsa ilkini göster, yoksa ""
                    const currentVal = [...sel].find(t => instructors.includes(t)) || "";
                    return (
                      <div key={course.code} className="ai-instructor-select-row">
                        <div className="ai-instructor-select-label">
                          <span className="ai-instructor-course-code">{course.code}</span>
                          <span className="ai-instructor-select-name">{lang==="tr"?(course.nameTr||course.name):course.name}</span>
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
                          {instructors.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Program stili */}
            <div className="ai-field">
              <label className="ai-label">{lang==="tr"?"Program stili":"Schedule style"}</label>
              <div className="ai-style-chips">
                {[
                  { val:"compact", label: lang==="tr"?"Boşluksuz":"Compact" },
                  { val:"any",     label: lang==="tr"?"En iyi uyum":"Best fit" },
                  { val:"spaced",  label: lang==="tr"?"Molalı":"With breaks" },
                ].map(opt => (
                  <button key={opt.val} className={`ai-style-chip${compactMode===opt.val?" active":""}`} onClick={() => setCompactMode(opt.val)}>{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Çakışma uyarısı */}
            {stage==="conflict" && violations.length>0 && (
              <div className="ai-warning">
                <div className="ai-warning-title">⚠ {lang==="tr"?"Bazı dersler sığmıyor":"Some courses don't fit"}</div>
                <div className="ai-warning-list">
                  {violations.map((v,i) => (
                    <div key={i} className="ai-warning-item">
                      <span className="ai-warning-code">{v.code}</span>
                      <span className="ai-warning-reason">{v.reasons.join(" · ")}</span>
                    </div>
                  ))}
                </div>
                <div className="ai-warning-hint">{lang==="tr"?"En uygun şube seçildi. Önizlemeye devam edilsin mi?":"Best section selected. Continue to preview?"}</div>
              </div>
            )}
            {error && <div className="ai-error">{error}</div>}
          </div>
        </div>

        <div className="ai-panel-footer">
          {stage==="conflict" ? (
            <>
              <button className="ai-cancel-btn" onClick={() => { setStage("form"); setViolations([]); }}>← {lang==="tr"?"Geri":"Back"}</button>
              <button className="ai-generate-btn" onClick={() => setStage("preview")}>{lang==="tr"?"Önizle →":"Preview →"}</button>
            </>
          ) : (
            <>
              <button className="ai-cancel-btn" onClick={onClose}>{lang==="tr"?"İptal":"Cancel"}</button>
              <button className="ai-generate-btn" onClick={handleGenerate} disabled={selectedCourses.size===0||creditOver}>
                <span>✦</span> {lang==="tr"?"Önizle →":"Preview →"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
