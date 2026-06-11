import React, { useMemo } from "react";
import { colorFor } from "../utils.js";

function safeText(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value).trim();
  if (typeof value === "object")
    return value.name || value.label || value.text || value.value ||
      value.description || value.desc || value.tr || value.en ||
      value.programName || value.programNameEng || value.programNameTr ||
      value.department || value.departmentName || fallback;
  return fallback;
}

export default function Sidebar({
  tr, lang, query, setQuery, dayFilter, setDayFilter,
  courses, expandedCourse, setExpandedCourse, selected, conflicts,
  conflictDetails, toggleSelect, setHoveredSection, setDraggingSection,
  conflictFlash, suggestAlternative, curriculumYearLabel, onClearCurriculumYear, user,
}) {
  const toggleDay = (idx) => {
    const next = new Set(dayFilter);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setDayFilter(next);
  };

  /*
    Sidebar kendi içinde filtreleme YAPMAZ.
    App.jsx deptFilteredCourses → filtered → buraya courses olarak geliyor.
    Burada tekrar filtrelemek "bölümü olmayan personel" için tüm kataloğu
    daraltıyordu. Tek sorumluluk: listeyi render et.
  */
  const visibleCourses = useMemo(() => courses || [], [courses]);

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <div className="search-wrap">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11 L14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input type="text" placeholder={tr.searchPlaceholder} value={query}
            onChange={(e) => setQuery(e.target.value)} className="search-input" />
          {query && <button className="search-clear" onClick={() => setQuery("")}>×</button>}
        </div>
      </div>

      {curriculumYearLabel && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"0 12px 8px", padding:"7px 10px", background:"var(--primary-light, #fdf0f2)", border:"1px solid var(--primary-border, #f5c6cc)", borderRadius:8, fontSize:12, color:"var(--primary, #7a1e2e)" }}>
          <span style={{ display:"flex", alignItems:"center", gap:5 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M4 1v2M12 1v2M2 6h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <strong>{curriculumYearLabel}</strong>
          </span>
          <button onClick={onClearCurriculumYear} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--primary, #7a1e2e)", fontSize:14, lineHeight:1, padding:"0 2px", opacity:0.7 }} title="Filtreyi kaldır">×</button>
        </div>
      )}

      <div className="filter-section">
        <div className="filter-label">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight:6, verticalAlign:-2 }}>
            <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 6 L14 6 M5 1 L5 4 M11 1 L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {tr.filterByDay}
        </div>
        <div className="day-pills">
          {tr.daysShort.map((d, i) => (
            <button key={i} className={`day-pill ${dayFilter.has(i) ? "active" : ""}`} onClick={() => toggleDay(i)}>{d}</button>
          ))}
        </div>
      </div>

      <div className="course-list">
        {visibleCourses.length === 0 && (
          <div className="empty-state"><div>{tr.noResults}</div></div>
        )}
        {visibleCourses.map((course) => (
          <CourseAccordion key={course.code} course={course} tr={tr} lang={lang}
            expanded={expandedCourse === course.code}
            onToggleExpand={() => setExpandedCourse(expandedCourse === course.code ? null : course.code)}
            selected={selected} conflicts={conflicts} conflictDetails={conflictDetails}
            toggleSelect={toggleSelect} setHoveredSection={setHoveredSection}
            setDraggingSection={setDraggingSection} conflictFlash={conflictFlash}
            suggestAlternative={suggestAlternative} />
        ))}
      </div>
    </aside>
  );
}

function CourseAccordion({
  course, tr, lang, expanded, onToggleExpand, selected, conflicts,
  conflictDetails, toggleSelect, setHoveredSection, setDraggingSection,
  conflictFlash, suggestAlternative,
}) {
  const colors = colorFor(course.dept);
  const selectedSection = selected.find((s) => s.code === course.code);
  const courseName = lang === "tr" ? course.nameTr : course.name;

  const handleDragStart = (e, sectionId) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", `${course.code}|${sectionId}`);
    setDraggingSection({ code: course.code, sectionId });
  };

  return (
    <div className={`course-card ${expanded ? "expanded" : ""} ${selectedSection ? "has-selection" : ""}`}>
      <button className="course-header" onClick={onToggleExpand}
        style={{ "--dept-color": colors.bg, "--dept-soft": colors.soft }}>
        <div className="course-header-left">
          <div className="course-code" style={{ color: colors.bg }}>{course.code}</div>
          <div className="course-name">{courseName}</div>
        </div>
        <div className="course-header-right">
          {selectedSection && <div className="course-tick">Eklendi</div>}
          <div className="course-credits">{course.credits}</div>
          <svg className="chev" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 6 L8 10 L12 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="course-body">
          {course.sections.map((sec) => {
            const isSelected = selectedSection?.sectionId === sec.id;
            const key = `${course.code}-${sec.id}`;
            const hasConflict = !!conflicts[key];
            const isFlash = conflictFlash === key;
            const isFull = sec.enrolled >= sec.quota;

            return (
              <div key={sec.id}
                className={`section-row ${isSelected ? "selected" : ""} ${hasConflict ? "conflict" : ""} ${isFlash ? "flash" : ""}`}
                onMouseEnter={() => setHoveredSection({ code: course.code, sectionId: sec.id })}
                onMouseLeave={() => setHoveredSection(null)}
                draggable={!isFull}
                onDragStart={(e) => handleDragStart(e, sec.id)}
                onDragEnd={() => setDraggingSection(null)}>
                <div className="section-head">
                  <div className="section-id">
                    <span className="section-num" style={{ background: colors.bg }}>{sec.id}</span>
                    <span className="section-crn">CRN {sec.crn}</span>
                  </div>
                  <div className="section-quota"></div>
                </div>
                <div className="section-instructor">{sec.instructor}</div>
                <div className="section-meetings">
                  {sec.meetings.map((m, i) => (
                    <div key={i} className="meeting-line">
                      <span className="meeting-day">{tr.daysShort[m.d]}</span>
                      <span className="meeting-time">{m.s}–{m.e}</span>
                      <span className="meeting-room">{m.room}</span>
                    </div>
                  ))}
                </div>

                {hasConflict && (() => {
                  const detail = conflictDetails?.[key];
                  const alt = suggestAlternative(course.code);
                  const hasAlt = alt && alt.id !== sec.id;
                  const altMeeting = hasAlt ? alt.meetings?.[0] : null;
                  const DAY_TR = ["Pzt", "Sal", "Çar", "Per", "Cum"];
                  const DAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri"];
                  const dayLabel = altMeeting ? (lang === "tr" ? DAY_TR : DAY_EN)[altMeeting.d] ?? "" : "";
                  return (
                    <div className="conflict-banner" style={{ flexDirection:"column", alignItems:"flex-start", gap:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ fontWeight:600 }}>{lang === "tr" ? "Zaman çakışması" : "Time conflict"}</span>
                      </div>
                      {detail && (
                        <div style={{ fontSize:11, opacity:0.85, paddingLeft:2 }}>
                          {lang === "tr" ? (
                            <><strong>{detail.withCode}</strong>{detail.withName ? ` (${detail.withName})` : ""}{" "}ile{" "}<strong>{detail.day} {detail.time}</strong>{" "}saatinde çakışıyor</>
                          ) : (
                            <>Conflicts with <strong>{detail.withCode}</strong>{detail.withName ? ` (${detail.withName})` : ""}{" "}on <strong>{detail.day}</strong> at{" "}<strong>{detail.time}</strong></>
                          )}
                        </div>
                      )}
                      {hasAlt ? (
                        <button className="suggest-btn" style={{ marginTop:2 }}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(course.code, alt.id); }}>
                          {lang === "tr"
                            ? `§${alt.id} önerilir${altMeeting ? ` — ${dayLabel} ${altMeeting.s}–${altMeeting.e}` : ""}`
                            : `Try §${alt.id}${altMeeting ? ` — ${dayLabel} ${altMeeting.s}–${altMeeting.e}` : ""}`}
                        </button>
                      ) : (
                        <div style={{ fontSize:11, color:"#c0392b", paddingLeft:2, marginTop:2 }}>
                          {lang === "tr" ? "Bu ders için uygun başka şube yok" : "No available alternative section"}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="section-actions">
                  <button className={`add-btn ${isSelected ? "added" : ""}`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(course.code, sec.id); }}
                    disabled={isFull && !isSelected}>
                    {isSelected ? tr.added : tr.add}
                  </button>
                  <span className="drag-hint">{tr.drag}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
