import React, { useState, useEffect, useMemo, useRef } from "react";
import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Calendar from "./components/Calendar.jsx";
import AIPanel from "./components/AIPanel.jsx";

import Login from "./components/Login.jsx";
import CurriculumModal from "./components/CurriculumModal.jsx";
import { loadMetuCourses } from "./data.js";
import { I18N } from "./i18n.js";
import { findConflicts } from "./utils.js";
import { saveToken, validateCasTicket } from "./api/auth.js";

const normCode = (s) => (s || "").replace(/\s+/g, "").toUpperCase();

export default function App() {
  const [user, setUser] = useState(() => {
    const token =
      localStorage.getItem("metu-token") || sessionStorage.getItem("metu-token");
    const savedUser = localStorage.getItem("metu-user");
    if (token && savedUser) {
      try { return JSON.parse(savedUser); } catch { return null; }
    }
    return null;
  });
  const [casLoading, setCasLoading] = useState(false);
  const [casError, setCasError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ticket");
    if (!ticket) return;

    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    setCasLoading(true);
    setCasError("");

    validateCasTicket(ticket, "http://planify.metu.edu.tr/")
      .then(({ token, user: userData }) => {
        saveToken(token);
        localStorage.setItem("metu-user", JSON.stringify(userData));
        setUser(userData);
      })
      .catch((err) => setCasError(err.message || "CAS girişi başarısız."))
      .finally(() => setCasLoading(false));
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("metu-user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("metu-user");
    localStorage.removeItem("metu-token");
    sessionStorage.removeItem("metu-token");
    sessionStorage.removeItem("metu-user");
    // Sayfayı temiz URL ile yenile — login ekranına döner
    window.location.href = window.location.origin + window.location.pathname;
  };

  if (casLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontSize: "1.1rem", color: "#7a1e2e"
      }}>
        ODTÜ kimliği doğrulanıyor...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} casError={casError} />;
  }

  return <MainApp user={user} onLogout={handleLogout} />;
}

function MainApp({ user, onLogout }) {
  const [lang, setLang] = useState("tr");
  const tr = I18N[lang];

  const [courses, setCourses] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  useEffect(() => {
    loadMetuCourses()
      .then((data) => { setCourses(data); setDataLoading(false); })
      .catch((err) => {
        console.error("Veri yüklenemedi:", err);
        setDataError("Ders verisi yüklenemedi. Lütfen sayfayı yenileyin.");
        setDataLoading(false);
      });
  }, []);

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
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [curriculumCodes, setCurriculumCodes] = useState(null);
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
    return courses.filter((c) => {
      if (dayFilter.size > 0) {
        const meetsOnDay = c.sections.some((s) =>
          s.meetings.some((m) => dayFilter.has(m.d))
        );
        if (!meetsOnDay) return false;
      }
      if (!q) return true;
      const hay = `${c.code} ${c.name} ${c.nameTr} ${c.sections
        .map((s) => s.instructor).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, dayFilter, allCoursesForUser, courses, previewUser, user]);

  const conflicts = useMemo(
    () => findConflicts(selected, courses),
    [selected, courses]
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
    const trial = [...cleaned, { code, sectionId }];
    const newConflicts = findConflicts(trial, courses);
    const conflictKey = `${code}-${sectionId}`;

    if (newConflicts[conflictKey]) {
      // Çakışan dersin kodunu bul
      const conflictingKey = newConflicts[conflictKey]; // "OTHERCODE-01"
      const conflictingCode = conflictingKey.split("-")[0];
      const conflictingCourse = courses.find(c => c.code === conflictingCode);
      const conflictName = conflictingCourse?.name || conflictingCode;

      // Alternatif section var mı?
      const course = courses.find(c => c.code === code);
      const alt = course?.sections.find(sec => {
        if (sec.id === sectionId) return false;
        const t2 = [...cleaned, { code, sectionId: sec.id }];
        return !findConflicts(t2, courses)[`${code}-${sec.id}`];
      });

      if (alt) {
        // Alternatif section öner
        setConflictFlash(conflictKey);
        setTimeout(() => setConflictFlash(null), 800);
        const msg = `⚠ §${sectionId} — ${conflictName} ile çakışıyor. §${alt.id} eklenebilir.`;
        toast(msg);
        // Alternatifi otomatik ekle
        const newSelected = [...cleaned, { code, sectionId: alt.id }];
        setSelected(newSelected);
      } else {
        toast(`⚠ ${code} için uygun section yok — tüm sectionlar ${conflictName} ile çakışıyor.`);
        setConflictFlash(conflictKey);
        setTimeout(() => setConflictFlash(null), 800);
      }
      setSidebarOpen(false);
      setMobileTab("calendar");
      return;
    }

    // Çakışma yok, normal ekle
    setSelected(trial);
    setSidebarOpen(false);
    setMobileTab("calendar");
  };

  const removeSelected = (code) =>
    setSelected(selected.filter((s) => s.code !== code));

  const clearAll = () => setSelected([]);

  const copyCRNs = () => {
    const crns = selected
      .map((sel) => {
        const c = courses.find((c) => c.code === sel.code);
        const s = c?.sections.find((s) => s.id === sel.sectionId);
        return s?.crn;
      })
      .filter(Boolean).join("\n");
    navigator.clipboard.writeText(crns);
    toast(tr.copied);
  };

  const totalCredits = selected.reduce((sum, sel) => {
    const c = courses.find((c) => c.code === sel.code);
    return sum + (c?.credits || 0);
  }, 0);

  const suggestAlternative = (code) => {
    const c = courses.find((c) => c.code === code);
    if (!c || c.sections.length < 2) return null;
    const otherSelected = selected.filter((s) => s.code !== code);
    for (const sec of c.sections) {
      const trial = [...otherSelected, { code, sectionId: sec.id }];
      const cf = findConflicts(trial, courses);
      if (!cf[`${code}-${sec.id}`]) return sec;
    }
    return null;
  };

  const applyAISuggestion = (suggestions) => {
    const newSelected = suggestions
      .map(({ code, sectionId }) => {
        const course = courses.find((c) => c.code === code);
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

  const handleCurriculumApply = (codes) => {
    // Her ders kodu için katalogdan ilk section'ı bul ve takvime ekle
    const newEntries = [];
    codes.forEach((normCd) => {
      const course = courses.find((c) => c.code === normCd || normCode(c.code) === normCd);
      if (!course || !course.sections?.length) return;
      // Çakışmayan ilk section'ı bul, yoksa ilkini al
      const existing = [...selected, ...newEntries];
      let picked = course.sections.find((sec) => {
        const trial = [...existing, { code: course.code, sectionId: sec.id }];
        return !findConflicts(trial, courses)[`${course.code}-${sec.id}`];
      }) || course.sections[0];
      newEntries.push({ code: course.code, sectionId: picked.id });
    });

    if (!newEntries.length) return;

    // Mevcut seçimde olmayan dersleri ekle (aynı ders zaten varsa geçme)
    const merged = [...selected];
    newEntries.forEach((entry) => {
      if (!merged.find((s) => s.code === entry.code)) {
        merged.push(entry);
      }
    });
    setSelected(merged);
    setCurriculumOpen(false);
    setSidebarOpen(false);
    setMobileTab("calendar");
    toast(`${newEntries.length} ders takvime eklendi`);
  };

  const conflictCount = Object.keys(conflicts).length / 2;

  if (dataLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontSize: "1.1rem", color: "#666"
      }}>
        Ders verisi yükleniyor...
      </div>
    );
  }

  if (dataError) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontSize: "1.1rem", color: "#e53e3e"
      }}>
        {dataError}
      </div>
    );
  }

  const sidebarProps = {
    tr, lang, query, setQuery, dayFilter, setDayFilter,
    courses: filtered, expandedCourse, setExpandedCourse,
    selected, conflicts, toggleSelect, setHoveredSection,
    setDraggingSection, conflictFlash, suggestAlternative, sidebarOpen,
  };

  const calendarProps = {
    tr, lang, courses, selected, conflicts,
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
        onOpenAutoSchedule={() => {
          const preselected = selected.length > 0
            ? new Set(selected.map(s => s.code))
            : null;
          setCurriculumCodes(preselected);
          setAiPanelOpen(true);
        }}
        onOpenCurriculum={() => setCurriculumOpen(true)}
        user={user}
        onLogout={onLogout}
      />

      <div className={`desktop-main${sidebarOpen ? "" : " sidebar-collapsed"}`}>
        <Sidebar {...sidebarProps} />
        <Calendar {...calendarProps} />
      </div>

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
            <button
              className="mobile-tab"
              onClick={() => setCurriculumOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M6 7h8M6 10h6M6 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>{lang === "tr" ? "Müfredat" : "Curriculum"}</span>
            </button>
          </div>
        </nav>
      </div>

      {toastMsg && <div className="toast">{toastMsg}</div>}

      {curriculumOpen && (
        <CurriculumModal
          lang={lang}
          courses={courses}
          onApplyToScheduler={handleCurriculumApply}
          onClose={() => setCurriculumOpen(false)}
        />
      )}

      {aiPanelOpen && (
        <AIPanel
          lang={lang}
          courses={courses}
          initialCourses={curriculumCodes}
          onApply={applyAISuggestion}
          onClose={() => { setAiPanelOpen(false); setCurriculumCodes(null); }}
        />
      )}

      {chatBotOpen && (
        <ChatBot
          lang={lang}
          courses={courses}
          onApply={applyAISuggestion}
          onClose={() => setChatBotOpen(false)}
        />
      )}
    </div>
  );
}
