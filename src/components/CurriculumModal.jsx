import React, { useState, useEffect, useMemo } from "react";

// ─── Yeni JSON formatı ───────────────────────────────────────────────────────
// mufredat[].yil / yil_adi
// mufredat[].yariyillar[].yariyil / yariyil_adi
// mufredat[].yariyillar[].dersler[]
//   Normal ders : { kod, ad, odtu_kredi, ders_saat, lab_saat, ects, catalog_kodu? }
//   Seçmeli grup: { secmeli_grup, secenekler:[{kod,ad,...}] }
//   Slot         : { tur, aciklama }
// ─────────────────────────────────────────────────────────────────────────────

const CURRICULA = [
  {
    label: "CENG — Bilgisayar Mühendisliği",
    file: "/ceng_curriculum.json",   // yeni formattaki JSON
    coursesFile: "/ceng_courses.json",
  },
];

const CATEGORY_TABS = [
  { key: "zorunlu", labelTr: "Zorunlu",       labelEn: "Required",      icon: "📌" },
  { key: "secmeli", labelTr: "Teknik Seçmeli", labelEn: "Tech Elective", icon: "🔧" },
  { key: "servis",  labelTr: "Servis",         labelEn: "Service",       icon: "🔗" },
];

// catalog_kodu varsa "https://catalog.metu.edu.tr/course.php?prog=571&course_code=XXXXX"
function catalogUrl(ders) {
  if (ders.catalog_kodu) {
    return `https://catalog.metu.edu.tr/course.php?prog=571&course_code=${ders.catalog_kodu}`;
  }
  return null;
}

// Ders kodunu normalize et: boşluk kaldır, büyük harf
function normCode(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase();
}

// courses prop'undaki catalog listesiyle eşleştir
// courses[].code → catalog_kodu (sayısal) veya ders kodu ("CENG140") olabilir
function findInCatalog(ders, courses) {
  const kod = normCode(ders.kod);
  const cat = ders.catalog_kodu ? String(ders.catalog_kodu) : null;
  return courses.find(mc =>
    normCode(mc.code) === kod ||
    (cat && mc.code === cat)
  );
}

// ─── Ders satırı bileşeni ────────────────────────────────────────────────────
function CourseRow({ ders, catalogEntry, isLast, tr }) {
  const [open, setOpen] = useState(false);
  const sections = catalogEntry?.sections || [];
  const hasSections = sections.length > 0;
  const url = catalogUrl(ders) || (catalogEntry?.catalogUrl ?? null);

  const handleClick = () => {
    if (!catalogEntry) return;
    if (hasSections) setOpen(v => !v);
    else if (url) window.open(url, "_blank");
  };

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec" }}>
      {/* Ana satır */}
      <div
        onClick={handleClick}
        style={{
          padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 10,
          background: open ? "#fdf8f5" : (catalogEntry ? "#fff" : "#fafafa"),
          opacity: catalogEntry ? 1 : 0.5,
          cursor: catalogEntry ? "pointer" : "default",
          transition: "background .12s",
        }}
      >
        {/* Durum noktası */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: catalogEntry ? "#22c55e" : "#d1d5db",
        }} />

        {/* Kod */}
        <span style={{
          fontSize: "0.77rem", fontWeight: 700, color: "#7a1f2b",
          minWidth: 68, flexShrink: 0,
        }}>
          {ders.kod}
        </span>

        {/* Ad */}
        <span style={{ fontSize: "0.77rem", color: "#333", flex: 1, lineHeight: 1.4 }}>
          {ders.ad}
        </span>

        {/* Kredi / ECTS */}
        {(ders.odtu_kredi != null || ders.ects) && (
          <span style={{ fontSize: "0.72rem", color: "#888", flexShrink: 0, marginRight: 4 }}>
            {ders.odtu_kredi != null ? `${ders.odtu_kredi}k` : `${ders.ects} ECTS`}
          </span>
        )}

        {/* Ok / dış link ikonu */}
        {catalogEntry && (
          hasSections
            ? <span style={{
                fontSize: "0.7rem", color: "#aaa", flexShrink: 0,
                display: "inline-block", transition: "transform .15s",
                transform: open ? "rotate(180deg)" : "none",
              }}>▼</span>
            : url
              ? <span style={{ fontSize: "0.7rem", color: "#aaa", flexShrink: 0 }}>↗</span>
              : null
        )}
      </div>

      {/* Şube detayı */}
      {open && hasSections && (
        <div style={{
          background: "#fdf8f5", borderTop: "1px solid #f0ece8",
          padding: "8px 12px 10px 32px",
        }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#7a5c1f", marginBottom: 6 }}>
            {tr ? `${sections.length} şube mevcut:` : `${sections.length} section(s) available:`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {sections.map((sec, i) => {
              const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum"];
              const schedule = (sec.meetings || [])
                .map(m => `${dayNames[m.d] ?? m.d} ${m.s}–${m.e}`)
                .join(", ");
              return (
                <div key={i} style={{
                  fontSize: "0.73rem", padding: "5px 8px", borderRadius: 6,
                  background: "#fff", border: "1px solid #e5e0da",
                  display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap",
                }}>
                  <span style={{ fontWeight: 700, color: "#7a1f2b", flexShrink: 0 }}>§{sec.id}</span>
                  <span style={{ color: "#555", flexShrink: 0 }}>{sec.instructor || "—"}</span>
                  <span style={{ color: "#374151", flex: 1 }}>{schedule || (tr ? "Zaman yok" : "No schedule")}</span>
                  {sec.crn && (
                    <span style={{ fontSize: "0.69rem", color: "#888", flexShrink: 0 }}>CRN: {sec.crn}</span>
                  )}
                </div>
              );
            })}
          </div>
          {url && (
            <a href={url} target="_blank" rel="noreferrer"
              style={{ fontSize: "0.71rem", color: "#7a1f2b", marginTop: 6, display: "inline-block" }}>
              ↗ {tr ? "Katalog sayfasını aç" : "Open catalog page"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Seçmeli grup satırı ─────────────────────────────────────────────────────
function SecmeliGrupRow({ grup, courses, isLast, tr }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec" }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          padding: "7px 12px",
          display: "flex", alignItems: "center", gap: 8,
          background: open ? "#fdf5e6" : "#fffdf8",
          cursor: "pointer",
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#92400e", flex: 1 }}>
          {grup.secmeli_grup}
        </span>
        <span style={{
          fontSize: "0.68rem", color: "#aaa",
          transform: open ? "rotate(180deg)" : "none",
          display: "inline-block", transition: "transform .15s",
        }}>▼</span>
      </div>
      {open && (
        <div style={{ background: "#fffef5", paddingLeft: 20 }}>
          {grup.secenekler.map((s, i) => {
            const cat = findInCatalog(s, courses);
            return (
              <CourseRow
                key={i}
                ders={s}
                catalogEntry={cat}
                isLast={i === grup.secenekler.length - 1}
                tr={tr}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Slot satırı (TEKNİK SEÇMELİ vb.) ───────────────────────────────────────
function SlotRow({ slot, isLast }) {
  return (
    <div style={{
      borderBottom: isLast ? "none" : "1px solid #f5f0ec",
      padding: "7px 12px",
      display: "flex", alignItems: "center", gap: 8,
      background: "#f9f9f9",
      opacity: 0.65,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#d1d5db", flexShrink: 0 }} />
      <span style={{ fontSize: "0.75rem", color: "#666", fontStyle: "italic" }}>
        {slot.tur}
      </span>
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
export default function CurriculumModal({ lang, courses, onApplyToScheduler, onClose }) {
  const tr = lang === "tr";

  const [selectedDept,  setSelectedDept]  = useState(CURRICULA[0]);
  const [curriculum,    setCurriculum]    = useState(null);   // yeni format
  const [cengCourses,   setCengCourses]   = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [selectedYil,   setSelectedYil]   = useState(null);  // yil numarası (1-4)
  const [activeTab,     setActiveTab]     = useState("zorunlu");

  // Veri yükle
  useEffect(() => {
    setLoading(true);
    setError(null);
    setCurriculum(null);
    setCengCourses(null);
    setSelectedYil(null);

    Promise.all([
      fetch(selectedDept.file).then(r => r.json()),
      fetch(selectedDept.coursesFile).then(r => r.json()).catch(() => null),
    ])
      .then(([currData, coursesData]) => {
        setCurriculum(currData);
        setCengCourses(coursesData);
        setLoading(false);
      })
      .catch(() => {
        setError(tr ? "Müfredat yüklenemedi." : "Failed to load curriculum.");
        setLoading(false);
      });
  }, [selectedDept]);

  // JSON root'u esnek oku: { mufredat:[...] } veya { curriculum:[...] } veya doğrudan dizi
  const mufredat = useMemo(() => {
    if (!curriculum) return [];
    if (Array.isArray(curriculum.mufredat))   return curriculum.mufredat;
    if (Array.isArray(curriculum.curriculum)) return curriculum.curriculum;
    if (Array.isArray(curriculum))            return curriculum;
    return [];
  }, [curriculum]);

  // Seçili yılın tüm dersleri (normal + seçmeli grup içindekiler)
  const yilData = mufredat.find(y => y.yil === selectedYil);

  const yilDersleri = useMemo(() => {
    if (!yilData) return [];
    const list = [];
    yilData.yariyillar.forEach(yariyil => {
      yariyil.dersler.forEach(d => {
        if (d.kod) {
          list.push(d);
        } else if (d.secenekler) {
          d.secenekler.forEach(s => list.push(s));
        }
        // slot (tur) → listeye dahil etme
      });
    });
    return list;
  }, [yilData]);

  const matchedYilDersleri = useMemo(
    () => yilDersleri.filter(d => findInCatalog(d, courses)),
    [yilDersleri, courses]
  );

  // ceng_courses.json ─ eski format hâlâ destekleniyor
  const zorunluList = useMemo(() => cengCourses?.zorunlu_dersler || [], [cengCourses]);
  const servisList  = useMemo(() => cengCourses?.servis_dersleri  || [], [cengCourses]);
  const secmeliCats = useMemo(() => cengCourses?.teknik_secmeli_dersler || {}, [cengCourses]);

  const tabCourseList = useMemo(() => {
    if (activeTab === "zorunlu") return zorunluList;
    if (activeTab === "servis")  return servisList;
    if (activeTab === "secmeli") {
      const result = [];
      Object.values(secmeliCats).forEach(cat => {
        if (cat.dersler?.length) {
          result.push({ _isHeader: true, label: cat.aciklama });
          result.push(...cat.dersler);
        }
      });
      return result;
    }
    return [];
  }, [activeTab, zorunluList, servisList, secmeliCats]);

  const handleApply = () => {
    if (!matchedYilDersleri.length) return;
    const codes = new Set(matchedYilDersleri.map(d => normCode(d.kod)));
    onApplyToScheduler(codes);
    onClose();
  };

  // Yıl buton etiketi: yil_adi veya fallback
  const yilLabel = (y) => y.yil_adi || `${y.yil}. Yıl`;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 580,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          maxHeight: "92vh",
        }}
      >
        {/* Başlık */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f0ece8",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>
            📚 {tr ? "Müfredattan Program Oluştur" : "Build from Curriculum"}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: "1.1rem",
            cursor: "pointer", color: "#888", lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>

          {/* Bölüm seç */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#555", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {tr ? "Bölüm" : "Department"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CURRICULA.map(dept => (
                <button
                  key={dept.file}
                  onClick={() => setSelectedDept(dept)}
                  style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: "0.83rem",
                    cursor: "pointer", fontWeight: 600, transition: "all .15s",
                    border: selectedDept.file === dept.file ? "2px solid #7a1f2b" : "2px solid #e5e0da",
                    background: selectedDept.file === dept.file ? "#7a1f2b" : "#fff",
                    color: selectedDept.file === dept.file ? "#fff" : "#333",
                  }}
                >
                  {dept.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div style={{ color: "#888", fontSize: "0.85rem", padding: "12px 0" }}>
              {tr ? "Yükleniyor..." : "Loading..."}
            </div>
          )}
          {error && (
            <div style={{ color: "#c0392b", fontSize: "0.85rem" }}>{error}</div>
          )}

          {mufredat.length > 0 && (
            <>
              {/* Yıl seç */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#555", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {tr ? "Yıl" : "Year"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {mufredat.map(y => (
                    <button
                      key={y.yil}
                      onClick={() => setSelectedYil(selectedYil === y.yil ? null : y.yil)}
                      style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: "0.83rem",
                        cursor: "pointer", fontWeight: 600, transition: "all .15s",
                        border: selectedYil === y.yil ? "2px solid #7a1f2b" : "2px solid #e5e0da",
                        background: selectedYil === y.yil ? "#7a1f2b" : "#fff",
                        color: selectedYil === y.yil ? "#fff" : "#333",
                      }}
                    >
                      {yilLabel(y)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seçili yılın yarıyılları ve dersleri */}
              {selectedYil && yilData && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{
                    fontSize: "0.78rem", fontWeight: 600, color: "#555", marginBottom: 7,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span>{tr ? "Dersler" : "Courses"}</span>
                    <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#888" }}>
                      {matchedYilDersleri.length}/{yilDersleri.length} {tr ? "katalogda mevcut" : "in catalog"}
                    </span>
                  </div>

                  <div style={{
                    border: "1px solid #f0ece8", borderRadius: 10,
                    overflow: "hidden", maxHeight: 320, overflowY: "auto",
                  }}>
                    {yilData.yariyillar.map((yariyil, yi) => (
                      <div key={yariyil.yariyil}>
                        {/* Yarıyıl başlığı */}
                        <div style={{
                          padding: "6px 12px",
                          background: "#f5f0ec",
                          fontSize: "0.72rem", fontWeight: 700,
                          color: "#7a1f2b", letterSpacing: "0.04em",
                          borderBottom: "1px solid #ede8e3",
                        }}>
                          {yariyil.yariyil_adi}
                        </div>

                        {/* Dersler */}
                        {yariyil.dersler.map((d, di) => {
                          const isLast = di === yariyil.dersler.length - 1;

                          if (d.secmeli_grup) {
                            return (
                              <SecmeliGrupRow
                                key={di}
                                grup={d}
                                courses={courses}
                                isLast={isLast}
                                tr={tr}
                              />
                            );
                          }
                          if (d.tur) {
                            return <SlotRow key={di} slot={d} isLast={isLast} />;
                          }
                          const cat = findInCatalog(d, courses);
                          return (
                            <CourseRow
                              key={di}
                              ders={d}
                              catalogEntry={cat}
                              isLast={isLast}
                              tr={tr}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {matchedYilDersleri.length === 0 && (
                    <div style={{ fontSize: "0.8rem", color: "#c05621", marginTop: 8 }}>
                      {tr ? "Bu yılın dersleri katalogda bulunamadı." : "No courses from this year found in the catalog."}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Bölüm Ders Havuzu (ceng_courses.json) ─── */}
              {cengCourses && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 1, background: "#f0ece8" }} />
                    <span style={{ fontSize: "0.75rem", color: "#aaa", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {tr ? "BÖLÜM DERS HAVUZU" : "DEPARTMENT COURSE POOL"}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "#f0ece8" }} />
                  </div>

                  {/* Sekmeler */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {CATEGORY_TABS.map(tab => {
                      const isActive = activeTab === tab.key;
                      let count = 0;
                      if (tab.key === "zorunlu") count = zorunluList.filter(c => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                      if (tab.key === "servis")  count = servisList.filter(c => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                      if (tab.key === "secmeli") count = Object.values(secmeliCats).flatMap(c => c.dersler || []).filter(c => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          style={{
                            flex: 1, padding: "7px 6px", borderRadius: 8, fontSize: "0.77rem",
                            cursor: "pointer", fontWeight: 600, transition: "all .15s",
                            border: isActive ? "2px solid #7a1f2b" : "2px solid #e5e0da",
                            background: isActive ? "#7a1f2b" : "#fff",
                            color: isActive ? "#fff" : "#555",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                          }}
                        >
                          <span>{tab.icon} {tr ? tab.labelTr : tab.labelEn}</span>
                          <span style={{ fontSize: "0.68rem", opacity: 0.8, fontWeight: 400 }}>
                            {count} {tr ? "katalogda" : "in catalog"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab içeriği */}
                  <div style={{
                    border: "1px solid #f0ece8", borderRadius: 10,
                    overflow: "hidden", maxHeight: 300, overflowY: "auto",
                  }}>
                    {tabCourseList.length === 0 && (
                      <div style={{ padding: 16, fontSize: "0.82rem", color: "#888", textAlign: "center" }}>
                        {tr ? "Bu kategoride ders bulunamadı." : "No courses in this category."}
                      </div>
                    )}
                    {tabCourseList.map((c, i) => {
                      if (c._isHeader) return (
                        <div key={i} style={{
                          padding: "7px 12px", background: "#f9f6f3",
                          fontSize: "0.71rem", fontWeight: 600, color: "#7a5c1f",
                          borderBottom: "1px solid #f0ece8",
                        }}>
                          {c.label}
                        </div>
                      );
                      // ceng_courses.json eski format: courseCode / metuCourseCode
                      const ders = {
                        kod: c.courseCode || c.kod,
                        ad: c.courseName || c.ad,
                        catalog_kodu: c.metuCourseCode || c.catalog_kodu,
                        odtu_kredi: c.odtu_kredi,
                        ects: c.ects,
                        catalogUrl: c.catalogUrl,
                      };
                      const cat = findInCatalog(ders, courses);
                      const isLast = i === tabCourseList.length - 1 || tabCourseList[i + 1]?._isHeader;
                      return (
                        <CourseRow
                          key={i}
                          ders={ders}
                          catalogEntry={cat}
                          isLast={isLast}
                          tr={tr}
                        />
                      );
                    })}
                  </div>

                  <div style={{ fontSize: "0.72rem", color: "#aaa", marginTop: 6 }}>
                    {tr
                      ? "● yeşil = katalogda var · tıkla → şubeler veya katalog sayfası"
                      : "● green = in catalog · click → sections or catalog page"}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Alt buton */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid #f0ece8",
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e0da",
            background: "#fff", color: "#555", fontSize: "0.85rem",
            cursor: "pointer", fontWeight: 500,
          }}>
            {tr ? "İptal" : "Cancel"}
          </button>
          <button
            onClick={handleApply}
            disabled={!matchedYilDersleri.length}
            style={{
              padding: "9px 20px", borderRadius: 8, border: "none",
              background: matchedYilDersleri.length ? "#7a1f2b" : "#e5e0da",
              color: matchedYilDersleri.length ? "#fff" : "#aaa",
              fontSize: "0.85rem",
              cursor: matchedYilDersleri.length ? "pointer" : "not-allowed",
              fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span>✦</span>
            {selectedYil
              ? (tr
                  ? `${matchedYilDersleri.length} dersi Planlarıcıya Yükle`
                  : `Load ${matchedYilDersleri.length} courses to Scheduler`)
              : (tr ? "Yıl seç" : "Select a year")}
          </button>
        </div>
      </div>
    </div>
  );
}
