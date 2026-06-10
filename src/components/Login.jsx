import React, { useState } from "react";
import { saveToken } from "../api/auth.js";
import "./Login.css";

const CAS_LOGIN_URL = "https://login.metu.edu.tr/cas/login";
const SERVICE_URL   = "http://planify.metu.edu.tr/";

export default function Login({ onLogin, casError = "" }) {
  const [tab,      setTab]      = useState("user"); // "user" | "ynt"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [remember, setRemember] = useState(false);
  const [error,    setError]    = useState(casError);
  const [loading,  setLoading]  = useState(false);

  const switchTab = (t) => {
    setTab(t);
    setError("");
    setUsername("");
    setPassword("");
    setShowPwd(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (!username && !password) { setError("Kullanıcı adı ve şifre gerekli."); return; }
    if (!username)               { setError("Kullanıcı adı gerekli.");          return; }
    if (!password)               { setError("Şifre gerekli.");                  return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Giriş başarısız.");
      saveToken(data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCAS = () => {
    window.location.href =
      `${CAS_LOGIN_URL}?service=${encodeURIComponent(SERVICE_URL)}`;
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleSubmit(); };

  const isYnt = tab === "ynt";

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-top-bar" />

        {/* ── Logo ── */}
        <div className="login-logo-row">
          <div className="login-logo-sq" aria-hidden="true">
            <img src="/metu-logo.svg" width="22" height="22" alt="ODTÜ" />
          </div>
          <div>
            <div className="login-brand-main">METU <span>Schedule</span></div>
            <div className="login-brand-sub">Dijital Ders Programı Asistanı</div>
          </div>
        </div>

        {/* ── Sekme geçişi ── */}
        <div className="login-tabs" role="tablist" aria-label="Giriş türü">
          <div className={`login-pill${isYnt ? " login-pill--r" : ""}`} aria-hidden="true" />

          <button
            role="tab"
            aria-selected={!isYnt}
            className={`login-tab${!isYnt ? " login-tab--on" : ""}`}
            onClick={() => switchTab("user")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2.5 13.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Öğrenci / Personel
          </button>

          <button
            role="tab"
            aria-selected={isYnt}
            className={`login-tab${isYnt ? " login-tab--on" : ""}`}
            onClick={() => switchTab("ynt")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="9" width="12" height="5.5" rx="1.5"
                    stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5.5 9V6a2.5 2.5 0 015 0v3"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="8" cy="11.75" r="1" fill="currentColor"/>
            </svg>
            Yönetici
          </button>
        </div>

        {/* ── Öğrenci / Personel ── */}
        {!isYnt && (
          <div className="login-section">
            <button className="login-cas-btn" type="button" onClick={handleCAS}>
              <img src="/metu-logo.svg" width="20" height="20" alt="" aria-hidden="true" />
              ODTÜ Kimliğinizle Giriş Yapın
            </button>
            <p className="login-cas-note">
              ODTÜ CAS sistemi üzerinden güvenli doğrulama yapılır.
            </p>
          </div>
        )}

        {/* ── Yönetici ── */}
        {isYnt && (
          <div className="login-section">
            <div className="login-ynt-head">
              <h1 className="login-heading">Yönetici Girişi</h1>
              <p className="login-sub">Sistem yöneticisi hesabınızla devam edin</p>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8 5v3.5M8 11h.01" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <div className="login-field-group">
              <label className="login-label" htmlFor="login-username">
                Kullanıcı Adı
              </label>
              <div className="login-input-wrap">
                <svg className="login-input-icon" width="16" height="16"
                     viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M2.5 13.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  className="login-input"
                  type="text"
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="örn. admin"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label" htmlFor="login-password">Şifre</label>
              <div className="login-input-wrap">
                <svg className="login-input-icon" width="16" height="16"
                     viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2.5" y="7" width="11" height="7.5" rx="1.5"
                        stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 7V5a3 3 0 016 0v2"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  className="login-input login-input-eye"
                  type={showPwd ? "text" : "password"}
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  className="login-eye-btn"
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPwd ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M2 2l12 12M6.5 6.56A2 2 0 0010 9.5"
                            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <path d="M3.5 4.5C2.2 5.5 1.3 6.7 1 8c.8 3 3.6 5 7 5a8.6 8.6 0 003.5-.74
                               M12.5 11.5C13.8 10.5 14.7 9.3 15 8c-.8-3-3.6-5-7-5-.5 0-1 .05-1.5.14"
                            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M1 8c.8-3 3.6-5 7-5s6.2 2 7 5c-.8 3-3.6 5-7 5s-6.2-2-7-5z"
                            stroke="currentColor" strokeWidth="1.4"/>
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-options-row">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Beni hatırla
              </label>
              <button className="login-forgot" type="button">
                Şifremi unuttum
              </button>
            </div>

            <button
              className={`login-btn${loading ? " login-btn--loading" : ""}`}
              type="button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  Giriş yapılıyor...
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"
                          stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Yönetici Olarak Giriş Yap
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
