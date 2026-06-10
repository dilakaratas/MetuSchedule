import React, { useMemo } from "react";
import { colorFor } from "../utils.js";

export default function Sidebar({
  tr, lang, query, setQuery, dayFilter, setDayFilter,
  courses, expandedCourse, setExpandedCourse,
  selected, conflicts, toggleSelect,
  setHoveredSection, setDraggingSection, conflictFlash, suggestAlternative,
}) {
  const toggleDay = (idx) => {
    const next = new Set(dayFilter);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setDayFilter(next);
  };

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

      <div className="filter-section">
        <div className="filter-label">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6, verticalAlign: -2 }}>
            <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 6 L14 6 M5 1 L5 4 M11 1 L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {tr.filterByDay}
        </div>
        <div className="day-pills">
          {tr.daysShort.map((d, i) => (
            <button key={i} className={`day-pill ${dayFilter.has(i) ? "active" : ""}`}
              onClick={() => toggleDay(i)}>{d}</button>
          ))}
        </div>
      </div>

      <div className="course-list">
        {courses.length === 0 && (
          <div className="empty-state">
            <div className="empty-emoji">🔍</div>
            <div>{tr.noResults}</div>
          </div>
        )}
        {courses.map((course) => (
          <CourseAccordion key={course.code} course={course} tr={tr} lang={lang}
            expanded={expandedCourse === course.code}
            onToggleExpand={() => setExpandedCourse(expandedCourse === course.code ? null : course.code)}
            selected={selected} conflicts={conflicts} toggleSelect={toggleSelect}
            setHoveredSection={setHoveredSection} setDraggingSection={setDraggingSection}
            conflictFlash={conflictFlash} suggestAlternative={suggestAlternative} />
        ))}
      </div>
    </aside>
  );
}

function CourseAccordion({
  course, tr, lang, expanded, onToggleExpand,
  selected, conflicts, toggleSelect,
  setHoveredSection, setDraggingSection, conflictFlash, suggestAlternative,
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
          {selectedSection && <div className="course-tick">✓</div>}
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
                {hasConflict && (
                  <div className="conflict-banner">
                    <span className="conflict-icon">⚠</span>
                    <span>{tr.conflictMsg}</span>
                    {(() => {
                      const alt = suggestAlternative(course.code);
                      if (alt && alt.id !== sec.id) {
                        return (
                          <button className="suggest-btn"
                            onClick={(e) => { e.stopPropagation(); toggleSelect(course.code, alt.id); }}>
                            {tr.suggestion}: §{alt.id}
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
                <div className="section-actions">
                  <button className={`add-btn ${isSelected ? "added" : ""}`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(course.code, sec.id); }}
                    disabled={isFull && !isSelected}>
                    {isSelected ? `✓ ${tr.added}` : tr.add}
                  </button>
                  <span className="drag-hint">⠿ {tr.drag}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
