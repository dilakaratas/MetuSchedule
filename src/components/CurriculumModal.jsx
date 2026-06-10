import React, { useState, useEffect, useMemo, useCallback } from "react";


const ENG_FILES = [
  "/metu_engineering_catalog.json",   
  "/metu_eng_faculty_mufredat.json",     
];


const YEAR_TO_NUM = {
  "FIRST YEAR": 1, "SECOND YEAR": 2,
  "THIRD YEAR": 3, "FOURTH YEAR": 4, "FIFTH YEAR": 5,
};
const YIL_ADI_MAP = {
  1: "1. Yıl", 2: "2. Yıl", 3: "3. Yıl", 4: "4. Yıl", 5: "5. Yıl",
};
const SEM_TO_NUM = {
  "First Semester":   1, "Second Semester":  2,
  "Third Semester":   3, "Fourth Semester":  4,
  "Fifth Semester":   5, "Sixth Semester":   6,
  "Seventh Semester": 7, "Eighth Semester":  8,
};

function convertNewCatalog(program) {
  const yilMap = {};
  for (const entry of program.curriculum || []) {
    const yilNo = YEAR_TO_NUM[entry.year] ?? 0;
    const semNo = SEM_TO_NUM[entry.semester] ?? 0;
    if (!yilMap[yilNo]) yilMap[yilNo] = {};
    const dersler = (entry.courses || []).map((c) =>
      c.type === "elective_slot"
        ? { tur: c.name || "Elective", aciklama: c.name || "Elective" }
        : {
            kod: c.code || "",
            ad: c.name || "",
            odtu_kredi: c.credit ?? null,
            ects: c.ects ?? null,
            ders_saat: c.contact_h_w ?? null,
            lab_saat: c.lab_h_w ?? null,
          }
    );
    yilMap[yilNo][semNo] = {
      yariyil: semNo,
      yariyil_adi: `${semNo}. Dönem`,
      dersler,
    };
  }
  const mufredat = Object.keys(yilMap)
    .map(Number).sort((a, b) => a - b)
    .map((yilNo) => ({
      yil: yilNo,
      yil_adi: YIL_ADI_MAP[yilNo] || `${yilNo}. Yıl`,
      yariyillar: Object.keys(yilMap[yilNo])
        .map(Number).sort((a, b) => a - b)
        .map((sn) => yilMap[yilNo][sn]),
    }));
  return { mufredat };
}


function convertOldCatalog(bolum) {
  const yariyilList = bolum.mufredat || [];

  const mufredat = yariyilList.map((y) => ({
    yil: y.yil,
    yil_adi: y.yil_adi || YIL_ADI_MAP[y.yil] || `${y.yil}. Yıl`,
    yariyillar: (y.yariyillar || []).map((yy) => ({
      yariyil: yy.yariyil,
      yariyil_adi: yy.yariyil_adi || `${yy.yariyil}. Dönem`,
      dersler: normalizeDersler(yy.dersler || []),
    })),
  }));
  return { mufredat };
}

const ENG_DEPTS = [
  { label: "AEE — Havacılık ve Uzay Mühendisliği",      prog_id: 572 },
  { label: "CHE — Kimya Mühendisliği",                  prog_id: 563 },
  { label: "CE — İnşaat Mühendisliği",                  prog_id: 562 },
  { label: "CENG — Bilgisayar Mühendisliği",            prog_id: 571 },
  { label: "EEE — Elektrik ve Elektronik Mühendisliği", prog_id: 567 },
  { label: "ES — Mühendislik Bilimleri",                prog_id: 561 },
  { label: "ENVE — Çevre Mühendisliği",                 prog_id: 560 },
  { label: "FDE — Gıda Mühendisliği",                   prog_id: 573 },
  { label: "GEOE — Jeoloji Mühendisliği",               prog_id: 564 },
  { label: "IE — Endüstri Mühendisliği",                prog_id: 568 },
  { label: "ME — Makina Mühendisliği",                  prog_id: 569 },
  { label: "METE — Metalurji ve Malzeme Mühendisliği",  prog_id: 570 },
  { label: "MINE — Maden Mühendisliği",                 prog_id: 565 },
  { label: "PETE — Petrol ve Doğal Gaz Mühendisliği",   prog_id: 566 },
];



function buildCurriculaList() {
  return ENG_DEPTS.map((d) => ({ ...d, isEng: true })).sort((a, b) => a.label.localeCompare(b.label, "tr"));
}
const ALL_CURRICULA = buildCurriculaList();

function normalizeDersler(dersler) {
  return (dersler || [])
    .filter((d) => {
      const kod = (d.kod || "").toLowerCase().trim();
      return !kod || (kod !== "course code" && kod !== "ders kodu");
    })
    .map((d) => {
      const out = { ...d };
      if (out.odtu_kredi != null && out.metu_kredi == null) out.metu_kredi = out.odtu_kredi;
      if (out.metu_kredi != null && out.odtu_kredi == null) out.odtu_kredi = out.metu_kredi;
      if (out.secenekler) out.secenekler = normalizeDersler(out.secenekler);
      return out;
    });
}

function normalizeLegacyCurriculum(raw) {
  const list = Array.isArray(raw?.mufredat)
    ? raw.mufredat
    : Array.isArray(raw?.curriculum)
    ? raw.curriculum
    : Array.isArray(raw)
    ? raw
    : [];
  return list.map((yil) => ({
    ...yil,
    yariyillar: (yil.yariyillar || []).map((y) => ({
      ...y,
      dersler: normalizeDersler(y.dersler || []),
    })),
  }));
}

// ─── Yardımcı ────────────────────────────────────────────────────────────────
const CATEGORY_TABS = [
  { key: "zorunlu", labelTr: "Zorunlu",        labelEn: "Required"      },
  { key: "secmeli", labelTr: "Teknik Seçmeli",  labelEn: "Tech Elective" },
  { key: "servis",  labelTr: "Servis",          labelEn: "Service"       },
];
const VIEW_FILTERS = [
  { key: "all",  tr: "Tümü",      en: "All"       },
  { key: "done", tr: "Alınanlar", en: "Completed" },
  { key: "todo", tr: "Kalanlar",  en: "Remaining" },
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
  return courses.find((mc) => normCode(mc.code) === kod || (cat && mc.code === cat));
}
function storageKey(id) { return `metu_done_${String(id).replace(/\W/g, "_")}`; }
function loadDone(id) {
  try { const r = localStorage.getItem(storageKey(id)); return r ? new Set(JSON.parse(r)) : new Set(); }
  catch { return new Set(); }
}
function saveDone(id, set) {
  try { localStorage.setItem(storageKey(id), JSON.stringify([...set])); } catch {}
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
function ProgressBar({ done, total, label }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const color = pct === 100 ? "#22c55e" : pct >= 50 ? "#7a1f2b" : "#e88c30";
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#555", marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{done}/{total} · %{pct}</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "#f0ece8", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width .4s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

// ─── CourseRow ────────────────────────────────────────────────────────────────
function CourseRow({ ders, catalogEntry, isLast, tr, done, onToggle, viewFilter }) {
  const [open, setOpen] = useState(false);
  const sections    = catalogEntry?.sections || [];
  const hasSections = sections.length > 0;
  const url         = catalogUrl(ders) || (catalogEntry?.catalogUrl ?? null);
  const isDone      = done.has(normCode(ders.kod));

  if (viewFilter === "done" && !isDone) return null;
  if (viewFilter === "todo" && isDone)  return null;

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec" }}>
      <div
        onClick={(e) => {
          if (e.target.dataset.toggle) return;
          if (!catalogEntry) return;
          if (hasSections) setOpen((v) => !v);
          else if (url) window.open(url, "_blank");
        }}
        style={{
          padding: "7px 12px", display: "flex", alignItems: "center", gap: 9,
          background: isDone ? "#f0fdf4" : open ? "#fdf8f5" : catalogEntry ? "#fff" : "#fafafa",
          opacity: catalogEntry ? 1 : 0.55,
          cursor: catalogEntry ? "pointer" : "default",
          transition: "background .12s",
        }}
      >
        <button
          data-toggle="1"
          onClick={(e) => { e.stopPropagation(); onToggle(normCode(ders.kod)); }}
          title={isDone ? (tr ? "Alındı — kaldır" : "Marked done — undo") : (tr ? "Alındı işaretle" : "Mark as done")}
          style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            border: isDone ? "none" : "2px solid #d1d5db",
            background: isDone ? "#22c55e" : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "0.65rem", color: "#fff",
            transition: "all .15s", padding: 0, outline: "none",
          }}
        >{isDone ? "✓" : ""}</button>
        <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: catalogEntry ? "#22c55e" : "#d1d5db" }} />
        <span style={{
          fontSize: "0.77rem", fontWeight: 700,
          color: isDone ? "#15803d" : "#7a1f2b",
          minWidth: 68, flexShrink: 0,
          textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.7 : 1,
        }}>{ders.kod}</span>
        <span style={{
          fontSize: "0.77rem", color: isDone ? "#888" : "#333",
          flex: 1, lineHeight: 1.4, textDecoration: isDone ? "line-through" : "none",
        }}>{ders.ad}</span>
        {(ders.odtu_kredi != null || ders.ects || ders.akts) && (
          <span style={{ fontSize: "0.72rem", color: "#aaa", flexShrink: 0, marginRight: 4 }}>
            {ders.odtu_kredi != null ? `${ders.odtu_kredi}k` : `${ders.ects ?? ders.akts} ECTS`}
          </span>
        )}
        {catalogEntry && !isDone && (
          hasSections
            ? <span style={{ fontSize: "0.7rem", color: "#aaa", flexShrink: 0, display: "inline-block", transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
            : url ? <span style={{ fontSize: "0.7rem", color: "#aaa", flexShrink: 0 }}>↗</span> : null
        )}
      </div>
      {open && hasSections && (
        <div style={{ background: "#fdf8f5", borderTop: "1px solid #f0ece8", padding: "8px 12px 10px 40px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#7a5c1f", marginBottom: 6 }}>
            {tr ? `${sections.length} şube:` : `${sections.length} section(s):`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {sections.map((sec, i) => {
              const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum"];
              const schedule = (sec.meetings || []).map((m) => `${dayNames[m.d] ?? m.d} ${m.s}–${m.e}`).join(", ");
              return (
                <div key={i} style={{ fontSize: "0.73rem", padding: "5px 8px", borderRadius: 6, background: "#fff", border: "1px solid #e5e0da", display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#7a1f2b" }}>§{sec.id}</span>
                  <span style={{ color: "#555" }}>{sec.instructor || "—"}</span>
                  <span style={{ color: "#374151", flex: 1 }}>{schedule || (tr ? "Zaman yok" : "No schedule")}</span>
                  {sec.crn && <span style={{ fontSize: "0.69rem", color: "#888" }}>CRN: {sec.crn}</span>}
                </div>
              );
            })}
          </div>
          {url && <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: "0.71rem", color: "#7a1f2b", marginTop: 6, display: "inline-block" }}>↗ {tr ? "Katalog sayfasını aç" : "Open catalog page"}</a>}
        </div>
      )}
    </div>
  );
}

// ─── SecmeliGrupRow ───────────────────────────────────────────────────────────
function SecmeliGrupRow({ grup, courses, isLast, tr, done, onToggle, viewFilter }) {
  const [open, setOpen] = useState(false);
  const visibleCount = (grup.secenekler || []).filter((s) => {
    const d = done.has(normCode(s.kod));
    if (viewFilter === "done") return d;
    if (viewFilter === "todo") return !d;
    return true;
  }).length;
  if (visibleCount === 0) return null;
  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec" }}>
      <div onClick={() => setOpen((v) => !v)} style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 8, background: open ? "#fdf5e6" : "#fffdf8", cursor: "pointer" }}>
        <div style={{ width: 18, height: 18, flexShrink: 0 }} />
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#92400e", flex: 1 }}>{grup.secmeli_grup}</span>
        <span style={{ fontSize: "0.68rem", color: "#aaa", display: "inline-block", transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </div>
      {open && (
        <div style={{ background: "#fffef5", paddingLeft: 20 }}>
          {(grup.secenekler || []).map((s, i) => (
            <CourseRow key={i} ders={s} catalogEntry={findInCatalog(s, courses)}
              isLast={i === grup.secenekler.length - 1} tr={tr} done={done}
              onToggle={onToggle} viewFilter={viewFilter} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SlotRow ──────────────────────────────────────────────────────────────────
function SlotRow({ slot, isLast, viewFilter }) {
  if (viewFilter === "done") return null;
  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec", padding: "7px 12px", display: "flex", alignItems: "center", gap: 9, background: "#f9f9f9", opacity: 0.6 }}>
      <div style={{ width: 18, height: 18, flexShrink: 0 }} />
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#d1d5db", flexShrink: 0 }} />
      <span style={{ fontSize: "0.75rem", color: "#666", fontStyle: "italic" }}>{slot.tur || slot.aciklama}</span>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
// Bölüm adından ALL_CURRICULA içinde eşleşen bölümü bul
function findDeptByCode(deptCode) {
  if (!deptCode) return null;
  const upper = deptCode.toUpperCase();
  return ALL_CURRICULA.find((d) => {
    const label = d.label.toUpperCase();
    // "CENG — ..." formatında prefix eşleşmesi
    return label.startsWith(upper + " ") || label.startsWith(upper + "—") || label.startsWith(upper + " —");
  }) || null;
}

export default function CurriculumModal({ lang, courses, user, onApplyToScheduler, onClose }) {
  const tr = lang === "tr";

  // Kullanıcının bölümünü otomatik seç, yoksa ilk bölüm
  const autoDetectedDept = findDeptByCode(user?.dept || user?.programCode) || ALL_CURRICULA[0];
  // yearNum = OIBS'den türetilen integer yıl (1-5), year = ham string
  const autoDetectedYear = user?.yearNum ? Number(user.yearNum) : (user?.year ? Number(user.year) : null);

  const [selectedDept,   setSelectedDept]   = useState(autoDetectedDept);
  const [engData,        setEngData]        = useState(null);
  const [engFormat,      setEngFormat]      = useState(null);
  const [curriculum,     setCurriculum]     = useState(null);
  const [cengCourses,    setCengCourses]    = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [selectedYil,    setSelectedYil]    = useState(autoDetectedYear);
  const [selectedYariyil,setSelectedYariyil]= useState(null);
  const [activeTab,      setActiveTab]      = useState("zorunlu");
  const [viewFilter,     setViewFilter]     = useState("all");
  const [confirmClear,   setConfirmClear]   = useState(false);

  const doneKey = selectedDept.isEng ? `eng_${selectedDept.prog_id}` : selectedDept.file;
  const [done, setDone] = useState(() => loadDone(doneKey));
  useEffect(() => { setDone(loadDone(doneKey)); }, [doneKey]);

  const toggleDone = useCallback((kod) => {
    setDone((prev) => {
      const next = new Set(prev);
      next.has(kod) ? next.delete(kod) : next.add(kod);
      saveDone(doneKey, next);
      return next;
    });
  }, [doneKey]);

  // Mühendislik JSON'ını bir kez yükle — yeni veya eski format otomatik algılanır
  useEffect(() => {
    if (engData) return;
    (async () => {
      for (const file of ENG_FILES) {
        try {
          const r = await fetch(file);
          if (!r.ok) continue;
          const data = await r.json();
          if (data?.programs?.length) {
            setEngData(data); setEngFormat("new"); return;
          }
          if (data?.bolumler?.length) {
            setEngData(data); setEngFormat("old"); return;
          }
        } catch {}
      }
    })();
  }, []);

  // Bölüm değişince müfredatı hazırla
  useEffect(() => {
    setLoading(true);
    setError(null);
    setCurriculum(null);
    setCengCourses(null);
    setSelectedYil(null);
    setSelectedYariyil(null);

    if (selectedDept.isEng) {
      const loadFromData = (data, fmt) => {
        let result = null;
        if (fmt === "new") {
          const prog = (data.programs || []).find((p) => p.program_id === selectedDept.prog_id);
          if (prog?.curriculum?.length) result = convertNewCatalog(prog);
        } else if (fmt === "old") {
          const bolum = (data.bolumler || []).find((b) => b.prog_id === selectedDept.prog_id);
          if (bolum && !bolum.hata && bolum.mufredat?.length) result = convertOldCatalog(bolum);
        }
        if (result) {
          setCurriculum(result);
        } else {
          setError(tr ? "Bu bölüm için müfredat bulunamadı." : "Curriculum not found for this department.");
        }
        setLoading(false);
      };

      if (engData && engFormat) {
        loadFromData(engData, engFormat);
      } else {
        // Henüz yüklenmemişse yükle
        (async () => {
          for (const file of ENG_FILES) {
            try {
              const r = await fetch(file);
              if (!r.ok) continue;
              const data = await r.json();
              let fmt = null;
              if (data?.programs?.length)  fmt = "new";
              if (data?.bolumler?.length)  fmt = "old";
              if (fmt) {
                setEngData(data); setEngFormat(fmt);
                loadFromData(data, fmt);
                return;
              }
            } catch {}
          }
          setError(tr ? "Müfredat yüklenemedi." : "Failed to load curriculum.");
          setLoading(false);
        })();
      }
    } else {
      // Eski bölümler
      Promise.all([
        fetch(selectedDept.file).then((r) => r.json()),
        selectedDept.coursesFile
          ? fetch(selectedDept.coursesFile).then((r) => r.json()).catch(() => null)
          : Promise.resolve(null),
      ])
        .then(([currData, coursesData]) => {
          setCurriculum({ mufredat: normalizeLegacyCurriculum(currData) });
          setCengCourses(coursesData);
          setLoading(false);
        })
        .catch(() => {
          setError(tr ? "Müfredat yüklenemedi." : "Failed to load curriculum.");
          setLoading(false);
        });
    }
  }, [selectedDept, engData, engFormat]);

  const mufredat = curriculum?.mufredat || [];

  const allDersCodes = useMemo(() => {
    const codes = [];
    mufredat.forEach((yil) =>
      yil.yariyillar?.forEach((y) =>
        y.dersler?.forEach((d) => {
          if (d.kod) codes.push(normCode(d.kod));
          else if (d.secenekler) d.secenekler.forEach((s) => codes.push(normCode(s.kod)));
        })
      )
    );
    return codes;
  }, [mufredat]);

  const yilStats = useMemo(() =>
    mufredat.map((yil) => {
      const codes = [];
      yil.yariyillar?.forEach((y) =>
        y.dersler?.forEach((d) => {
          if (d.kod) codes.push(normCode(d.kod));
          else if (d.secenekler) d.secenekler.forEach((s) => codes.push(normCode(s.kod)));
        })
      );
      return { yil: yil.yil, yil_adi: yil.yil_adi, total: codes.length, done: codes.filter((c) => done.has(c)).length };
    }),
  [mufredat, done]);

  const totalDone  = done.size;
  const totalCodes = allDersCodes.length;
  const yilData    = mufredat.find((y) => y.yil === selectedYil);

  const yilDersleri = useMemo(() => {
    if (!yilData) return [];
    const list = [];
    const yariyillar = selectedYariyil
      ? yilData.yariyillar.filter((y) => y.yariyil === selectedYariyil)
      : yilData.yariyillar;
    yariyillar.forEach((y) =>
      y.dersler.forEach((d) => {
        if (d.kod) list.push(d);
        else if (d.secenekler) d.secenekler.forEach((s) => list.push(s));
      })
    );
    return list;
  }, [yilData, selectedYariyil]);

  const matchedYilDersleri = useMemo(() => {
    let list = yilDersleri.filter((d) => findInCatalog(d, courses));
    if (viewFilter === "todo") list = list.filter((d) => !done.has(normCode(d.kod)));
    if (viewFilter === "done") list = list.filter((d) =>  done.has(normCode(d.kod)));
    return list;
  }, [yilDersleri, courses, viewFilter, done]);

  const zorunluList = useMemo(() => cengCourses?.zorunlu_dersler  || [], [cengCourses]);
  const servisList  = useMemo(() => cengCourses?.servis_dersleri   || [], [cengCourses]);
  const secmeliCats = useMemo(() => cengCourses?.teknik_secmeli_dersler || {}, [cengCourses]);

  const tabCourseList = useMemo(() => {
    if (activeTab === "zorunlu") return zorunluList;
    if (activeTab === "servis")  return servisList;
    if (activeTab === "secmeli") {
      const result = [];
      Object.values(secmeliCats).forEach((cat) => {
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
    onApplyToScheduler(new Set(matchedYilDersleri.map((d) => d.catalog_kodu ? String(d.catalog_kodu) : normCode(d.kod))));
    onClose();
  };

  const clearDone = () => { const e = new Set(); setDone(e); saveDone(doneKey, e); setConfirmClear(false); };
  const yilLabel  = (y) => y.yil_adi || `${y.yil}. Yıl`;

  const renderOptions = () => (
    <>
      {ALL_CURRICULA.map((d) => (
        <option key={`eng_${d.prog_id}`} value={`eng_${d.prog_id}`}>{d.label}</option>
      ))}
    </>
  );

  const selectValue = `eng_${selectedDept.prog_id}`;
  const handleSelectChange = (e) => {
    const prog_id = parseInt(e.target.value.replace("eng_", ""), 10);
    setSelectedDept(ALL_CURRICULA.find((d) => d.prog_id === prog_id));
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 580, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>

        {/* Başlık */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0ece8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>{tr ? "Müfredattan Program Oluştur" : "Build from Curriculum"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "#888" }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>

          {/* Bölüm seçimi */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{tr ? "Bölüm" : "Department"}</div>
            <select value={selectValue} onChange={handleSelectChange} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem", border: "2px solid #e5e0da", background: "#fff", color: "#333", cursor: "pointer", fontWeight: 600, outline: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 }}>
              {renderOptions()}
            </select>
          </div>

          {loading && <div style={{ color: "#888", fontSize: "0.85rem", padding: "10px 0" }}>{tr ? "Yükleniyor..." : "Loading..."}</div>}
          {error   && <div style={{ color: "#c0392b", fontSize: "0.85rem" }}>{error}</div>}

          {mufredat.length > 0 && (<>
            {/* İlerleme kartı */}
            <div style={{ background: "linear-gradient(135deg, #7a1f2b 0%, #a33040 100%)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.68rem", opacity: 0.75, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{tr ? "GENEL İLERLEME" : "OVERALL PROGRESS"}</span>
                  {totalDone > 0 && (
                    <button onClick={clearDone} style={{ fontSize: "0.62rem", padding: "1px 6px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "rgba(255,255,255,0.75)", cursor: "pointer", fontWeight: 600 }}>
                      {tr ? "Temizle" : "Clear"}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>{totalDone}</span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.7 }}>/{totalCodes}</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 900, opacity: 0.3, marginLeft: 6 }}>{totalCodes ? Math.round((totalDone / totalCodes) * 100) : 0}%</span>
                </div>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.2)", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", borderRadius: 99, background: "rgba(255,255,255,0.9)", width: totalCodes ? `${(totalDone / totalCodes) * 100}%` : "0%", transition: "width .5s cubic-bezier(.4,0,.2,1)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {yilStats.map((ys) => (
                  <div key={ys.yil} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.65rem", opacity: 0.8, minWidth: 72 }}>{ys.yil_adi || `${ys.yil}. Yıl`}</span>
                    <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 99, background: ys.done === ys.total && ys.total > 0 ? "#86efac" : "rgba(255,255,255,0.7)", width: ys.total ? `${(ys.done / ys.total) * 100}%` : "0%", transition: "width .5s" }} />
                    </div>
                    <span style={{ fontSize: "0.63rem", opacity: 0.75, minWidth: 30, textAlign: "right" }}>{ys.done}/{ys.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Yıl seç */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{tr ? "Yıl" : "Year"}</span>
                {autoDetectedYear && (
                  <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "#7a1f2b", background: "#fdf0f2", border: "1px solid #f5c6cb", borderRadius: 6, padding: "1px 7px", letterSpacing: 0 }}>
                    {tr ? `${autoDetectedYear}. yılın otomatik seçildi` : `Year ${autoDetectedYear} auto-selected`}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {mufredat.map((y) => {
                  const st = yilStats.find((s) => s.yil === y.yil);
                  const isComplete = st && st.total > 0 && st.done === st.total;
                  const isAuto = autoDetectedYear === y.yil && selectedYil === y.yil;
                  return (
                    <button key={y.yil} onClick={() => setSelectedYil(selectedYil === y.yil ? null : y.yil)} style={{ padding: "6px 13px", borderRadius: 8, fontSize: "0.82rem", cursor: "pointer", fontWeight: 600, transition: "all .15s", border: selectedYil === y.yil ? "2px solid #7a1f2b" : "2px solid #e5e0da", background: selectedYil === y.yil ? "#7a1f2b" : "#fff", color: selectedYil === y.yil ? "#fff" : "#333", position: "relative" }}>
                      {yilLabel(y)}
                      {isAuto && <span style={{ position: "absolute", top: -6, right: -6, fontSize: "0.58rem", background: "#e53e3e", color: "#fff", borderRadius: 99, padding: "1px 4px", fontWeight: 700 }}>●</span>}
                      {isComplete && !isAuto && <span style={{ position: "absolute", top: -5, right: -5, fontSize: "0.65rem", background: "#22c55e", color: "#fff", borderRadius: 99, padding: "1px 4px", fontWeight: 700 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Yarıyıl seç */}
            {selectedYil && yilData && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{tr ? "Dönem" : "Semester"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  <button onClick={() => setSelectedYariyil(null)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: "0.8rem", cursor: "pointer", fontWeight: 600, transition: "all .12s", border: selectedYariyil === null ? "2px solid #7a1f2b" : "2px solid #e5e0da", background: selectedYariyil === null ? "#7a1f2b" : "#fff", color: selectedYariyil === null ? "#fff" : "#333" }}>{tr ? "Tümü" : "All"}</button>
                  {yilData.yariyillar.map((yy) => (
                    <button key={yy.yariyil} onClick={() => setSelectedYariyil(selectedYariyil === yy.yariyil ? null : yy.yariyil)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: "0.8rem", cursor: "pointer", fontWeight: 600, transition: "all .12s", border: selectedYariyil === yy.yariyil ? "2px solid #7a1f2b" : "2px solid #e5e0da", background: selectedYariyil === yy.yariyil ? "#7a1f2b" : "#fff", color: selectedYariyil === yy.yariyil ? "#fff" : "#333" }}>
                      {yy.yariyil_adi || `${yy.yariyil}. Dönem`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filtre + Temizle */}
            {selectedYil && yilData && (
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e0da" }}>
                  {VIEW_FILTERS.map((f) => (
                    <button key={f.key} onClick={() => setViewFilter(f.key)} style={{ padding: "5px 12px", fontSize: "0.77rem", fontWeight: 600, border: "none", cursor: "pointer", transition: "all .12s", background: viewFilter === f.key ? "#7a1f2b" : "#fff", color: viewFilter === f.key ? "#fff" : "#555", borderRight: f.key !== "todo" ? "1px solid #e5e0da" : "none" }}>
                      {tr ? f.tr : f.en}
                      {f.key === "done" && done.size > 0 && (
                        <span style={{ marginLeft: 5, fontSize: "0.68rem", background: viewFilter === f.key ? "rgba(255,255,255,0.25)" : "#f0fdf4", color: viewFilter === f.key ? "#fff" : "#15803d", borderRadius: 99, padding: "1px 5px" }}>
                          {yilDersleri.filter((d) => d.kod && done.has(normCode(d.kod))).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {done.size > 0 && (
                  confirmClear ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.73rem", color: "#555" }}>{tr ? "Emin misin?" : "Are you sure?"}</span>
                      <button onClick={clearDone} style={{ fontSize: "0.73rem", padding: "4px 10px", borderRadius: 7, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>{tr ? "Evet" : "Yes"}</button>
                      <button onClick={() => setConfirmClear(false)} style={{ fontSize: "0.73rem", padding: "4px 10px", borderRadius: 7, border: "1px solid #e5e0da", background: "#fff", color: "#555", cursor: "pointer", fontWeight: 600 }}>{tr ? "Hayır" : "No"}</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmClear(true)} style={{ fontSize: "0.75rem", padding: "5px 12px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>
                      {tr ? "Temizle" : "Clear all"}
                    </button>
                  )
                )}
              </div>
            )}

            {/* Ders listesi */}
            {selectedYil && yilData && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#888", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{tr ? "Dersler" : "Courses"}</span>
                  <span style={{ fontWeight: 400, fontSize: "0.73rem" }}>{matchedYilDersleri.length}/{yilDersleri.length} {tr ? "katalogda" : "in catalog"}</span>
                </div>
                <div style={{ border: "1px solid #f0ece8", borderRadius: 10, overflow: "hidden", maxHeight: 340, overflowY: "auto" }}>
                  {yilData.yariyillar
                    .filter((yariyil) => selectedYariyil == null || yariyil.yariyil === selectedYariyil)
                    .map((yariyil) => (
                      <div key={yariyil.yariyil}>
                        <div style={{ padding: "5px 12px", background: "#f5f0ec", fontSize: "0.71rem", fontWeight: 700, color: "#7a1f2b", letterSpacing: "0.04em", borderBottom: "1px solid #ede8e3" }}>
                          {yariyil.yariyil_adi}
                        </div>
                        {(yariyil.dersler || []).map((d, di) => {
                          const isLast = di === yariyil.dersler.length - 1;
                          if (d.secmeli_grup) return <SecmeliGrupRow key={di} grup={d} courses={courses} isLast={isLast} tr={tr} done={done} onToggle={toggleDone} viewFilter={viewFilter} />;
                          if (d.tur || d.aciklama) return <SlotRow key={di} slot={d} isLast={isLast} viewFilter={viewFilter} />;
                          return <CourseRow key={di} ders={d} catalogEntry={findInCatalog(d, courses)} isLast={isLast} tr={tr} done={done} onToggle={toggleDone} viewFilter={viewFilter} />;
                        })}
                      </div>
                    ))}
                </div>
                <div style={{ fontSize: "0.71rem", color: "#aaa", marginTop: 6 }}>
                  {tr ? "☑ tıkla → alındı işaretle · ● yeşil = katalogda var" : "☑ click → mark done · ● green = in catalog"}
                </div>
              </div>
            )}

            {/* CENG ders havuzu */}
            {cengCourses && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 1, background: "#f0ece8" }} />
                  <span style={{ fontSize: "0.73rem", color: "#bbb", fontWeight: 600, whiteSpace: "nowrap" }}>{tr ? "BÖLÜM DERS HAVUZU" : "DEPARTMENT COURSE POOL"}</span>
                  <div style={{ flex: 1, height: 1, background: "#f0ece8" }} />
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {CATEGORY_TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    let count = 0;
                    if (tab.key === "zorunlu") count = zorunluList.filter((c) => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                    if (tab.key === "servis")  count = servisList.filter((c)  => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                    if (tab.key === "secmeli") count = Object.values(secmeliCats).flatMap((c) => c.dersler || []).filter((c) => findInCatalog({ kod: c.courseCode, catalog_kodu: c.metuCourseCode }, courses)).length;
                    return (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, padding: "7px 6px", borderRadius: 8, fontSize: "0.77rem", cursor: "pointer", fontWeight: 600, transition: "all .15s", border: isActive ? "2px solid #7a1f2b" : "2px solid #e5e0da", background: isActive ? "#7a1f2b" : "#fff", color: isActive ? "#fff" : "#555", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span>{tr ? tab.labelTr : tab.labelEn}</span>
                        <span style={{ fontSize: "0.68rem", opacity: 0.8, fontWeight: 400 }}>{count} {tr ? "katalogda" : "in catalog"}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ border: "1px solid #f0ece8", borderRadius: 10, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                  {tabCourseList.length === 0 && <div style={{ padding: 16, fontSize: "0.82rem", color: "#888", textAlign: "center" }}>{tr ? "Bu kategoride ders bulunamadı." : "No courses in this category."}</div>}
                  {tabCourseList.map((c, i) => {
                    if (c._isHeader) return <div key={i} style={{ padding: "7px 12px", background: "#f9f6f3", fontSize: "0.71rem", fontWeight: 600, color: "#7a5c1f", borderBottom: "1px solid #f0ece8" }}>{c.label}</div>;
                    const ders = { kod: c.courseCode || c.kod, ad: c.courseName || c.ad, catalog_kodu: c.metuCourseCode || c.catalog_kodu, odtu_kredi: c.odtu_kredi, ects: c.ects, catalogUrl: c.catalogUrl };
                    const cat = findInCatalog(ders, courses);
                    const isLast = i === tabCourseList.length - 1 || tabCourseList[i + 1]?._isHeader;
                    return <CourseRow key={i} ders={ders} catalogEntry={cat} isLast={isLast} tr={tr} done={done} onToggle={toggleDone} viewFilter="all" />;
                  })}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#aaa", marginTop: 6 }}>{tr ? "● yeşil = katalogda var · tıkla → şubeler veya katalog sayfası" : "● green = in catalog · click → sections or catalog page"}</div>
              </div>
            )}
          </>)}
        </div>

        {/* Alt buton */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #f0ece8", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e0da", background: "#fff", color: "#555", fontSize: "0.85rem", cursor: "pointer", fontWeight: 500 }}>{tr ? "İptal" : "Cancel"}</button>
          <button onClick={handleApply} disabled={!matchedYilDersleri.length} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: matchedYilDersleri.length ? "#7a1f2b" : "#e5e0da", color: matchedYilDersleri.length ? "#fff" : "#aaa", fontSize: "0.85rem", cursor: matchedYilDersleri.length ? "pointer" : "not-allowed", fontWeight: 700 }}>
            {selectedYil
              ? (tr ? `${matchedYilDersleri.length} dersi Planlarıcıya Yükle` : `Load ${matchedYilDersleri.length} courses to Scheduler`)
              : (tr ? "Yıl seç" : "Select a year")}
          </button>
        </div>
      </div>
    </div>
  );
}
