import React, { useState } from "react";

export default function AdminStudentPanel({ onViewCurriculum }) {
  const [idNumber, setIdNumber] = useState("");
  const [userCode, setUserCode] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [student,  setStudent]  = useState(null);

  const handleLookup = async () => {
    if (!idNumber.trim() || !userCode.trim()) {
      setError("Öğrenci numarası ve kullanıcı adı gerekli.");
      return;
    }
    setLoading(true); setError(""); setStudent(null);
    try {
      const token = localStorage.getItem("metu-token") || sessionStorage.getItem("metu-token");
      const res = await fetch("/api/admin/student-lookup", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body:    JSON.stringify({ idNumber: idNumber.trim(), userCode: userCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Sorgu başarısız."); return; }
      if (!data.student?.firstName && !data.student?.idNumber) {
        setError("Öğrenci bulunamadı. Numara veya kullanıcı adını kontrol edin.");
        return;
      }
      setStudent(data);
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewCurriculum = () => {
    if (!student) return;
    onViewCurriculum({
      username:    student.student?.userCode                             || userCode,
      firstName:   student.student?.firstName                           || "",
      lastName:    student.student?.lastName                            || "",
      name:        `${student.student?.firstName || ""} ${student.student?.lastName || ""}`.trim(),
      studentId:   student.student?.idNumber                            || idNumber,
      semester:    student.student?.semester                            || "",
      programCode: student.major?.programCode                           || "",
      programName: student.major?.programNameEng || student.major?.programNameTr || "",
      faculty:     student.major?.facultyLongNameEng                    || "",
      year:        student.major?.year                                  || "",
      cgpa:        student.major?.cgpa                                  || "",
      role:        "student",
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f4f1", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32,
        width: "100%", maxWidth: 480, boxShadow: "0 4px 24px rgba(0,0,0,0.10)" }}>

        {/* Başlık */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#7a1f2b",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="6" r="3" stroke="#fff" strokeWidth="1.5"/>
              <path d="M2.5 15.5c0-3.038 2.91-5.5 6.5-5.5s6.5 2.462 6.5 5.5"
                stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>Öğrenci Sorgula</div>
            <div style={{ fontSize: "0.75rem", color: "#888" }}>OIBS üzerinden gerçek zamanlı veri</div>
          </div>
        </div>

        {/* Form alanları */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Öğrenci Numarası", val: idNumber, set: setIdNumber, ph: "örn. 2021012345" },
            { label: "Kullanıcı Adı",    val: userCode, set: setUserCode, ph: "örn. e2021012345" },
          ].map(({ label, val, set, ph }) => (
            <div key={label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666",
                display: "block", marginBottom: 5, textTransform: "uppercase",
                letterSpacing: "0.04em" }}>{label}</label>
              <input
                value={val}
                onChange={(e) => set(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder={ph}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                  outline: "none", border: "2px solid #e5e0da", fontSize: "0.9rem",
                  boxSizing: "border-box" }}
                onFocus={(e) => (e.target.style.borderColor = "#7a1f2b")}
                onBlur={(e)  => (e.target.style.borderColor = "#e5e0da")}
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleLookup}
          disabled={loading || !idNumber.trim() || !userCode.trim()}
          style={{
            width: "100%", padding: "10px", borderRadius: 8, border: "none",
            background: loading || !idNumber.trim() || !userCode.trim() ? "#e5e0da" : "#7a1f2b",
            color:      loading || !idNumber.trim() || !userCode.trim() ? "#aaa"    : "#fff",
            fontSize: "0.9rem", fontWeight: 700,
            cursor: loading || !idNumber.trim() || !userCode.trim() ? "not-allowed" : "pointer",
            marginBottom: 12,
          }}
        >
          {loading ? "Sorgulanıyor..." : "OIBS'den Çek"}
        </button>

        {/* Hata */}
        {error && (
          <div style={{ padding: "10px 12px", background: "#fff5f5",
            border: "1px solid #fca5a5", borderRadius: 8,
            color: "#dc2626", fontSize: "0.82rem", marginBottom: 12 }}>
            ⚠ {error}
          </div>
        )}

        {/* Sonuç kartı */}
        {student && (
          <div style={{ border: "1px solid #e5e0da", borderRadius: 12,
            overflow: "hidden", marginBottom: 14 }}>

            <div style={{ background: "linear-gradient(135deg, #7a1f2b, #a33040)",
              padding: "14px 16px", color: "#fff" }}>
              <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 2 }}>
                {student.student.firstName} {student.student.lastName}
              </div>
              <div style={{ fontSize: "0.78rem", opacity: 0.8 }}>
                {student.student.idNumber} · {student.student.userCode}
              </div>
            </div>

            <div style={{ padding: "14px 16px", display: "flex",
              flexDirection: "column", gap: 10 }}>
              <Field label="Program"      value={student.major.programNameEng || student.major.programNameTr || "—"} />
              <Field label="Fakülte"      value={student.major.facultyLongNameEng || "—"} />
              <div style={{ display: "flex", gap: 12 }}>
                <Field label="Yıl"   value={student.major.year        || "—"} half />
                <Field label="Dönem" value={student.student.semester  || "—"} half />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Field label="CGPA"  value={student.major.cgpa        || "—"} half accent />
                <Field label="Durum" value={student.major.statusDescEng || "—"} half />
              </div>
              <Field label="Giriş Tarihi" value={student.major.entryDate || "—"} />
              {student.minor       && <Field label="Minor"        value={student.minor.programNameEng       || "—"} />}
              {student.doubleMajor && <Field label="Çift Anadal"  value={student.doubleMajor.programNameEng || "—"} />}
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid #f0ece8",
              background: "#fafaf9" }}>
              <button
                onClick={handleViewCurriculum}
                disabled={!student.major.programCode}
                style={{
                  width: "100%", padding: "9px", borderRadius: 8, border: "none",
                  background: student.major.programCode ? "#7a1f2b" : "#e5e0da",
                  color:      student.major.programCode ? "#fff"    : "#aaa",
                  fontSize: "0.88rem", fontWeight: 700,
                  cursor: student.major.programCode ? "pointer" : "not-allowed",
                }}
              >
                {student.major.programCode
                  ? `Müfredatı Görüntüle → ${student.major.programNameEng || "Program"}`
                  : "Program bilgisi bulunamadı"}
              </button>
            </div>
          </div>
        )}

        {student && (
          <button
            onClick={() => { setStudent(null); setIdNumber(""); setUserCode(""); setError(""); }}
            style={{ width: "100%", padding: "8px", borderRadius: 8,
              border: "1px solid #e5e0da", background: "transparent",
              color: "#888", fontSize: "0.82rem", cursor: "pointer" }}
          >
            Yeni Sorgu
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, half, accent }) {
  return (
    <div style={{ flex: half ? 1 : "none" }}>
      <div style={{ fontSize: "0.68rem", color: "#aaa", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize:   accent ? "1.1rem" : "0.85rem",
        fontWeight: accent ? 800      : 500,
        color:      accent ? "#7a1f2b" : "#1a1a1a",
      }}>
        {value}
      </div>
    </div>
  );
}
