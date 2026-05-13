import React, { useState, useEffect, useMemo, useRef } from "react";
import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Calendar from "./components/Calendar.jsx";
import AIPanel from "./components/AIPanel.jsx";
import { METU_COURSES } from "./data.js";
import { I18N } from "./i18n.js";
import { findConflicts } from "./utils.js";

export default function App() {
  const [lang, setLang] = useState("tr");
  const tr = I18N[lang];

  const [query, setQuery] = useState("");
  const [dayFilter, setDayFilter] = useState(new Set());
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [selected, setSelected] = useState([]);
  const [hoveredSection, setHoveredSection] = useState(null);
  const [conflictFlash, setConflictFlash] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [, setDraggingSection] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const calendarRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("metu-schedule");
      if (saved) {
        setSelected(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem("metu-schedule", JSON.stringify(selected));
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return METU_COURSES.filter((c) => {
      if (dayFilter.size > 0) {
        const meetsOnDay = c.sections.some((s) =>
          s.meetings.some((m) => dayFilter.has(m.d))
        );

        if (!meetsOnDay) return false;
      }

      if (!q) return true;

      const hay = `${c.code} ${c.name} ${c.nameTr} ${c.sections
        .map((s) => s.instructor)
        .join(" ")}`.toLowerCase();

      return hay.includes(q);
    });
  }, [query, dayFilter]);

  const conflicts = useMemo(
    () => findConflicts(selected, METU_COURSES),
    [selected]
  );

  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const toggleSelect = (code, sectionId) => {
    const exists = selected.find(
      (s) => s.code === code && s.sectionId === sectionId
    );

    if (exists) {
      setSelected(
        selected.filter(
          (s) => !(s.code === code && s.sectionId === sectionId)
        )
      );
      return;
    }

    const cleaned = selected.filter((s) => s.code !== code);
    const newSelected = [...cleaned, { code, sectionId }];

    setSelected(newSelected);
    setSidebarOpen(false);

    const newConflicts = findConflicts(newSelected, METU_COURSES);

    if (newConflicts[`${code}-${sectionId}`]) {
      setConflictFlash(`${code}-${sectionId}`);
      setTimeout(() => setConflictFlash(null), 800);
    }
  };

  const removeSelected = (code) => {
    setSelected(selected.filter((s) => s.code !== code));
  };

  const clearAll = () => {
    setSelected([]);
  };

  const copyCRNs = () => {
    const crns = selected
      .map((sel) => {
        const c = METU_COURSES.find((c) => c.code === sel.code);
        const s = c?.sections.find((s) => s.id === sel.sectionId);
        return s?.crn;
      })
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(crns);
    toast(tr.copied);
  };

  const totalCredits = selected.reduce((sum, sel) => {
    const c = METU_COURSES.find((c) => c.code === sel.code);
    return sum + (c?.credits || 0);
  }, 0);

  const suggestAlternative = (code) => {
    const c = METU_COURSES.find((c) => c.code === code);

    if (!c || c.sections.length < 2) return null;

    const otherSelected = selected.filter((s) => s.code !== code);

    for (const sec of c.sections) {
      const trial = [...otherSelected, { code, sectionId: sec.id }];
      const cf = findConflicts(trial, METU_COURSES);

      if (!cf[`${code}-${sec.id}`]) return sec;
    }

    return null;
  };

  const applyAISuggestion = (suggestions) => {
    // suggestions: [{code, sectionId}]
    const newSelected = suggestions
      .map(({ code, sectionId }) => {
        const course = METU_COURSES.find((c) => c.code === code);
        const section = course?.sections.find((s) => s.id === sectionId);
        if (!course || !section) return null;
        return { code, sectionId };
      })
      .filter(Boolean);
    setSelected(newSelected);
    setSidebarOpen(false);
    toast(tr.aiApplied || "Program oluşturuldu!");
  };

  const focusCourseFromCalendar = (code) => {
    setQuery(code);
    setDayFilter(new Set());
    setExpandedCourse(code);
    setSidebarOpen(true);
  };

  return (
    <div className="app">
      <Header
        tr={tr}
        lang={lang}
        setLang={setLang}
        selected={selected}
        totalCredits={totalCredits}
        onClear={clearAll}
        onCopyCRN={copyCRNs}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenAI={() => setAiPanelOpen(true)}
      />

      <div className={`main${sidebarOpen ? "" : " sidebar-collapsed"}`}>
        <Sidebar
          tr={tr}
          lang={lang}
          query={query}
          setQuery={setQuery}
          dayFilter={dayFilter}
          setDayFilter={setDayFilter}
          courses={filtered}
          expandedCourse={expandedCourse}
          setExpandedCourse={setExpandedCourse}
          selected={selected}
          conflicts={conflicts}
          toggleSelect={toggleSelect}
          setHoveredSection={setHoveredSection}
          setDraggingSection={setDraggingSection}
          conflictFlash={conflictFlash}
          suggestAlternative={suggestAlternative}
          sidebarOpen={sidebarOpen}
        />

        <Calendar
          tr={tr}
          lang={lang}
          courses={METU_COURSES}
          selected={selected}
          conflicts={conflicts}
          hoveredSection={hoveredSection}
          conflictFlash={conflictFlash}
          removeSelected={removeSelected}
          calendarRef={calendarRef}
          setDraggingSection={setDraggingSection}
          toggleSelect={toggleSelect}
          onCourseClick={focusCourseFromCalendar}
        />
      </div>

      {toastMsg && <div className="toast">{toastMsg}</div>}

      {aiPanelOpen && (
        <AIPanel
          lang={lang}
          courses={METU_COURSES}
          onApply={applyAISuggestion}
          onClose={() => setAiPanelOpen(false)}
        />
      )}
    </div>
  );
}