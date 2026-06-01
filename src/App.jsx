import React, { useState, useEffect, useMemo, useRef } from "react";
import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Calendar from "./components/Calendar.jsx";
import AIPanel from "./components/AIPanel.jsx";
import ChatBot from "./components/ChatBot.jsx";
import Login from "./components/Login.jsx";
import { METU_COURSES } from "./data.js";
import { I18N } from "./i18n.js";
import { findConflicts } from "./utils.js";

export default function App() {

  const [user, setUser] = useState(() => {

    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    const savedUser = localStorage.getItem("metu-user");
    if (token && savedUser) {
      try { return JSON.parse(savedUser); } catch { return null; }
    }
    return null;
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("metu-user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("metu-user");
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  };

  // Login ekranı göster
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // ---- Ana uygulama ----
  return <MainApp user={user} onLogout={handleLogout} />;
}

function MainApp({ user, onLogout }) {
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
  const [chatBotOpen, setChatBotOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("courses");

  const calendarRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("metu-schedule");
      if (saved) setSelected(JSON.parse(saved));
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
      setSelected(selected.filter(
        (s) => !(s.code === code && s.sectionId === sectionId)
      ));
      return;
    }
    const cleaned = selected.filter((s) => s.code !== code);
    const newSelected = [...cleaned, { code, sectionId }];
    setSelected(newSelected);
    setSidebarOpen(false);
    setMobileTab("calendar");
    const newConflicts = findConflicts(newSelected, METU_COURSES);
    if (newConflicts[`${code}-${sectionId}`]) {
      setConflictFlash(`${code}-${sectionId}`);
      setTimeout(() => setConflictFlash(null), 800);
    }
  };

  const removeSelected = (code) =>
    setSelected(selected.filter((s) => s.code !== code));

  const clearAll = () => setSelected([]);

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
    setMobileTab("calendar");
    toast(tr.aiApplied || "Program oluşturuldu!");
  };

  const focusCourseFromCalendar = (code) => {
    setQuery(code);
    setDayFilter(new Set());
    setExpandedCourse(code);
    setSidebarOpen(true);
    setMobileTab("courses");
  };

  const conflictCount = Object.keys(conflicts).length / 2;

  const sidebarProps = {
    tr, lang, query, setQuery, dayFilter, setDayFilter,
    courses: filtered, expandedCourse, setExpandedCourse,
    selected, conflicts, toggleSelect, setHoveredSection,
    setDraggingSection, conflictFlash, suggestAlternative, sidebarOpen,
  };

  const calendarProps = {
    tr, lang, courses: METU_COURSES, selected, conflicts,
    hoveredSection, conflictFlash, removeSelected, calendarRef,
    setDraggingSection, toggleSelect, onCourseClick: focusCourseFromCalendar,
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
        onOpenAI={() => setChatBotOpen(true)}
        onOpenAutoSchedule={() => setAiPanelOpen(true)}
        user={user}
        onLogout={onLogout}
      />

      {/* Desktop layout */}
      <div className={`desktop-main${sidebarOpen ? "" : " sidebar-collapsed"}`}>
        <Sidebar {...sidebarProps} />
        <Calendar {...calendarProps} />
      </div>

      {/* Mobil tab layout */}
      <div className="mobile-main">
        <div className={`mobile-panel${mobileTab === "courses" ? " active" : ""}`}>
          <Sidebar {...sidebarProps} sidebarOpen={true} />
        </div>
        <div className={`mobile-panel${mobileTab === "calendar" ? " active" : ""}`}>
          <Calendar {...calendarProps} />
        </div>

        <nav className="mobile-tab-bar">
          {selected.length > 0 && (
            <div className="mobile-tab-stats">
              <span>{selected.length} {lang === "tr" ? "ders" : "courses"}</span>
              <span className="mobile-tab-stats-dot">·</span>
              <span>{totalCredits} {lang === "tr" ? "kredi" : "credits"}</span>
              {conflictCount > 0 && (
                <>
                  <span className="mobile-tab-stats-dot">·</span>
                  <span className="mobile-tab-stats-conflict">
                    ⚠ {conflictCount} {lang === "tr" ? "çakışma" : "conflict"}
                  </span>
                </>
              )}
            </div>
          )}
          <div className="mobile-tab-buttons">
            <button
              className={`mobile-tab${mobileTab === "courses" ? " active" : ""}`}
              onClick={() => setMobileTab("courses")}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="4" width="14" height="2.5" rx="1.25" fill="currentColor" />
                <rect x="3" y="8.75" width="14" height="2.5" rx="1.25" fill="currentColor" />
                <rect x="3" y="13.5" width="10" height="2.5" rx="1.25" fill="currentColor" />
              </svg>
              <span>{lang === "tr" ? "Dersler" : "Courses"}</span>
            </button>
            <button
              className={`mobile-tab${mobileTab === "calendar" ? " active" : ""}`}
              onClick={() => setMobileTab("calendar")}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 8h14" stroke="currentColor" strokeWidth="1.6" />
                <path d="M7 2v3M13 2v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span>{lang === "tr" ? "Program" : "Schedule"}</span>
            </button>
          </div>
        </nav>
      </div>

      {!chatBotOpen && (
        <button
          type="button"
          className="ask-me-floating"
          onClick={() => setChatBotOpen(true)}
          aria-label={lang === "tr" ? "Ask Me asistanını aç" : "Open Ask Me assistant"}
        >
          <span className="ask-me-floating-face" aria-hidden="true">
            <span className="ask-me-floating-eye left" />
            <span className="ask-me-floating-eye right" />
            <span className="ask-me-floating-smile" />
          </span>
        </button>
      )}

      {toastMsg && <div className="toast">{toastMsg}</div>}

      {aiPanelOpen && (
        <AIPanel
          lang={lang}
          courses={METU_COURSES}
          onApply={applyAISuggestion}
          onClose={() => setAiPanelOpen(false)}
        />
      )}

      {chatBotOpen && (
        <ChatBot
          lang={lang}
          courses={METU_COURSES}
          onApply={applyAISuggestion}
          onClose={() => setChatBotOpen(false)}
        />
      )}
    </div>
  );
}
