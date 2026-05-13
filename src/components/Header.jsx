import React from "react";

export default function Header({ tr, lang, setLang, selected, totalCredits, onClear, onCopyCRN, sidebarOpen, onToggleSidebar, onOpenAI }) {
  return (
    <header className="header">
      <button
        className="sidebar-toggle-btn"
        onClick={onToggleSidebar}
        title={sidebarOpen ? "Sidebar'ı gizle" : "Sidebar'ı göster"}
        aria-label="Toggle sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          {sidebarOpen ? (
            <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          ) : (
            <path d="M7 4L12 9L7 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          )}
        </svg>
      </button>

      <div className="brand">
        <div className="logo">
          <img src="/metu-logo.svg" alt="ODTÜ" width="44" height="40" />
        </div>
        <div className="brand-text">
          <div className="brand-name">Metu<span>Schedule</span></div>
        </div>
      </div>

      <div className="header-stats">
        <div className="stat">
          <div className="stat-num">{selected.length}</div>
          <div className="stat-lbl">{tr.courses}</div>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <div className="stat-num">{totalCredits}</div>
          <div className="stat-lbl">{tr.totalCredits}</div>
        </div>
      </div>

      <div className="header-actions">
        <button className="btn ai-btn" onClick={onOpenAI}>
          <span>✦</span>
          {lang === "tr" ? "Otomatik Program" : "Auto Schedule"}
        </button>
        <div className="lang-switch" role="tablist">
          <button className={lang === "tr" ? "active" : ""} onClick={() => setLang("tr")} role="tab">TR</button>
          <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} role="tab">EN</button>
        </div>
        <button className="btn btn-ghost" onClick={onCopyCRN} disabled={selected.length === 0}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="4" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3 11 L3 2 L10 2" stroke="currentColor" strokeWidth="1.4" fill="none" />
          </svg>
          {tr.copyCRN}
        </button>
        <button className="btn btn-ghost" onClick={() => window.print()} disabled={selected.length === 0}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8 L3 2 L13 2 L13 8 M3 12 L1 12 L1 8 L15 8 L15 12 L13 12 M4 12 L12 12 L12 15 L4 15 Z"
              stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
          </svg>
          {tr.exportPNG}
        </button>
        <button className="btn btn-danger" onClick={onClear} disabled={selected.length === 0}>
          {tr.clearAll}
        </button>
      </div>
    </header>
  );
}
