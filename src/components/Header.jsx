import React, { useState, useRef, useEffect } from "react";

export default function Header({ tr, lang, setLang, selected, totalCredits, onClear, onCopyCRN, sidebarOpen, onToggleSidebar, onOpenAI, onOpenAutoSchedule, onOpenCurriculum, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : (user?.username?.[0] || "?").toUpperCase();

  return (
    <header className="header">

      {/* Sidebar toggle */}
      <button
        className="sidebar-toggle-btn hide-mobile"
        onClick={onToggleSidebar}
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

      {/* Logo */}
      <div className="brand">
        <div className="logo">
          <img src="/metu-logo.svg" alt="ODTÜ" width="44" height="40" />
        </div>
        <div className="brand-text">
          <div className="brand-name">Metu<span>Schedule</span></div>
          <div className="brand-tag">{tr.tagline}</div>
        </div>
      </div>

      {/* Stats */}
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

      {/* Aksiyonlar */}
      <div className="header-actions">

        {/* Müfredattan Oluştur */}
        <button className="btn btn-ghost hide-mobile" onClick={onOpenCurriculum} style={{ gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span className="btn-label">{lang === "tr" ? "Müfredat" : "Curriculum"}</span>
        </button>

        {/* Otomatik Program */}
        <button className="btn ai-btn" onClick={onOpenAutoSchedule || onOpenAI}>
          <span>✦</span>
          <span className="btn-label ai-btn-label-full">{lang === "tr" ? "Otomatik Program" : "Auto Schedule"}</span>
          <span className="btn-label ai-btn-label-short">{lang === "tr" ? "Program" : "Schedule"}</span>
        </button>

        {/* Dil seçici */}
        <div className="lang-switch" role="tablist">
          <button className={lang === "tr" ? "active" : ""} onClick={() => setLang("tr")} role="tab">TR</button>
          <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} role="tab">EN</button>
        </div>

        {/* CRN Kopyala */}
        <button className="btn btn-ghost hide-mobile" onClick={onCopyCRN} disabled={selected.length === 0}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="4" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3 11 L3 2 L10 2" stroke="currentColor" strokeWidth="1.4" fill="none" />
          </svg>
          <span className="btn-label">{tr.copyCRN}</span>
        </button>

        {/* PNG İndir */}
        <button className="btn btn-ghost hide-mobile" onClick={() => window.print()} disabled={selected.length === 0}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8 L3 2 L13 2 L13 8 M3 12 L1 12 L1 8 L15 8 L15 12 L13 12 M4 12 L12 12 L12 15 L4 15 Z"
              stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
          </svg>
          <span className="btn-label">{tr.exportPNG}</span>
        </button>

        {/* Temizle */}
        <button className="btn btn-danger" onClick={onClear} disabled={selected.length === 0}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="btn-label hide-mobile-inline">{tr.clearAll}</span>
        </button>

        {/* Kullanıcı menüsü */}
        {user && (
          <div className="user-menu-wrap" ref={menuRef}>
            <button
              className="user-avatar-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Kullanıcı menüsü"
              aria-expanded={menuOpen}
            >
              {initials}
            </button>
            {menuOpen && (
              <div className="user-dropdown" role="menu">
                <div className="user-dropdown-info">
                  <div className="user-dropdown-name">{user.name || user.username}</div>
                  <div className="user-dropdown-username">@{user.username}</div>
                </div>
                <div className="user-dropdown-divider" />
                <button
                  className="user-dropdown-logout"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {lang === "tr" ? "Çıkış Yap" : "Log Out"}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  );
}
