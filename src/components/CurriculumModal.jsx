import React, { useState, useEffect, useMemo, useCallback } from "react";

const CURRICULA = [
  { label: "ARCH — Mimarlık",                           file: "/scraper/mufredat_output/arch_mufredat.json",  coursesFile: null },
  { label: "AEE — Havacılık ve Uzay Mühendisliği",      file: "/scraper/mufredat_output/aee_mufredat.json",   coursesFile: null },
  { label: "BA — İşletme",                              file: "/scraper/mufredat_output/ba_mufredat.json",    coursesFile: null },
  { label: "BIO — Biyolojik Bilimler",                  file: "/scraper/mufredat_output/bio_mufredat.json",   coursesFile: null },
  { label: "CE — İnşaat Mühendisliği",                  file: "/scraper/mufredat_output/ce_mufredat.json",    coursesFile: null },
  { label: "CEIT — Bilgisayar ve Öğretim Teknolojileri",file: "/scraper/mufredat_output/ceit_mufredat.json",  coursesFile: null },
  { label: "CENG — Bilgisayar Mühendisliği",            file: "/ceng_curriculum.json",                        coursesFile: "/ceng_courses.json" },
  { label: "CHE — Kimya Mühendisliği",                  file: "/scraper/mufredat_output/che_mufredat.json",   coursesFile: null },
  { label: "CHEM — Kimya",                              file: "/scraper/mufredat_output/chem_mufredat.json",  coursesFile: null },
  { label: "CRP — Şehir ve Bölge Planlama",             file: "/scraper/mufredat_output/crp_mufredat.json",   coursesFile: null },
  { label: "ECON — İktisat",                            file: "/scraper/mufredat_output/econ_mufredat.json",  coursesFile: null },
  { label: "EDS — Eğitim Bilimleri",                    file: "/scraper/mufredat_output/eds_mufredat.json",   coursesFile: null },
  { label: "EEE — Elektrik ve Elektronik Mühendisliği", file: "/scraper/mufredat_output/eee_mufredat.json",   coursesFile: null },
  { label: "ENVE — Çevre Mühendisliği",                 file: "/scraper/mufredat_output/enve_mufredat.json",  coursesFile: null },
  { label: "ES — Mühendislik Bilimleri",                file: "/scraper/mufredat_output/es_mufredat.json",    coursesFile: null },
  { label: "FDE — Gıda Mühendisliği",                   file: "/scraper/mufredat_output/fde_mufredat.json",   coursesFile: null },
  { label: "FLE — Yabancı Diller Eğitimi",              file: "/scraper/mufredat_output/fle_mufredat.json",   coursesFile: null },
  { label: "GEOE — Jeoloji Mühendisliği",               file: "/scraper/mufredat_output/geoe_mufredat.json",  coursesFile: null },
  { label: "HIST — Tarih",                              file: "/scraper/mufredat_output/hist_mufredat.json",  coursesFile: null },
  { label: "ID — Endüstriyel Tasarım",                  file: "/scraper/mufredat_output/id_mufredat.json",    coursesFile: null },
  { label: "IE — Endüstri Mühendisliği",                file: "/ie_metu_mufredat.json",                       coursesFile: null },
  { label: "IR — Uluslararası İlişkiler",               file: "/scraper/mufredat_output/ir_mufredat.json",    coursesFile: null },
  { label: "MATH — Matematik",                          file: "/scraper/mufredat_output/math_mufredat.json",  coursesFile: null },
  { label: "ME — Makina Mühendisliği",                  file: "/scraper/mufredat_output/me_mufredat.json",    coursesFile: null },
  { label: "METE — Metalurji ve Malzeme Mühendisliği",  file: "/scraper/mufredat_output/mete_mufredat.json",  coursesFile: null },
  { label: "MINE — Maden Mühendisliği",                 file: "/scraper/mufredat_output/mine_mufredat.json",  coursesFile: null },
  { label: "MSE — Matematik ve Fen Bilimleri Eğitimi",  file: "/scraper/mufredat_output/mse_mufredat.json",   coursesFile: null },
  { label: "PADM — Siyaset Bilimi ve Kamu Yönetimi",    file: "/scraper/mufredat_output/padm_mufredat.json",  coursesFile: null },
  { label: "PES — Beden Eğitimi ve Spor",               file: "/scraper/mufredat_output/pes_mufredat.json",   coursesFile: null },
  { label: "PETE — Petrol ve Doğal Gaz Mühendisliği",   file: "/scraper/mufredat_output/pete_mufredat.json",  coursesFile: null },
  { label: "PHIL — Felsefe",                            file: "/scraper/mufredat_output/phil_mufredat.json",  coursesFile: null },
  { label: "PHYS — Fizik",                              file: "/scraper/mufredat_output/phys_mufredat.json",  coursesFile: null },
  { label: "PSY — Psikoloji",                           file: "/scraper/mufredat_output/psy_mufredat.json",   coursesFile: null },
  { label: "SOC — Sosyoloji",                           file: "/scraper/mufredat_output/soc_mufredat.json",   coursesFile: null },
  { label: "STAT — İstatistik",                         file: "/scraper/mufredat_output/stat_mufredat.json",  coursesFile: null },
];

const CATEGORY_TABS = [
  { key: "zorunlu", labelTr: "Zorunlu",        labelEn: "Required"      },
  { key: "secmeli", labelTr: "Teknik Seçmeli",  labelEn: "Tech Elective" },
  { key: "servis",  labelTr: "Servis",          labelEn: "Service"       },
];

const VIEW_FILTERS = [
  { key: "all",   tr: "Tümü",     en: "All"       },
  { key: "done",  tr: "Alınanlar", en: "Completed" },
  { key: "todo",  tr: "Kalanlar", en: "Remaining" },
];

function catalogUrl(ders) {
  if (ders.catalog_kodu)
    return `https://catalog.metu.edu.tr/course.php?prog=571&course_code=${ders.catalog_kodu}`;
  return null;
}

function normCode(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase();
}

function findInCatalog(ders, courses) {
  const kod = normCode(ders.kod);
  const cat = ders.catalog_kodu ? String(ders.catalog_kodu) : null;
  return courses.find(mc =>
    normCode(mc.code) === kod || (cat && mc.code === cat)
  );
}

// localStorage key per dept
function storageKey(deptFile) {
  return `metu_done_${deptFile.replace(/\W/g, "_")}`;
}

function loadDone(deptFile) {
  try {
    const raw = localStorage.getItem(storageKey(deptFile));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveDone(deptFile, set) {
  try {
    localStorage.setItem(storageKey(deptFile), JSON.stringify([...set]));
  } catch {}
}

// ─── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ done, total, label }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const color = pct === 100 ? "#22c55e" : pct >= 50 ? "#7a1f2b" : "#e88c30";
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: "0.72rem", color: "#555", marginBottom: 3,
      }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{done}/{total} · %{pct}</span>
      </div>
      <div style={{
        height: 6, borderRadius: 99, background: "#f0ece8", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color,
          borderRadius: 99,
          transition: "width .4s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
    </div>
  );
}

// ─── Ders satırı ─────────────────────────────────────────────────────────────
function CourseRow({ ders, catalogEntry, isLast, tr, done, onToggle, viewFilter }) {
  const [open, setOpen] = useState(false);
  const sections    = catalogEntry?.sections || [];
  const hasSections = sections.length > 0;
  const url         = catalogUrl(ders) || (catalogEntry?.catalogUrl ?? null);
  const isDone      = done.has(normCode(ders.kod));

  // filter
  if (viewFilter === "done" && !isDone) return null;
  if (viewFilter === "todo" && isDone)  return null;

  const handleRowClick = (e) => {
    // checkbox tıklanmışsa sadece toggle
    if (e.target.dataset.toggle) return;
    if (!catalogEntry) return;
    if (hasSections) setOpen(v => !v);
    else if (url) window.open(url, "_blank");
  };

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec" }}>
      <div
        onClick={handleRowClick}
        style={{
          padding: "7px 12px",
          display: "flex", alignItems: "center", gap: 9,
          background: isDone ? "#f0fdf4" : open ? "#fdf8f5" : (catalogEntry ? "#fff" : "#fafafa"),
          opacity: catalogEntry ? 1 : 0.55,
          cursor: catalogEntry ? "pointer" : "default",
          transition: "background .12s",
        }}
      >
        {/* Checkbox */}
        <button
          data-toggle="1"
          onClick={(e) => { e.stopPropagation(); onToggle(normCode(ders.kod)); }}
          title={isDone ? (tr ? "Alındı olarak işaretli — kaldır" : "Marked done — undo") : (tr ? "Alındı olarak işaretle" : "Mark as done")}
          style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            border: isDone ? "none" : "2px solid #d1d5db",
            background: isDone ? "#22c55e" : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.65rem", color: "#fff", transition: "all .15s",
            padding: 0, outline: "none",
          }}
        >
          {isDone ? "✓" : ""}
        </button>

        {/* Katalog noktası */}
        <div style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: catalogEntry ? "#22c55e" : "#d1d5db",
        }} />

        {/* Kod */}
        <span style={{
          fontSize: "0.77rem", fontWeight: 700,
          color: isDone ? "#15803d" : "#7a1f2b",
          minWidth: 68, flexShrink: 0,
          textDecoration: isDone ? "line-through" : "none",
          opacity: isDone ? 0.7 : 1,
        }}>
          {ders.kod}
        </span>

        {/* Ad */}
        <span style={{
          fontSize: "0.77rem", color: isDone ? "#888" : "#333",
          flex: 1, lineHeight: 1.4,
          textDecoration: isDone ? "line-through" : "none",
        }}>
          {ders.ad}
        </span>

        {/* Kredi */}
        {(ders.odtu_kredi != null || ders.ects || ders.akts) && (
          <span style={{ fontSize: "0.72rem", color: "#aaa", flexShrink: 0, marginRight: 4 }}>
            {ders.odtu_kredi != null ? `${ders.odtu_kredi}k` : `${ders.ects ?? ders.akts} ECTS`}
          </span>
        )}

        {/* Ok */}
        {catalogEntry && !isDone && (
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
          padding: "8px 12px 10px 40px",
        }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#7a5c1f", marginBottom: 6 }}>
            {tr ? `${sections.length} şube:` : `${sections.length} section(s):`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {sections.map((sec, i) => {
              const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum"];
              const schedule = (sec.meetings || [])
                .map(m => `${dayNames[m.d] ?? m.d} ${m.s}–${m.e}`).join(", ");
              return (
                <div key={i} style={{
                  fontSize: "0.73rem", padding: "5px 8px", borderRadius: 6,
                  background: "#fff", border: "1px solid #e5e0da",
                  display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap",
                }}>
                  <span style={{ fontWeight: 700, color: "#7a1f2b" }}>§{sec.id}</span>
                  <span style={{ color: "#555" }}>{sec.instructor || "—"}</span>
                  <span style={{ color: "#374151", flex: 1 }}>{schedule || (tr ? "Zaman yok" : "No schedule")}</span>
                  {sec.crn && <span style={{ fontSize: "0.69rem", color: "#888" }}>CRN: {sec.crn}</span>}
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

// ─── Seçmeli grup ─────────────────────────────────────────────────────────────
function SecmeliGrupRow({ grup, courses, isLast, tr, done, onToggle, viewFilter }) {
  const [open, setOpen] = useState(false);

  const visibleCount = grup.secenekler.filter(s => {
    const d = done.has(normCode(s.kod));
    if (viewFilter === "done") return d;
    if (viewFilter === "todo") return !d;
    return true;
  }).length;

  if (visibleCount === 0) return null;

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec" }}>
      <div onClick={() => setOpen(v => !v)} style={{
        padding: "7px 12px", display: "flex", alignItems: "center", gap: 8,
        background: open ? "#fdf5e6" : "#fffdf8", cursor: "pointer",
      }}>
        <div style={{ width: 18, height: 18, flexShrink: 0 }} /> {/* checkbox placeholder */}
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#92400e", flex: 1 }}>
          {grup.secmeli_grup}
        </span>
        <span style={{
          fontSize: "0.68rem", color: "#aaa", display: "inline-block",
          transition: "transform .15s", transform: open ? "rotate(180deg)" : "none",
        }}>▼</span>
      </div>
      {open && (
        <div style={{ background: "#fffef5", paddingLeft: 20 }}>
          {grup.secenekler.map((s, i) => {
            const cat = findInCatalog(s, courses);
            return (
              <CourseRow key={i} ders={s} catalogEntry={cat}
                isLast={i === grup.secenekler.length - 1}
                tr={tr} done={done} onToggle={onToggle} viewFilter={viewFilter} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Slot satırı ─────────────────────────────────────────────────────────────
function SlotRow({ slot, isLast, viewFilter }) {
  if (viewFilter === "done") return null; // slot'lar "alınan" sayılmaz
  return (
    <div style={{
      borderBottom: isLast ? "none" : "1px solid #f5f0ec",
      padding: "7px 12px", display: "flex", alignItems: "center", gap: 9,
      background: "#f9f9f9", opacity: 0.6,
    }}>
      <div style={{ width: 18, height: 18, flexShrink: 0 }} />
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#d1d5db", flexShrink: 0 }} />
      <span style={{ fontSize: "0.75rem", color: "#666", fontStyle: "italic" }}>{slot.tur}</span>
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
export default function CurriculumModal({ lang, courses, onApplyToScheduler, onClose }) {
  const tr = lang === "tr";

  const [selectedDept,  setSelectedDept]  = useState(CURRICULA[0]);
  const [curriculum,    setCurriculum]    = useState(null);
  const [cengCourses,   setCengCourses]   = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [selectedYil,   setSelectedYil]   = useState(null);
  const [selectedYariyil, setSelectedYariyil] = useState(null); // null = tümü
  const [activeTab,     setActiveTab]     = useState("zorunlu");
  const [viewFilter,    setViewFilter]    = useState("all");
  const [done,          setDone]          = useState(() => loadDone(CURRICULA[0].file));

  // Bölüm değişince done yükle
  useEffect(() => {
    setDone(loadDone(selectedDept.file));
  }, [selectedDept]);

  // Toggle handler
  const toggleDone = useCallback((kod) => {
    setDone(prev => {
      const next = new Set(prev);
      next.has(kod) ? next.delete(kod) : next.add(kod);
      saveDone(selectedDept.file, next);
      return next;
    });
  }, [selectedDept]);

  // Veri yükle
  useEffect(() => {
    setLoading(true);
    setError(null);
    setCurriculum(null);
    setCengCourses(null);
    setSelectedYil(null);

    Promise.all([
      fetch(selectedDept.file).then(r => r.json()),
      selectedDept.coursesFile
        ? fetch(selectedDept.coursesFile).then(r => r.json()).catch(() => null)
        : Promise.resolve(null),
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

  const mufredat = useMemo(() => {
    if (!curriculum) return [];
    if (Array.isArray(curriculum.mufredat))   return curriculum.mufredat;
    if (Array.isArray(curriculum.curriculum)) return curriculum.curriculum;
    if (Array.isArray(curriculum))            return curriculum;
    return [];
  }, [curriculum]);

  // Tüm müfredattaki ders kodları (slot hariç)
  const allDersCodes = useMemo(() => {
    const codes = [];
    mufredat.forEach(yil =>
      yil.yariyillar?.forEach(y =>
        y.dersler?.forEach(d => {
          if (d.kod) codes.push(normCode(d.kod));
          else if (d.secenekler) d.secenekler.forEach(s => codes.push(normCode(s.kod)));
        })
      )
    );
    return codes;
  }, [mufredat]);

  // Yıl bazlı istatistik
  const yilStats = useMemo(() =>
    mufredat.map(yil => {
      const codes = [];
      yil.yariyillar?.forEach(y =>
        y.dersler?.forEach(d => {
          if (d.kod) codes.push(normCode(d.kod));
          else if (d.secenekler) d.secenekler.forEach(s => codes.push(normCode(s.kod)));
        })
      );
      const doneCount = codes.filter(c => done.has(c)).length;
      return { yil: yil.yil, yil_adi: yil.yil_adi, total: codes.length, done: doneCount };
    }),
  [mufredat, done]);

  const totalDone  = done.size;
  const totalCodes = allDersCodes.length;

  const yilData = mufredat.find(y => y.yil === selectedYil);

  const yilDersleri = useMemo(() => {
    if (!yilData) return [];
    const list = [];
    const yariyillar = selectedYariyil
      ? yilData.yariyillar.filter(y => y.yariyil === selectedYariyil)
      : yilData.yariyillar;
    yariyillar.forEach(y =>
      y.dersler.forEach(d => {
        if (d.kod) list.push(d);
        else if (d.secenekler) d.secenekler.forEach(s => list.push(s));
      })
    );
    return list;
  }, [yilData, selectedYariyil]);

  const matchedYilDersleri = useMemo(() => {
    let list = yilDersleri.filter(d => findInCatalog(d, courses));
    // viewFilter: "all"=tümü, "done"=alınanlar, "todo"=kalanlar
    if (viewFilter === "todo") list = list.filter(d => !done.has(normCode(d.kod)));
    if (viewFilter === "done") list = list.filter(d => done.has(normCode(d.kod)));
    return list;
  }, [yilDersleri, courses, viewFilter, done]);

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
    // catalog_kodu varsa onu kullan (metu_courses_clean'deki c.code ile eşleşir)
    // yoksa normCode(d.kod) fallback
    onApplyToScheduler(new Set(matchedYilDersleri.map(d =>
      d.catalog_kodu ? String(d.catalog_kodu) : normCode(d.kod)
    )));
    onClose();
  };

  const yilLabel = (y) => y.yil_adi || `${y.yil}. Yıl`;

  // Motivasyon mesajı


  const [confirmClear, setConfirmClear] = useState(false);

  const clearDone = () => {
    const empty = new Set();
    setDone(empty);
    saveDone(selectedDept.file, empty);
    setConfirmClear(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
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
          padding: "14px 20px", borderBottom: "1px solid #f0ece8",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>
            {tr ? "Müfredattan Program Oluştur" : "Build from Curriculum"}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: "1.1rem",
            cursor: "pointer", color: "#888",
          }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>

          {/* Bölüm */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {tr ? "Bölüm" : "Department"}
            </div>
            <select
              value={selectedDept.file}
              onChange={e => setSelectedDept(CURRICULA.find(d => d.file === e.target.value))}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem",
                border: "2px solid #e5e0da", background: "#fff", color: "#333",
                cursor: "pointer", fontWeight: 600, outline: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                paddingRight: 32,
              }}
            >
              {CURRICULA.map(dept => (
                <option key={dept.file} value={dept.file}>{dept.label}</option>
              ))}
            </select>
          </div>

          {loading && <div style={{ color: "#888", fontSize: "0.85rem", padding: "10px 0" }}>{tr ? "Yükleniyor..." : "Loading..."}</div>}
          {error   && <div style={{ color: "#c0392b", fontSize: "0.85rem" }}>{error}</div>}

          {mufredat.length > 0 && (
            <>
              {/* ── İlerleme kartı ── */}
              <div style={{
                background: "linear-gradient(135deg, #7a1f2b 0%, #a33040 100%)",
                borderRadius: 10, padding: "10px 14px", marginBottom: 14,
                color: "#fff",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.68rem", opacity: 0.75, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {tr ? "GENEL İLERLEME" : "OVERALL PROGRESS"}
                    </span>
                    {totalDone > 0 && (
                      <button onClick={clearDone} style={{
                        fontSize: "0.62rem", padding: "1px 6px", borderRadius: 99,
                        border: "1px solid rgba(255,255,255,0.4)",
                        background: "transparent", color: "rgba(255,255,255,0.75)",
                        cursor: "pointer", fontWeight: 600,
                      }}>
                        {tr ? "Temizle" : "Clear"}
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>{totalDone}</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.7 }}>/{totalCodes}</span>
                    <span style={{ fontSize: "0.95rem", fontWeight: 900, opacity: 0.3, marginLeft: 6 }}>
                      {totalCodes ? Math.round((totalDone / totalCodes) * 100) : 0}%
                    </span>
                  </div>
                </div>
                {/* Genel progress */}
                <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.2)", overflow: "hidden", marginBottom: 8 }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    background: "rgba(255,255,255,0.9)",
                    width: totalCodes ? `${(totalDone / totalCodes) * 100}%` : "0%",
                    transition: "width .5s cubic-bezier(.4,0,.2,1)",
                  }} />
                </div>
                {/* Yıl bazlı mini barlar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {yilStats.map(ys => (
                    <div key={ys.yil} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.65rem", opacity: 0.8, minWidth: 72 }}>{ys.yil_adi || `${ys.yil}. Yıl`}</span>
                      <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 99,
                          background: ys.done === ys.total && ys.total > 0 ? "#86efac" : "rgba(255,255,255,0.7)",
                          width: ys.total ? `${(ys.done / ys.total) * 100}%` : "0%",
                          transition: "width .5s",
                        }} />
                      </div>
                      <span style={{ fontSize: "0.63rem", opacity: 0.75, minWidth: 30, textAlign: "right" }}>{ys.done}/{ys.total}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Yıl seç ── */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {tr ? "Yıl" : "Year"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {mufredat.map(y => {
                    const st = yilStats.find(s => s.yil === y.yil);
                    const isComplete = st && st.total > 0 && st.done === st.total;
                    return (
                      <button key={y.yil} onClick={() => setSelectedYil(selectedYil === y.yil ? null : y.yil)} style={{
                        padding: "6px 13px", borderRadius: 8, fontSize: "0.82rem",
                        cursor: "pointer", fontWeight: 600, transition: "all .15s",
                        border: selectedYil === y.yil ? "2px solid #7a1f2b" : "2px solid #e5e0da",
                        background: selectedYil === y.yil ? "#7a1f2b" : "#fff",
                        color: selectedYil === y.yil ? "#fff" : "#333",
                        position: "relative",
                      }}>
                        {yilLabel(y)}
                        {isComplete && (
                          <span style={{
                            position: "absolute", top: -5, right: -5,
                            fontSize: "0.65rem", background: "#22c55e",
                            color: "#fff", borderRadius: 99, padding: "1px 4px",
                            fontWeight: 700,
                          }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Yarıyıl seç ── */}
              {selectedYil && yilData && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {tr ? "Dönem" : "Semester"}
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button onClick={() => setSelectedYariyil(null)} style={{
                      padding: "5px 12px", borderRadius: 8, fontSize: "0.8rem",
                      cursor: "pointer", fontWeight: 600, transition: "all .12s",
                      border: selectedYariyil === null ? "2px solid #7a1f2b" : "2px solid #e5e0da",
                      background: selectedYariyil === null ? "#7a1f2b" : "#fff",
                      color: selectedYariyil === null ? "#fff" : "#333",
                    }}>
                      {tr ? "Tümü" : "All"}
                    </button>
                    {yilData.yariyillar.map(yy => (
                      <button key={yy.yariyil} onClick={() => setSelectedYariyil(selectedYariyil === yy.yariyil ? null : yy.yariyil)} style={{
                        padding: "5px 12px", borderRadius: 8, fontSize: "0.8rem",
                        cursor: "pointer", fontWeight: 600, transition: "all .12s",
                        border: selectedYariyil === yy.yariyil ? "2px solid #7a1f2b" : "2px solid #e5e0da",
                        background: selectedYariyil === yy.yariyil ? "#7a1f2b" : "#fff",
                        color: selectedYariyil === yy.yariyil ? "#fff" : "#333",
                      }}>
                        {yy.yariyil_adi || `${yy.yariyil}. Dönem`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Filtre toggle + Temizle ── */}
              {selectedYil && yilData && (
                <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{
                    display: "inline-flex", borderRadius: 8, overflow: "hidden",
                    border: "1px solid #e5e0da",
                  }}>
                    {VIEW_FILTERS.map(f => (
                      <button key={f.key} onClick={() => setViewFilter(f.key)} style={{
                        padding: "5px 12px", fontSize: "0.77rem", fontWeight: 600,
                        border: "none", cursor: "pointer", transition: "all .12s",
                        background: viewFilter === f.key ? "#7a1f2b" : "#fff",
                        color: viewFilter === f.key ? "#fff" : "#555",
                        borderRight: f.key !== "todo" ? "1px solid #e5e0da" : "none",
                      }}>
                        {tr ? f.tr : f.en}
                        {f.key === "done" && done.size > 0 && (
                          <span style={{
                            marginLeft: 5, fontSize: "0.68rem",
                            background: viewFilter === f.key ? "rgba(255,255,255,0.25)" : "#f0fdf4",
                            color: viewFilter === f.key ? "#fff" : "#15803d",
                            borderRadius: 99, padding: "1px 5px",
                          }}>
                            {yilDersleri.filter(d => d.kod && done.has(normCode(d.kod))).length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {done.size > 0 && (
                    confirmClear ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "0.73rem", color: "#555" }}>
                          {tr ? "Emin misin?" : "Are you sure?"}
                        </span>
                        <button onClick={clearDone} style={{
                          fontSize: "0.73rem", padding: "4px 10px", borderRadius: 7,
                          border: "none", background: "#dc2626",
                          color: "#fff", cursor: "pointer", fontWeight: 700,
                        }}>
                          {tr ? "Evet" : "Yes"}
                        </button>
                        <button onClick={() => setConfirmClear(false)} style={{
                          fontSize: "0.73rem", padding: "4px 10px", borderRadius: 7,
                          border: "1px solid #e5e0da", background: "#fff",
                          color: "#555", cursor: "pointer", fontWeight: 600,
                        }}>
                          {tr ? "Hayır" : "No"}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmClear(true)} style={{
                        fontSize: "0.75rem", padding: "5px 12px", borderRadius: 8,
                        border: "1px solid #fca5a5", background: "#fff5f5",
                        color: "#dc2626", cursor: "pointer", fontWeight: 600,
                      }}>
                        {tr ? "Temizle" : "Clear all"}
                      </button>
                    )
                  )}
                </div>
              )}

              {/* ── Seçili yılın dersleri ── */}
              {selectedYil && yilData && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: "0.75rem", fontWeight: 600, color: "#888", marginBottom: 7,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span>{tr ? "Dersler" : "Courses"}</span>
                    <span style={{ fontWeight: 400, fontSize: "0.73rem" }}>
                      {matchedYilDersleri.length}/{yilDersleri.length} {tr ? "katalogda" : "in catalog"}
                    </span>
                  </div>

                  <div style={{
                    border: "1px solid #f0ece8", borderRadius: 10,
                    overflow: "hidden", maxHeight: 340, overflowY: "auto",
                  }}>
                    {yilData.yariyillar.map(yariyil => (
                      <div key={yariyil.yariyil}>
                        <div style={{
                          padding: "5px 12px", background: "#f5f0ec",
                          fontSize: "0.71rem", fontWeight: 700, color: "#7a1f2b",
                          letterSpacing: "0.04em", borderBottom: "1px solid #ede8e3",
                        }}>
                          {yariyil.yariyil_adi}
                        </div>
                        {yariyil.dersler.map((d, di) => {
                          const isLast = di === yariyil.dersler.length - 1;
                          if (d.secmeli_grup) return (
                            <SecmeliGrupRow key={di} grup={d} courses={courses}
                              isLast={isLast} tr={tr} done={done} onToggle={toggleDone} viewFilter={viewFilter} />
                          );
                          if (d.tur) return <SlotRow key={di} slot={d} isLast={isLast} viewFilter={viewFilter} />;
                          return (
                            <CourseRow key={di} ders={d} catalogEntry={findInCatalog(d, courses)}
                              isLast={isLast} tr={tr} done={done} onToggle={toggleDone} viewFilter={viewFilter} />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: "0.71rem", color: "#aaa", marginTop: 6 }}>
                    {tr
                      ? "☑ tıkla → alındı işaretle · ● yeşil = katalogda var"
                      : "☑ click → mark done · ● green = in catalog"}
                  </div>
                </div>
              )}

              {/* ─── Bölüm Ders Havuzu ─── */}
              {cengCourses && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 1, background: "#f0ece8" }} />
                    <span style={{ fontSize: "0.73rem", color: "#bbb", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {tr ? "BÖLÜM DERS HAVUZU" : "DEPARTMENT COURSE POOL"}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "#f0ece8" }} />
                  </div>

                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {CATEGORY_TABS.map(tab => {
                      const isActive = activeTab === tab.key;
                      let count = 0;
                      if (tab.key === "zorunlu") count = zorunluList.filter(c => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                      if (tab.key === "servis")  count = servisList.filter(c => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                      if (tab.key === "secmeli") count = Object.values(secmeliCats).flatMap(c => c.dersler || []).filter(c => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                      return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                          flex: 1, padding: "7px 6px", borderRadius: 8, fontSize: "0.77rem",
                          cursor: "pointer", fontWeight: 600, transition: "all .15s",
                          border: isActive ? "2px solid #7a1f2b" : "2px solid #e5e0da",
                          background: isActive ? "#7a1f2b" : "#fff",
                          color: isActive ? "#fff" : "#555",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        }}>
                          <span>{tr ? tab.labelTr : tab.labelEn}</span>
                          <span style={{ fontSize: "0.68rem", opacity: 0.8, fontWeight: 400 }}>
                            {count} {tr ? "katalogda" : "in catalog"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{
                    border: "1px solid #f0ece8", borderRadius: 10,
                    overflow: "hidden", maxHeight: 280, overflowY: "auto",
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
                        }}>{c.label}</div>
                      );
                      const ders = {
                        kod: c.courseCode || c.kod,
                        ad: c.courseName || c.ad,
                        catalog_kodu: c.metuCourseCode || c.catalog_kodu,
                        odtu_kredi: c.odtu_kredi, ects: c.ects, catalogUrl: c.catalogUrl,
                      };
                      const cat = findInCatalog(ders, courses);
                      const isLast = i === tabCourseList.length - 1 || tabCourseList[i + 1]?._isHeader;
                      return (
                        <CourseRow key={i} ders={ders} catalogEntry={cat}
                          isLast={isLast} tr={tr} done={done} onToggle={toggleDone} viewFilter="all" />
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
          padding: "12px 20px", borderTop: "1px solid #f0ece8",
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e0da",
            background: "#fff", color: "#555", fontSize: "0.85rem",
            cursor: "pointer", fontWeight: 500,
          }}>
            {tr ? "İptal" : "Cancel"}
          </button>
          <button onClick={handleApply} disabled={!matchedYilDersleri.length} style={{
            padding: "9px 20px", borderRadius: 8, border: "none",
            background: matchedYilDersleri.length ? "#7a1f2b" : "#e5e0da",
            color: matchedYilDersleri.length ? "#fff" : "#aaa",
            fontSize: "0.85rem",
            cursor: matchedYilDersleri.length ? "pointer" : "not-allowed",
            fontWeight: 700,
          }}>
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
