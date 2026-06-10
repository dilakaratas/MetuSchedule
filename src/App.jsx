import React, { useState, useEffect, useMemo, useRef } from "react";
import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Calendar from "./components/Calendar.jsx";
import AIPanel from "./components/AIPanel.jsx";

import Login from "./components/Login.jsx";
import CurriculumModal from "./components/CurriculumModal.jsx";
import { loadMetuCourses } from "./data.js";
import { I18N } from "./i18n.js";
import { findConflicts, sectionsConflict } from "./utils.js";
import { saveToken, validateCasTicket } from "./api/auth.js";

const normCode = (s) => (s || "").replace(/\s+/g, "").toUpperCase();

// ── Auth yardımcıları ─────────────────────────────────────────────
function clearAllAuth() {
  localStorage.removeItem("metu-user");
  localStorage.removeItem("metu-token");
  sessionStorage.removeItem("metu-token");
  sessionStorage.removeItem("metu-user");
}

function readStoredUser() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("loggedout") === "1") {
    clearAllAuth();
    const clean = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, clean);
    return null;
  }
  const token = localStorage.getItem("metu-token") || sessionStorage.getItem("metu-token");
  const saved = localStorage.getItem("metu-user");
  if (token && saved) {
    try { return JSON.parse(saved); } catch { return null; }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]             = useState(() => readStoredUser());
  const [casLoading, setCasLoading] = useState(false);
  const [casError,   setCasError]   = useState("");

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
    clearAllAuth();
    const base    = window.location.origin + window.location.pathname;
    const service = encodeURIComponent(`${base}?loggedout=1`);
    window.location.href = `https://login.metu.edu.tr/cas/logout?service=${service}`;
  };

  const handleAdminLogout = () => {
    clearAllAuth();
    setUser(null);
  };

  if (casLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontSize: "1.1rem", color: "#7a1e2e",
      }}>
        ODTÜ kimliği doğrulanıyor...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} casError={casError} />;
  }

  const logoutFn = user.role === "admin" ? handleAdminLogout : handleLogout;
  return <MainApp user={user} onLogout={logoutFn} />;
}

// ─────────────────────────────────────────────────────────────────

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

  // Öğrencinin yılına ait müfredat ders kodları (otomatik filtre)
  const [curriculumYearCodes, setCurriculumYearCodes] = useState(null);
  const [curriculumYearLabel, setCurriculumYearLabel] = useState("");

  const calendarRef = useRef(null);

  // OIBS'den gelen dept + yearNum ile müfredat derslerini otomatik yükle
  useEffect(() => {
    const dept = (user?.dept || user?.programCode || "").toUpperCase();
    const year = Number(user?.yearNum);
    if (!dept || !year) return;

    const ENG_FILES = ["/metu_engineering_catalog.json", "/metu_eng_faculty_mufredat.json"];
    const YEAR_TO_NUM = {
      "FIRST YEAR": 1, "SECOND YEAR": 2, "THIRD YEAR": 3,
      "FOURTH YEAR": 4, "FIFTH YEAR": 5,
    };

    (async () => {
      for (const file of ENG_FILES) {
        try {
          const r = await fetch(file);
          if (!r.ok) continue;
          const data = await r.json();

          let programs = [];
          let fmt = null;
          if (data?.programs?.length)       { programs = data.programs; fmt = "new"; }
          else if (data?.bolumler?.length)  { programs = data.bolumler; fmt = "old"; }
          if (!programs.length) continue;

          const prog = programs.find((p) => {
            const code = (p.program_code || p.bolum_kodu || p.department_code || "").toUpperCase();
            const name = (p.program_name || p.bolum_adi || p.name || "").toUpperCase();
            return code === dept || name.startsWith(dept);
          });
          if (!prog) continue;

          const codes = new Set();
          if (fmt === "new") {
            for (const entry of prog.curriculum || []) {
              const yilNo = YEAR_TO_NUM[entry.year] ?? 0;
              if (yilNo !== year) continue;
              for (const c of entry.courses || []) {
                if (c.code) codes.add(c.code.replace(/\s+/g, "").toUpperCase());
              }
            }
          } else {
            const yilData = (prog.mufredat || []).find((y) => Number(y.yil) === year);
            for (const yy of yilData?.yariyillar || []) {
              for (const d of yy.dersler || []) {
                if (d.kod) codes.add(d.kod.replace(/\s+/g, "").toUpperCase());
              }
            }
          }

          if (codes.size > 0) {
            setCurriculumYearCodes(codes);
            setCurriculumYearLabel(`${year}. Yıl ${dept} Dersleri`);
            return;
          }
        } catch {}
      }
    })();
  }, [user?.dept, user?.programCode, user?.yearNum]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("metu-schedule");
      if (saved) setSelected(JSON.parse(saved));
    } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem("metu-schedule", JSON.stringify(selected));
  }, [selected]);

  // OIBS'den gelen programCode → sidebar filtresi
  const userDept = (user?.dept || user?.programCode || "").toUpperCase() || null;

  const deptFilteredCourses = useMemo(() => {
    if (!userDept) return courses;
    return courses.filter((c) => {
      const code = normCode(c.code);
      return code.startsWith(userDept) || isServiceCourse(code);
    });
  }, [courses, userDept]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deptFilteredCourses.filter((c) => {
      if (curriculumYearCodes) {
        if (!curriculumYearCodes.has(normCode(c.code))) return false;
      }
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
  }, [query, dayFilter, deptFilteredCourses, curriculumYearCodes]);

  const conflicts = useMemo(
    () => findConflicts(selected, courses),
    [selected, courses]
  );

  const conflictDetails = useMemo(() => {
    const details = {};
    const DAY_NAMES_TR = ["Pzt", "Sal", "Çar", "Per", "Cum"];
    const DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const list = selected.map((sel) => {
      const course = courses.find((c) => c.code === sel.code);
      const section = course?.sections.find((s) => s.id === sel.sectionId);
      return { sel, course, section };
    });
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]; const b = list[j];
        if (!a.section || !b.section) continue;
        const overlap = sectionsConflict(a.section, b.section);
        if (overlap) {
          const dayNames = lang === "tr" ? DAY_NAMES_TR : DAY_NAMES_EN;
          const day = dayNames[overlap.m1.d] || overlap.m1.d;
          const timeStr = `${overlap.m1.s}–${overlap.m1.e}`;
          const ka = `${a.sel.code}-${a.sel.sectionId}`;
          const kb = `${b.sel.code}-${b.sel.sectionId}`;
          details[ka] = { withCode: b.sel.code, withName: lang === "tr" ? b.course?.nameTr : b.course?.name, day, time: timeStr };
          details[kb] = { withCode: a.sel.code, withName: lang === "tr" ? a.course?.nameTr : a.course?.name, day, time: timeStr };
        }
      }
    }
    return details;
  }, [selected, courses, lang]);

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
      const conflictingKey = newConflicts[conflictKey];
      const conflictingCode = conflictingKey.split("-")[0];
      const conflictingCourse = courses.find(c => c.code === conflictingCode);
      const conflictName = conflictingCourse?.name || conflictingCode;

      const course = courses.find(c => c.code === code);
      const alt = course?.sections.find(sec => {
        if (sec.id === sectionId) return false;
        const t2 = [...cleaned, { code, sectionId: sec.id }];
        return !findConflicts(t2, courses)[`${code}-${sec.id}`];
      });

      if (alt) {
        setConflictFlash(conflictKey);
        setTimeout(() => setConflictFlash(null), 800);
        toast(`§${sectionId} — ${conflictName} ile çakışıyor. §${alt.id} eklenebilir.`);
        setSelected([...cleaned, { code, sectionId: alt.id }]);
      } else {
        toast(`${code} için uygun section yok — tüm sectionlar ${conflictName} ile çakışıyor.`);
        setConflictFlash(conflictKey);
        setTimeout(() => setConflictFlash(null), 800);
      }
      setSidebarOpen(false);
      setMobileTab("calendar");
      return;
    }

    setSelected(trial);
    setSidebarOpen(false);
    setMobileTab("calendar");
  };

  const removeSelected = (code) => {
    const course = courses.find((c) => c.code === code);
    const name = course ? (lang === "tr" ? course.nameTr : course.name) : code;
    if (!window.confirm(
      lang === "tr"
        ? `"${code} – ${name}" takvimden kaldırılacak. Emin misin?`
        : `"${code} – ${name}" will be removed from your schedule. Are you sure?`
    )) return;
    setSelected(selected.filter((s) => s.code !== code));
  };

  const clearAll = () => {
    if (selected.length === 0) return;
    if (!window.confirm(
      lang === "tr"
        ? `Takvimden ${selected.length} dersin tamamı silinecek. Emin misin?`
        : `All ${selected.length} courses will be removed from the schedule. Are you sure?`
    )) return;
    setSelected([]);
  };

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
    const newEntries = [];
    codes.forEach((normCd) => {
      const course = courses.find((c) => c.code === normCd || normCode(c.code) === normCd);
      if (!course || !course.sections?.length) return;
      const existing = [...selected, ...newEntries];
      const picked = course.sections.find((sec) => {
        const trial = [...existing, { code: course.code, sectionId: sec.id }];
        return !findConflicts(trial, courses)[`${course.code}-${sec.id}`];
      }) || course.sections[0];
      newEntries.push({ code: course.code, sectionId: picked.id });
    });

    if (!newEntries.length) return;

    const merged = [...selected];
    newEntries.forEach((entry) => {
      if (!merged.find((s) => s.code === entry.code)) merged.push(entry);
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
        height: "100vh", fontSize: "1.1rem", color: "#666",
      }}>
        Ders verisi yükleniyor...
      </div>
    );
  }

  if (dataError) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontSize: "1.1rem", color: "#e53e3e",
      }}>
        {dataError}
      </div>
    );
  }

  const sidebarProps = {
    tr, lang, query, setQuery, dayFilter, setDayFilter,
    courses: filtered, expandedCourse, setExpandedCourse,
    selected, conflicts, conflictDetails, toggleSelect, setHoveredSection,
    setDraggingSection, conflictFlash, suggestAlternative, sidebarOpen,
    curriculumYearLabel: curriculumYearCodes ? curriculumYearLabel : null,
    onClearCurriculumYear: () => { setCurriculumYearCodes(null); setCurriculumYearLabel(""); },
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
                    {conflictCount} {lang === "tr" ? "çakışma" : "conflict"}
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
          user={user}
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

// Servis dersleri — bunlar her bölümde ortak
const SERVICE_PREFIXES = [
  "PHYS", "MATH", "CHEM", "ENG", "TURK", "HIST", "PE", "ATA",
  "GE", "IS", "NE", "PHED",
];

function isServiceCourse(normCd) {
  return SERVICE_PREFIXES.some((p) => normCd.startsWith(p));
}
