import React, { useState, useRef, useEffect } from "react";

function isNilObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (
      value?.$?.nil === "true" ||
      value?.$?.nil === true ||
      value?.nil === "true" ||
      value?.nil === true
    )
  );
}

function isDisplayable(value) {
  if (value === null || value === undefined || value === "") return false;
  if (isNilObject(value)) return false;

  if (Array.isArray(value)) {
    return value.some((item) => isDisplayable(item));
  }

  if (typeof value === "object") {
    const possibleValue =
      value.name ||
      value.label ||
      value.text ||
      value.value ||
      value.description ||
      value.desc ||
      value.tr ||
      value.en ||
      value.programName ||
      value.programNameEng ||
      value.programNameTr ||
      value.faculty ||
      value.facultyLongNameEng ||
      value.facultyLongNameTr;

    return isDisplayable(possibleValue);
  }

  const text = String(value).trim();

  if (!text) return false;
  if (text === "—") return false;
  if (text.toLowerCase() === "null") return false;
  if (text.toLowerCase() === "undefined") return false;
  if (text.includes('"nil"')) return false;

  return true;
}

function safeText(value, fallback = "—") {
  if (!isDisplayable(value)) return fallback;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return (
      value
        .map((x) => safeText(x, ""))
        .filter(Boolean)
        .join(", ") || fallback
    );
  }

  if (typeof value === "object") {
    const possibleValue =
      value.name ||
      value.label ||
      value.text ||
      value.value ||
      value.description ||
      value.desc ||
      value.tr ||
      value.en ||
      value.programName ||
      value.programNameEng ||
      value.programNameTr ||
      value.faculty ||
      value.facultyLongNameEng ||
      value.facultyLongNameTr;

    return safeText(possibleValue, fallback);
  }

  return fallback;
}

function getInitials(user) {
  const fullName = safeText(user?.name, "");
  const username = safeText(user?.username, "");
  const source = fullName || username || "?";

  return (
    source
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export default function Header({
  tr,
  lang,
  setLang,
  selected,
  totalCredits,
  onClear,
  onCopyCRN,
  sidebarOpen,
  onToggleSidebar,
  onOpenAI,
  onOpenAutoSchedule,
  onOpenCurriculum,
  user,
  onLogout,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState(null);
  const menuRef = useRef(null);
  const avatarRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  const initials = getInitials(user);

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
            <path
              d="M11 4L6 9L11 14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M7 4L12 9L7 14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </button>

      {/* Logo */}
      <div className="brand">
        <div className="logo">
          <img src="/metu-logo.svg" alt="ODTÜ" width="44" height="40" />
        </div>

        <div className="brand-text">
          <div className="brand-name">
            Metu<span>Schedule</span>
          </div>
          <div className="brand-tag">{safeText(tr?.tagline, "")}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="header-stats">
        <div className="stat">
          <div className="stat-num">{selected.length}</div>
          <div className="stat-lbl">{safeText(tr?.courses, "")}</div>
        </div>

        <div className="stat-divider" />

        <div className="stat">
          <div className="stat-num">{safeText(totalCredits, "0")}</div>
          <div className="stat-lbl">{safeText(tr?.totalCredits, "")}</div>
        </div>
      </div>

      {/* Aksiyonlar */}
      <div className="header-actions">
        {/* Müfredattan Oluştur */}
        <button
          className="btn btn-ghost hide-mobile"
          onClick={onOpenCurriculum}
          style={{ gap: 5 }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M5 6h6M5 9h4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>

          <span className="btn-label">
            {lang === "tr" ? "Müfredat" : "Curriculum"}
          </span>
        </button>

        {/* Otomatik Program */}
        <button className="btn ai-btn" onClick={onOpenAutoSchedule || onOpenAI}>
          <span className="btn-label ai-btn-label-full">
            {lang === "tr" ? "Akıllı Planlama" : "Smart Planner"}
          </span>

          <span className="btn-label ai-btn-label-short">
            {lang === "tr" ? "Planlama" : "Planner"}
          </span>
        </button>

        {/* Dil seçici */}
        <div className="lang-switch" role="tablist">
          <button
            className={lang === "tr" ? "active" : ""}
            onClick={() => setLang("tr")}
            role="tab"
          >
            TR
          </button>

          <button
            className={lang === "en" ? "active" : ""}
            onClick={() => setLang("en")}
            role="tab"
          >
            EN
          </button>
        </div>

        {/* CRN Kopyala */}
        <button
          className="btn btn-ghost hide-mobile"
          onClick={onCopyCRN}
          disabled={selected.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect
              x="4"
              y="4"
              width="9"
              height="11"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M3 11 L3 2 L10 2"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>

          <span className="btn-label">{safeText(tr?.copyCRN, "")}</span>
        </button>

        {/* PNG İndir */}
        <button
          className="btn btn-ghost hide-mobile"
          onClick={() => window.print()}
          disabled={selected.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8 L3 2 L13 2 L13 8 M3 12 L1 12 L1 8 L15 8 L15 12 L13 12 M4 12 L12 12 L12 15 L4 15 Z"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>

          <span className="btn-label">{safeText(tr?.exportPNG, "")}</span>
        </button>

        {/* Temizle */}
        <button
          className="btn btn-danger"
          onClick={onClear}
          disabled={selected.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <span className="btn-label hide-mobile-inline">
            {safeText(tr?.clearAll, "")}
          </span>
        </button>

        {/* Kullanıcı menüsü */}
        {user && (
          <div className="user-menu-wrap" ref={menuRef}>
            <button
              className="user-avatar-btn"
              ref={avatarRef}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (!menuOpen && avatarRef.current) {
                  const rect = avatarRef.current.getBoundingClientRect();

                  setDropdownPos({
                    top: rect.bottom + 8,
                    right: window.innerWidth - rect.right,
                  });
                }

                setMenuOpen((v) => !v);
              }}
              aria-label="Kullanıcı menüsü"
              aria-expanded={menuOpen}
            >
              {initials}
            </button>

            {menuOpen && (
              <div
                className="user-dropdown"
                role="menu"
                style={
                  dropdownPos
                    ? {
                        position: "fixed",
                        top: dropdownPos.top,
                        right: dropdownPos.right,
                        left: "auto",
                      }
                    : {}
                }
              >
                <div className="user-dropdown-info">
                  <div className="user-dropdown-name">
                    {safeText(user?.name || user?.username, "")}
                  </div>

                  {isDisplayable(user?.username) && (
                    <div className="user-dropdown-username">
                      @{safeText(user?.username, "")}
                    </div>
                  )}

                  {(() => {
                    const dept = isDisplayable(user?.programCode)
                      ? user.programCode
                      : isDisplayable(user?.dept)
                      ? user.dept
                      : "";

                    const semNum = isDisplayable(user?.semester)
                      ? user.semester
                      : "";

                    const yearNum = isDisplayable(user?.year)
                      ? user.year
                      : isDisplayable(user?.yearNum)
                      ? user.yearNum
                      : "";

                    const cgpa = isDisplayable(user?.cgpa)
                      ? user.cgpa
                      : isDisplayable(user?.gpa)
                      ? user.gpa
                      : "";

                    const faculty = isDisplayable(user?.faculty)
                      ? user.faculty
                      : "";

                    const name = isDisplayable(user?.programName)
                      ? user.programName
                      : "";

                    const hasAcademicInfo =
                      isDisplayable(dept) ||
                      isDisplayable(yearNum) ||
                      isDisplayable(semNum) ||
                      isDisplayable(cgpa) ||
                      isDisplayable(faculty) ||
                      isDisplayable(name);

                    if (!hasAcademicInfo) return null;

                    return (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          background: "#f9f2f3",
                          borderRadius: 8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                        }}
                      >
                        {(isDisplayable(dept) || isDisplayable(name)) && (
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#7a1e2e",
                            }}
                          >
                            {isDisplayable(dept) && safeText(dept, "")}
                            {isDisplayable(dept) && isDisplayable(name)
                              ? ` — ${safeText(name, "")}`
                              : isDisplayable(name)
                              ? safeText(name, "")
                              : ""}
                          </div>
                        )}

                        {isDisplayable(faculty) && (
                          <div style={{ fontSize: 11, color: "#666" }}>
                            {safeText(faculty, "")}
                          </div>
                        )}

                        {(isDisplayable(yearNum) ||
                          isDisplayable(semNum) ||
                          isDisplayable(cgpa)) && (
                          <div
                            style={{
                              display: "flex",
                              gap: 16,
                              marginTop: 2,
                              paddingTop: 6,
                              borderTop: "1px solid #f0dde0",
                              flexWrap: "wrap",
                            }}
                          >
                            {isDisplayable(yearNum) && (
                              <div style={{ fontSize: 11, color: "#444" }}>
                                <span
                                  style={{
                                    color: "#999",
                                    marginRight: 3,
                                  }}
                                >
                                  {lang === "tr" ? "Yıl" : "Year"}
                                </span>

                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: "#222",
                                  }}
                                >
                                  {safeText(yearNum, "")}
                                </span>
                              </div>
                            )}

                            {isDisplayable(semNum) && (
                              <div style={{ fontSize: 11, color: "#444" }}>
                                <span
                                  style={{
                                    color: "#999",
                                    marginRight: 3,
                                  }}
                                >
                                  {lang === "tr" ? "Dönem" : "Semester"}
                                </span>

                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: "#222",
                                  }}
                                >
                                  {safeText(semNum, "")}
                                </span>
                              </div>
                            )}

                            {isDisplayable(cgpa) && (
                              <div style={{ fontSize: 11, color: "#444" }}>
                                <span
                                  style={{
                                    color: "#999",
                                    marginRight: 3,
                                  }}
                                >
                                  GPA
                                </span>

                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: "#222",
                                  }}
                                >
                                  {safeText(cgpa, "")}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="user-dropdown-divider" />

                <button
                  className="user-dropdown-logout"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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