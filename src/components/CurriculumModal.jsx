import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

const CURRICULUM_FILE = "/metu_all_programsv3.json";

const YEAR_TO_NUM = {
  "FIRST YEAR": 1,
  "SECOND YEAR": 2,
  "THIRD YEAR": 3,
  "FOURTH YEAR": 4,
  "FIFTH YEAR": 5,
};

const YIL_ADI_MAP = {
  1: "1. Yıl",
  2: "2. Yıl",
  3: "3. Yıl",
  4: "4. Yıl",
  5: "5. Yıl",
};

const SEM_TO_NUM = {
  "First Semester": 1,
  "Second Semester": 2,
  "Third Semester": 3,
  "Fourth Semester": 4,
  "Fifth Semester": 5,
  "Sixth Semester": 6,
  "Seventh Semester": 7,
  "Eighth Semester": 8,

  "1. Dönem": 1,
  "2. Dönem": 2,
  "3. Dönem": 3,
  "4. Dönem": 4,
  "5. Dönem": 5,
  "6. Dönem": 6,
  "7. Dönem": 7,
  "8. Dönem": 8,
};

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (!value.length) return fallback;

    return (
      value
        .map((item) => safeText(item, ""))
        .filter(Boolean)
        .join(", ") || fallback
    );
  }

  if (typeof value === "object") {
    return (
      value.name ||
      value.label ||
      value.text ||
      value.value ||
      value.description ||
      value.desc ||
      value.tr ||
      value.en ||
      value.programNameEng ||
      value.programNameTr ||
      value.courseName ||
      value.courseCode ||
      value.code ||
      fallback
    );
  }

  return fallback;
}

function normalizeDersler(dersler) {
  return (dersler || [])
    .filter((d) => {
      const kod = (d.kod || "").toLowerCase().trim();
      return !kod || (kod !== "course code" && kod !== "ders kodu");
    })
    .map((d) => {
      const out = { ...d };

      if (out.odtu_kredi != null && out.metu_kredi == null) {
        out.metu_kredi = out.odtu_kredi;
      }

      if (out.metu_kredi != null && out.odtu_kredi == null) {
        out.odtu_kredi = out.metu_kredi;
      }

      if (out.secenekler) {
        out.secenekler = normalizeDersler(out.secenekler);
      }

      return out;
    });
}

function convertNewCatalog(program) {
  const yilMap = {};

  for (const entry of program.curriculum || []) {
    const yilNo =
      Number(entry.year_number) ||
      YEAR_TO_NUM[entry.year] ||
      0;

    const globalSemesterNo =
      Number(entry.semester_number) ||
      SEM_TO_NUM[entry.semester] ||
      0;

    const yearSemesterNo =
      Number(entry.year_semester_number) ||
      SEM_TO_NUM[entry.year_semester] ||
      (globalSemesterNo ? ((globalSemesterNo - 1) % 2) + 1 : 0);

    if (!yilNo || !yearSemesterNo) continue;

    if (!yilMap[yilNo]) {
      yilMap[yilNo] = {};
    }

    const dersler = (entry.courses || []).map((c) =>
      c.type === "elective_slot"
        ? {
            tur: c.name || "Elective",
            aciklama: c.name || "Elective",
            ects: c.ects ?? null,
          }
        : {
            kod: c.code || "",
            ad: c.name || "",
            odtu_kredi: c.credit ?? null,
            metu_kredi: c.credit ?? null,
            ects: c.ects ?? null,
            ders_saat: c.contact_h_w ?? null,
            lab_saat: c.lab_h_w ?? null,
            catalog_kodu: c.code || "",
          }
    );

    yilMap[yilNo][yearSemesterNo] = {
      yariyil: yearSemesterNo,
      yariyil_adi: `${yearSemesterNo}. Dönem`,

      global_yariyil: globalSemesterNo || null,
      global_yariyil_adi: globalSemesterNo ? `${globalSemesterNo}. Dönem` : null,

      dersler: normalizeDersler(dersler),
    };
  }

  const mufredat = Object.keys(yilMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((yilNo) => ({
      yil: yilNo,
      yil_adi: YIL_ADI_MAP[yilNo] || `${yilNo}. Yıl`,
      yariyillar: Object.keys(yilMap[yilNo])
        .map(Number)
        .sort((a, b) => a - b)
        .map((sn) => yilMap[yilNo][sn]),
    }));

  return { mufredat };
}

function isNccFacultyOrProgram(faculty, program) {
  const text = [
    faculty?.faculty_id,
    faculty?.faculty_name,
    faculty?.website,
    faculty?.catalog_url,
    program?.program_id,
    program?.program_name,
    program?.department_name,
    program?.website,
    program?.catalog_url,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");

  return (
    text.includes("[ncc]") ||
    text.includes(" ncc ") ||
    text.includes("ncc engineering") ||
    text.includes("ncc economic") ||
    text.includes("ncc education") ||
    text.includes("ncc.metu.edu.tr") ||
    text.includes("northern cyprus") ||
    Number(faculty?.faculty_id) === 997 ||
    Number(faculty?.faculty_id) === 998 ||
    Number(faculty?.faculty_id) === 999
  );
}

function flattenProgramsFromAllProgramsJson(data) {
  return (data?.faculties || [])
    .flatMap((faculty) =>
      (faculty.programs || [])
        .filter((program) => !isNccFacultyOrProgram(faculty, program))
        .map((program) => ({
          label: `${safeText(program.program_id, "")} — ${safeText(program.program_name, "")}`,
          prog_id: Number(program.program_id),
          program,
          faculty_id: faculty.faculty_id,
          faculty_name: faculty.faculty_name,
          isEng: true,
        }))
    )
    .filter((p) => p.prog_id && p.program?.curriculum?.length)
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

// program_id → bölüm prefix map (App.jsx ile aynı)
const PROGRAM_ID_TO_PREFIXES_CM = {
  "120":["ARCH"],"121":["CRP"],"125":["ID"],"219":["GENE"],"232":["SOC"],
  "233":["PSY"],"234":["CHEM"],"238":["BIO"],"240":["HIST"],"241":["PHIL"],
  "246":["STAT"],"310":["ADM"],"311":["ECON"],"312":["ADM","ECON"],
  "314":["IR"],"315":["GIA"],"316":["BAS"],"411":["ECE"],"412":["MSE"],
  "413":["MSE"],"421":["MSE"],"422":["MSE"],"423":["MSE"],"430":["CEIT"],
  "450":["FLE"],"451":["TEFL"],"453":["PES"],"560":["ENVE"],"562":["CE"],
  "563":["CHE"],"564":["GEOE"],"565":["MINE"],"566":["PETE"],
  "567":["EE","EEE"],"568":["IE"],"569":["ME"],"570":["METE"],
  "571":["CENG"],"572":["AEE"],"573":["FDE"],"575":["CNGB"],
};

function findDeptByCode(deptCode, allCurricula) {
  if (!deptCode || !allCurricula?.length) return null;

  const numericCode = Number(deptCode);

  // 1. Doğrudan program_id eşleşmesi
  if (numericCode) {
    const byProgramId = allCurricula.find((d) => Number(d.prog_id) === numericCode);
    if (byProgramId) return byProgramId;
  }

  // 2. prefix üzerinden: kullanıcı dept="CENG" gibi string verirse
  //    o prefix'e sahip program_id'yi map'ten bul
  const upper = String(deptCode).toUpperCase();
  const matchedPid = Object.entries(PROGRAM_ID_TO_PREFIXES_CM).find(
    ([, prefixes]) => prefixes.includes(upper)
  )?.[0];
  if (matchedPid) {
    const byPrefix = allCurricula.find((d) => String(d.prog_id) === matchedPid);
    if (byPrefix) return byPrefix;
  }

  // 3. Label ile eşleşme
  return (
    allCurricula.find((d) => {
      const label = String(d.label || "").toUpperCase();
      return (
        label.startsWith(upper + " ") ||
        label.startsWith(upper + "—") ||
        label.startsWith(upper + " —")
      );
    }) || null
  );
}

function getAutoDetectedYear(user) {
  const year = Number(user?.year || user?.yearNum || 0);
  return year || null;
}

function getAutoDetectedYariyil(user) {
  const semesterCode = String(user?.semester || "");
  const academicTerm = Number(semesterCode.slice(-1));

  if (!academicTerm) return null;

  if (academicTerm === 1 || academicTerm === 2) {
    return academicTerm;
  }

  return null;
}



function catalogUrl(ders) {
  if (ders.catalog_kodu) {
    return `https://catalog.metu.edu.tr/course.php?course_code=${ders.catalog_kodu}`;
  }

  return null;
}

function normCode(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase();
}

function findInCatalog(ders, courses) {
  if (!ders?.kod || !courses?.length) return null;
  const dersKod = normCode(ders.kod);
  const dersCat = ders.catalog_kodu ? normCode(String(ders.catalog_kodu)) : null;
  return courses.find((mc) => {
    const mcCode = normCode(mc.code);
    const mcOrig = mc.originalCode ? normCode(String(mc.originalCode)) : null;
    if (mcCode === dersKod) return true;
    if (dersCat && mcCode === dersCat) return true;
    if (mcOrig && (mcOrig === dersKod || (dersCat && mcOrig === dersCat))) return true;
    return false;
  }) || null;
}


function CourseRow({ ders, catalogEntry, isLast, tr, selected, onSelect }) {
  const [open, setOpen] = useState(false);

  const sections = catalogEntry?.sections || [];
  const hasSections = sections.length > 0;
  const url = catalogUrl(ders) || catalogEntry?.catalogUrl || null;
  const isSelected = selected && catalogEntry ? selected.has(normCode(ders.kod)) : false;

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec" }}>
      <div
        onClick={(e) => {
          if (e.target.dataset.select) return;
          if (!catalogEntry) return;
          if (hasSections) {
            setOpen((v) => !v);
          } else if (url) {
            window.open(url, "_blank");
          }
        }}
        style={{
          padding: "7px 12px",
          display: "flex",
          alignItems: "center",
          gap: 9,
          background: open ? "#fdf8f5" : catalogEntry ? "#fff" : "#fafafa",
          opacity: catalogEntry ? 1 : 0.55,
          cursor: catalogEntry ? "pointer" : "default",
          transition: "background .12s",
        }}
      >
        {/* Seçim checkbox'ı — sadece katalogda olan dersler için */}
        {catalogEntry ? (
          <button
            data-select="1"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(normCode(ders.kod));
            }}
            title={isSelected ? (tr ? "Seçimi kaldır" : "Deselect") : (tr ? "Seç" : "Select")}
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              flexShrink: 0,
              border: isSelected ? "none" : "2px solid #d1d5db",
              background: isSelected ? "#7a1f2b" : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.65rem",
              color: "#fff",
              transition: "all .15s",
              padding: 0,
              outline: "none",
            }}
          >
            {isSelected ? "✓" : ""}
          </button>
        ) : (
          <div style={{ width: 18, height: 18, flexShrink: 0 }} />
        )}

        {/* Katalogda var/yok göstergesi (statik dot) */}
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            flexShrink: 0,
            background: catalogEntry ? "#22c55e" : "#d1d5db",
          }}
        />

        <span style={{ fontSize: "0.77rem", fontWeight: 700, color: "#7a1f2b", minWidth: 68, flexShrink: 0 }}>
          {safeText(ders.kod, "")}
        </span>

        <span style={{ fontSize: "0.77rem", color: "#333", flex: 1, lineHeight: 1.4 }}>
          {safeText(ders.ad)}
        </span>

        {(ders.odtu_kredi != null || ders.ects || ders.akts) && (
          <span style={{ fontSize: "0.72rem", color: "#aaa", flexShrink: 0, marginRight: 4 }}>
            {ders.odtu_kredi != null
              ? `${safeText(ders.odtu_kredi, "")}k`
              : `${safeText(ders.ects ?? ders.akts, "")} ECTS`}
          </span>
        )}

        {catalogEntry ? (
          hasSections ? (
            <span style={{ fontSize: "0.7rem", color: "#aaa", flexShrink: 0, display: "inline-block", transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
          ) : url ? (
            <span style={{ fontSize: "0.7rem", color: "#aaa", flexShrink: 0 }}>↗</span>
          ) : null
        ) : null}
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
                  <span style={{ fontWeight: 700, color: "#7a1f2b" }}>§{safeText(sec.id, "")}</span>
                  <span style={{ color: "#555" }}>{safeText(sec.instructor)}</span>
                  <span style={{ color: "#374151", flex: 1 }}>{schedule || (tr ? "Zaman yok" : "No schedule")}</span>
                  {sec.crn && <span style={{ fontSize: "0.69rem", color: "#888" }}>CRN: {safeText(sec.crn, "")}</span>}
                </div>
              );
            })}
          </div>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: "0.71rem", color: "#7a1f2b", marginTop: 6, display: "inline-block" }}>
              ↗ {tr ? "Katalog sayfasını aç" : "Open catalog page"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function SlotRow({ slot, isLast }) {
  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "1px solid #f5f0ec",
        padding: "7px 12px",
        display: "flex",
        alignItems: "center",
        gap: 9,
        background: "#f9f9f9",
        opacity: 0.6,
      }}
    >
      <div style={{ width: 18, height: 18, flexShrink: 0 }} />
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#d1d5db",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: "0.75rem", color: "#666", fontStyle: "italic" }}>
        {safeText(slot.tur || slot.aciklama)}
      </span>
    </div>
  );
}

export default function CurriculumModal({
  lang,
  courses,
  user,
  onApplyToScheduler,
  onApplyWithSections,
  onClose,
}) {
  const tr = lang === "tr";

  const autoDetectedYear = getAutoDetectedYear(user);
  const autoDetectedYariyil = getAutoDetectedYariyil(user);

  const [allCurricula, setAllCurricula] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedYil, setSelectedYil] = useState(autoDetectedYear);
  const [selectedYariyil, setSelectedYariyil] = useState(null);

  const [viewFilter, setViewFilter] = useState("all"); // kept for internal logic compat

  // Seçili dersler (planlayıcıya/akıllı planlamaya gidecek) — default: tüm katalog dersleri
  const [selectedCodes, setSelectedCodes] = useState(new Set());



  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(CURRICULUM_FILE);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const curricula = flattenProgramsFromAllProgramsJson(data);

        if (!alive) return;

        setAllCurricula(curricula);

        if (!curricula.length) {
          setError(
            tr
              ? "Müfredat dosyasında program bulunamadı."
              : "No programs found in curriculum file."
          );
        }
      } catch (err) {
        if (!alive) return;

        setError(tr ? "Müfredat yüklenemedi." : "Failed to load curriculum.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tr]);

  useEffect(() => {
    if (!allCurricula.length) return;

    const detected = findDeptByCode(
      user?.programCode || user?.dept || user?.programName,
      allCurricula
    );

    setSelectedDept((prev) => {
      const prevStillExists =
        prev && allCurricula.some((d) => d.prog_id === prev.prog_id);

      if (prevStillExists) return prev;

      return detected || allCurricula[0];
    });
  }, [allCurricula, user?.programCode, user?.dept, user?.programName]);

  useEffect(() => {
    if (!selectedDept) return;

    setLoading(true);
    setError(null);
    setCurriculum(null);

    const program = selectedDept.program;

    if (program?.curriculum?.length) {
      const result = convertNewCatalog(program);
      setCurriculum(result);
      setLoading(false);
    } else {
      setError(tr ? "Bu bölüm için müfredat bulunamadı." : "Curriculum not found for this department.");
      setLoading(false);
    }
  }, [selectedDept, tr]);

  useEffect(() => {
    if (!autoDetectedYear || !curriculum?.mufredat?.length) return;

    const exists = curriculum.mufredat.find((y) => y.yil === autoDetectedYear);

    if (exists) {
      setSelectedYil(autoDetectedYear);
    }
  }, [curriculum, autoDetectedYear]);

  useEffect(() => {
    if (!selectedYil || !autoDetectedYariyil || !curriculum?.mufredat?.length) return;

    const yilData = curriculum.mufredat.find((y) => y.yil === selectedYil);
    const exists = yilData?.yariyillar?.some((yy) => yy.yariyil === autoDetectedYariyil);

    if (exists) {
      setSelectedYariyil(autoDetectedYariyil);
    }
  }, [curriculum, selectedYil, autoDetectedYariyil]);



  const mufredat = curriculum?.mufredat || [];

  const yilData = mufredat.find((y) => y.yil === selectedYil);

  const yilDersleri = useMemo(() => {
    if (!yilData) return [];

    const list = [];

    const yariyillar = selectedYariyil
      ? yilData.yariyillar.filter((y) => y.yariyil === selectedYariyil)
      : yilData.yariyillar;

    yariyillar.forEach((y) =>
      y.dersler.forEach((d) => {
        if (d.kod) {
          list.push(d);
        }
      })
    );

    return list;
  }, [yilData, selectedYariyil]);

  const matchedYilDersleri = useMemo(() => {
    return yilDersleri.filter((d) => findInCatalog(d, courses));
  }, [yilDersleri, courses]);

  // Seçili dersler (katalogda olanlardan checkbox ile seçilenler)
  const selectedDersleri = useMemo(() => {
    return matchedYilDersleri.filter((d) => selectedCodes.has(normCode(d.kod)));
  }, [matchedYilDersleri, selectedCodes]);

  // Dönem/yıl değişince selectedCodes'u tüm katalog derslerine sıfırla
  useEffect(() => {
    if (!matchedYilDersleri.length) return;
    setSelectedCodes(new Set(matchedYilDersleri.map((d) => normCode(d.kod))));
  }, [yilDersleri]); // yilDersleri değişince (dönem/yıl seçimi) tetiklenir

  // Tek bir dersi seç/kaldır
  const toggleSelected = useCallback((kod) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(kod)) {
        next.delete(kod);
      } else {
        next.add(kod);
      }
      return next;
    });
  }, []);

  // Tümünü seç / kaldır
  const toggleSelectAll = useCallback(() => {
    setSelectedCodes((prev) => {
      const allCodes = matchedYilDersleri.map((d) => normCode(d.kod));
      const allSelected = allCodes.every((c) => prev.has(c));
      if (allSelected) {
        const next = new Set(prev);
        allCodes.forEach((c) => next.delete(c));
        return next;
      } else {
        const next = new Set(prev);
        allCodes.forEach((c) => next.add(c));
        return next;
      }
    });
  }, [matchedYilDersleri]);

  const [smartPlanOpen, setSmartPlanOpen] = useState(false);

  const handleApply = () => {
    if (!selectedDersleri.length) return;

    onApplyToScheduler(
      new Set(
        selectedDersleri.map((d) =>
          d.catalog_kodu ? String(d.catalog_kodu) : normCode(d.kod)
        )
      )
    );

    onClose();
  };



  

// ═══════════════════════════════════════════════════════════════════════
// SmartPlanWizard
// Müfredat yapısına dokunmadan, seçilen derslerin section'larını
// kullanıcı tercihlerine göre çakışmasız olarak önerir.
// ═══════════════════════════════════════════════════════════════════════
function sectionsOverlap(a, b) {
  for (const ma of a.meetings || []) {
    for (const mb of b.meetings || []) {
      if (ma.d !== mb.d) continue;
      const aStart = ma.s, aEnd = ma.e, bStart = mb.s, bEnd = mb.e;
      if (aStart < bEnd && bStart < aEnd) return true;
    }
  }
  return false;
}

// buildConflictFree artık buildConflictFreeAdvanced tarafından ele alınıyor

const DAY_LABELS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Saat string'ini dakikaya çevirir: "08:40" → 520
function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Section'ın tüm meeting'lerini kapsayan başlangıç/bitiş dakikaları
function secTimeRange(sec) {
  const mins = (sec.meetings || []).flatMap(m => [timeToMin(m.s), timeToMin(m.e)]).filter(v => v !== null);
  if (!mins.length) return null;
  return { start: Math.min(...mins), end: Math.max(...mins) };
}

// Saat tercih skorlaması: earliestStart=en erken başlasın (düşük start iyi), latestEnd=en geç bitsin (yüksek end iyi)
function timeScore(sec, pref) {
  const range = secTimeRange(sec);
  if (!range) return 0;
  let score = 0;
  if (pref.earliestStart !== '') {
    const limit = Number(pref.earliestStart);
    // limit saatten önce başlayanlar tercih edilir
    score -= Math.abs(range.start - limit * 60);
  }
  if (pref.latestEnd !== '') {
    const limit = Number(pref.latestEnd);
    // limit saatten sonra bitmeyenler tercih edilir
    score -= Math.abs(range.end - limit * 60);
  }
  return score;
}

// Gelişmiş buildConflictFree: çakışırsa alternatif section önerir, yoksa detaylı neden bildirir
function buildConflictFreeAdvanced(picks) {
  const chosen = []; // { sec, code, sectionId }
  const result = [];

  for (const pick of picks) {
    const sorted = [...pick.sections].sort((a, b) => {
      // hoca tercihi
      if (pick.preferred?.instructor) {
        const pa = a.instructor?.toLowerCase().includes(pick.preferred.instructor.toLowerCase()) ? 0 : 1;
        const pb = b.instructor?.toLowerCase().includes(pick.preferred.instructor.toLowerCase()) ? 0 : 1;
        if (pa !== pb) return pa - pb;
      }
      // gün tercihi
      if (pick.preferred?.day !== undefined) {
        const da = a.meetings?.some(m => m.d === pick.preferred.day) ? 0 : 1;
        const db = b.meetings?.some(m => m.d === pick.preferred.day) ? 0 : 1;
        if (da !== db) return da - db;
      }
      // saat tercihi skoru (yüksek = daha iyi)
      const sa = timeScore(a, pick.preferred || {});
      const sb = timeScore(b, pick.preferred || {});
      return sb - sa;
    });

    let placed = false;
    let conflictingWith = [];

    for (const sec of sorted) {
      const conflicts = chosen.filter(cs => sectionsOverlap(sec, cs.sec));
      if (conflicts.length === 0) {
        chosen.push({ sec, code: pick.code, sectionId: sec.id });
        result.push({ code: pick.code, sectionId: sec.id, section: sec, hasConflict: false });
        placed = true;
        break;
      } else {
        if (!conflictingWith.length) conflictingWith = conflicts;
      }
    }

    if (!placed) {
      // Hiçbir section çakışmasız yerleştirilemedi
      // En iyi adayı ve çakışan dersleri raporla
      const bestSec = sorted[0];
      const conflictDetails = conflictingWith.map(cs => ({
        code: cs.code,
        sectionId: cs.sectionId,
        meetings: cs.sec.meetings,
      }));

      // Kritere uyan section var mı? (tercih dışında çakışmasız olan)
      const anyFit = sorted.find(sec => chosen.every(cs => !sectionsOverlap(sec, cs.sec)));

      result.push({
        code: pick.code,
        sectionId: bestSec?.id,
        section: bestSec,
        hasConflict: true,
        noAlternative: !anyFit,
        conflictDetails,
        // Tercih kriterini karşılayan ama çakışan section sayısı
        preferredCount: sorted.filter(sec => {
          if (pick.preferred?.instructor && !sec.instructor?.toLowerCase().includes(pick.preferred.instructor.toLowerCase())) return false;
          return true;
        }).length,
        totalSections: sorted.length,
      });
    }
  }
  return result;
}

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 – 21:00

function SmartPlanWizard({ dersler, courses, tr: isTr, onApply, onClose }) {
  const DAY_LABELS = isTr ? DAY_LABELS_TR : DAY_LABELS_EN;

  // Tercih state: { instructor, day, earliestStart, latestEnd }
  const [prefs, setPrefs] = useState(() => {
    const init = {};
    dersler.forEach(d => { init[normCode(d.kod)] = { instructor: '', day: undefined, earliestStart: '', latestEnd: '' }; });
    return init;
  });

  const [step, setStep] = useState('prefs');
  const [result, setResult] = useState(null);

  const catalogDers = useMemo(() => {
    return dersler.map(d => {
      const entry = findInCatalog(d, courses);
      return { ders: d, entry };
    }).filter(x => x.entry && x.entry.sections?.length > 0);
  }, [dersler, courses]);

  const setPref = (kod, key, val) => {
    setPrefs(prev => ({ ...prev, [kod]: { ...prev[kod], [key]: val } }));
  };

  const handleGenerate = () => {
    const picks = catalogDers.map(({ ders, entry }) => ({
      code: entry.code,
      sections: entry.sections,
      preferred: prefs[normCode(ders.kod)] || {},
    }));
    const res = buildConflictFreeAdvanced(picks);
    setResult(res);
    setStep('result');
  };

  const handleApplyResult = () => {
    if (!result) return;
    onApply(result.map(r => ({ code: r.code, sectionId: r.sectionId })));
    onClose();
  };

  if (step === 'result') {
    const conflicts = result.filter(r => r.hasConflict);
    const ok = result.filter(r => !r.hasConflict);
    return (
      <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f0ece8', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <button onClick={() => setStep('prefs')} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a1f2b', fontSize:'1.1rem', padding:'0 4px' }}>←</button>
          <span style={{ fontWeight:700, fontSize:'0.95rem' }}>
            {isTr ? 'Önerilen Program' : 'Suggested Schedule'}
          </span>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
          {conflicts.length === 0 ? (
            <div style={{ marginBottom:12, padding:'8px 12px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, fontSize:'0.78rem', color:'#166534', fontWeight:600 }}>
              ✓ {isTr ? 'Tüm dersler çakışmasız yerleştirildi.' : 'All courses placed without conflicts.'}
            </div>
          ) : (
            <>
              {ok.length > 0 && (
                <div style={{ marginBottom:8, padding:'8px 12px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, fontSize:'0.78rem', color:'#166534' }}>
                  ✓ {ok.length} {isTr ? 'ders çakışmasız yerleştirildi.' : 'course(s) placed without conflict.'}
                </div>
              )}
              {conflicts.map((r, ci) => {
                const dayNames = isTr ? DAY_LABELS_TR : DAY_LABELS_EN;
                const conflictList = (r.conflictDetails || []).map(cd => {
                  const mStr = (cd.meetings || []).map(m => `${dayNames[m.d]??m.d} ${m.s}–${m.e}`).join(', ');
                  return `${cd.code} §${cd.sectionId}${mStr ? ` (${mStr})` : ''}`;
                }).join('; ');
                return (
                  <div key={ci} style={{ marginBottom:10, padding:'10px 12px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:10, fontSize:'0.78rem', color:'#92400e' }}>
                    <div style={{ fontWeight:700, marginBottom:4 }}>⚠ {r.code}</div>
                    {r.noAlternative ? (
                      <div>
                        {isTr
                          ? `Bu derse ait tüm ${r.totalSections} şube mevcut programla çakışıyor. Seçtiğin derslere göre en uygun program bu şekilde oluşturuldu; §${r.sectionId} eklendi.`
                          : `All ${r.totalSections} sections conflict with the current schedule. Best possible schedule was built; §${r.sectionId} was added.`}
                        {conflictList && <div style={{ marginTop:4, color:'#b45309' }}>
                          {isTr ? 'Çakışan dersler: ' : 'Conflicts with: '}{conflictList}
                        </div>}
                      </div>
                    ) : (
                      <div>
                        {isTr
                          ? `Tercihlerine uyan ${r.preferredCount} şubeden hiçbiri çakışmasız yerleştirilemedi. En uygun şube §${r.sectionId} seçildi.`
                          : `None of the ${r.preferredCount} section(s) matching your preferences could be placed without conflict. Best fit §${r.sectionId} was selected.`}
                        {conflictList && <div style={{ marginTop:4, color:'#b45309' }}>
                          {isTr ? 'Çakışan dersler: ' : 'Conflicts with: '}{conflictList}
                        </div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
            {result.map((r, i) => {
              const sec = r.section;
              const schedule = (sec?.meetings || [])
                .map(m => `${DAY_LABELS[m.d] ?? m.d} ${m.s}–${m.e}`)
                .join(', ');
              return (
                <div key={i} style={{
                  padding:'10px 14px', borderRadius:10,
                  border: r.hasConflict ? '1.5px solid #fca5a5' : '1.5px solid #d1fae5',
                  background: r.hasConflict ? '#fff5f5' : '#f0fdf4',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:'0.82rem', color:'#7a1f2b' }}>{r.code}</span>
                      <span style={{ marginLeft:8, fontSize:'0.75rem', color:'#555', fontWeight:600 }}>§{sec?.id}</span>
                      {r.hasConflict && <span style={{ marginLeft:8, fontSize:'0.7rem', color:'#dc2626' }}>⚠ çakışma</span>}
                    </div>
                    <span style={{ fontSize:'0.7rem', color:'#888', flexShrink:0 }}>CRN {sec?.crn}</span>
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'#444', marginTop:3 }}>{sec?.instructor}</div>
                  <div style={{ fontSize:'0.73rem', color:'#374151', marginTop:2 }}>{schedule || (isTr ? 'Zaman yok' : 'No schedule')}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding:'12px 20px', borderTop:'1px solid #f0ece8', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #e5e0da', background:'#fff', color:'#555', fontSize:'0.85rem', cursor:'pointer', fontWeight:500 }}>
            {isTr ? 'İptal' : 'Cancel'}
          </button>
          <button onClick={handleApplyResult} style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'#7a1f2b', color:'#fff', fontSize:'0.85rem', cursor:'pointer', fontWeight:700 }}>
            {isTr ? `${result.length} dersi uygula` : `Apply ${result.length} courses`}
          </button>
        </div>
      </div>
    );
  }

  // step === 'prefs'
  const selectStyle = {
    padding: '3px 8px', borderRadius: 6, fontSize: '0.76rem',
    border: '1.5px solid #e5e0da', background: '#fff', color: '#333',
    cursor: 'pointer', outline: 'none', appearance: 'none',
    WebkitAppearance: 'none', minWidth: 80,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #f0ece8', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#888', fontSize:'1.1rem', padding:'0 4px' }}>✕</button>
        <div>
          <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{isTr ? 'Akıllı Planlama' : 'Smart Schedule'}</div>
          <div style={{ fontSize:'0.72rem', color:'#aaa' }}>
            {isTr ? `${catalogDers.length} ders · tercihlerini seç, çakışmasız program oluştur` : `${catalogDers.length} courses · set preferences, get conflict-free schedule`}
          </div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
        {catalogDers.length === 0 ? (
          <div style={{ textAlign:'center', color:'#aaa', padding:24, fontSize:'0.85rem' }}>
            {isTr ? 'Bu dönem için katalogda ders bulunamadı.' : 'No catalog courses found for this period.'}
          </div>
        ) : catalogDers.map(({ ders, entry }) => {
          const kod = normCode(ders.kod);
          const pref = prefs[kod] || {};
          const instructors = [...new Set((entry.sections || []).map(s => s.instructor).filter(Boolean))];
          const days = [...new Set((entry.sections || []).flatMap(s => (s.meetings || []).map(m => m.d)))].filter(d => d !== undefined).sort();

          return (
            <div key={kod} style={{ marginBottom:12, padding:'10px 12px', borderRadius:10, border:'1.5px solid #f0ece8', background:'#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <div>
                  <span style={{ fontWeight:700, fontSize:'0.82rem', color:'#7a1f2b' }}>{ders.kod}</span>
                  <span style={{ marginLeft:6, fontSize:'0.75rem', color:'#555' }}>{safeText(ders.ad)}</span>
                </div>
                <span style={{ fontSize:'0.7rem', color:'#aaa' }}>{entry.sections?.length} {isTr ? 'şube' : 'sec'}</span>
              </div>

              {/* Hoca tercihi */}
              {instructors.length > 1 && (
                <div style={{ marginBottom:6 }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, color:'#888', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    {isTr ? 'Hoca tercihi' : 'Instructor preference'}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    <button onClick={() => setPref(kod, 'instructor', '')}
                      style={{ padding:'3px 9px', borderRadius:6, fontSize:'0.72rem', border: !pref.instructor ? '1.5px solid #7a1f2b' : '1.5px solid #e5e0da', background: !pref.instructor ? '#7a1f2b' : '#fff', color: !pref.instructor ? '#fff' : '#555', cursor:'pointer', fontWeight:600 }}>
                      {isTr ? 'Fark etmez' : 'Any'}
                    </button>
                    {instructors.map(ins => (
                      <button key={ins} onClick={() => setPref(kod, 'instructor', ins)}
                        style={{ padding:'3px 9px', borderRadius:6, fontSize:'0.72rem', border: pref.instructor === ins ? '1.5px solid #7a1f2b' : '1.5px solid #e5e0da', background: pref.instructor === ins ? '#7a1f2b' : '#fff', color: pref.instructor === ins ? '#fff' : '#555', cursor:'pointer', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {ins}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Gün tercihi */}
              {days.length > 1 && (
                <div style={{ marginBottom:6 }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, color:'#888', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    {isTr ? 'Gün tercihi' : 'Day preference'}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    <button onClick={() => setPref(kod, 'day', undefined)}
                      style={{ padding:'3px 9px', borderRadius:6, fontSize:'0.72rem', border: pref.day === undefined ? '1.5px solid #7a1f2b' : '1.5px solid #e5e0da', background: pref.day === undefined ? '#7a1f2b' : '#fff', color: pref.day === undefined ? '#fff' : '#555', cursor:'pointer', fontWeight:600 }}>
                      {isTr ? 'Fark etmez' : 'Any'}
                    </button>
                    {days.map(d => (
                      <button key={d} onClick={() => setPref(kod, 'day', d)}
                        style={{ padding:'3px 9px', borderRadius:6, fontSize:'0.72rem', border: pref.day === d ? '1.5px solid #7a1f2b' : '1.5px solid #e5e0da', background: pref.day === d ? '#7a1f2b' : '#fff', color: pref.day === d ? '#fff' : '#555', cursor:'pointer', fontWeight:600 }}>
                        {DAY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Saat tercihi: en erken başlangıç + en geç bitiş */}
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:600, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  {isTr ? 'Saat tercihi' : 'Time preference'}
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {/* En erken başlangıç */}
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    <label style={{ fontSize:'0.67rem', color:'#aaa', fontWeight:600 }}>
                      {isTr ? 'En erken başlangıç' : 'Earliest start'}
                    </label>
                    <div style={{ position:'relative' }}>
                      <select
                        value={pref.earliestStart}
                        onChange={e => setPref(kod, 'earliestStart', e.target.value)}
                        style={{ ...selectStyle, paddingRight:24 }}
                      >
                        <option value="">{isTr ? 'Fark etmez' : 'Any'}</option>
                        {HOUR_OPTIONS.map(h => (
                          <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                      <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', fontSize:'0.6rem', color:'#aaa', pointerEvents:'none' }}>▼</span>
                    </div>
                  </div>
                  {/* En geç bitiş */}
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    <label style={{ fontSize:'0.67rem', color:'#aaa', fontWeight:600 }}>
                      {isTr ? 'En geç bitiş' : 'Latest end'}
                    </label>
                    <div style={{ position:'relative' }}>
                      <select
                        value={pref.latestEnd}
                        onChange={e => setPref(kod, 'latestEnd', e.target.value)}
                        style={{ ...selectStyle, paddingRight:24 }}
                      >
                        <option value="">{isTr ? 'Fark etmez' : 'Any'}</option>
                        {HOUR_OPTIONS.map(h => (
                          <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                      <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', fontSize:'0.6rem', color:'#aaa', pointerEvents:'none' }}>▼</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding:'12px 20px', borderTop:'1px solid #f0ece8', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
        <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #e5e0da', background:'#fff', color:'#555', fontSize:'0.85rem', cursor:'pointer', fontWeight:500 }}>
          {isTr ? 'İptal' : 'Cancel'}
        </button>
        <button onClick={handleGenerate} disabled={!catalogDers.length}
          style={{ padding:'9px 20px', borderRadius:8, border:'none', background: catalogDers.length ? '#7a1f2b' : '#e5e0da', color: catalogDers.length ? '#fff' : '#aaa', fontSize:'0.85rem', cursor: catalogDers.length ? 'pointer' : 'not-allowed', fontWeight:700 }}>
          {isTr ? 'Program Oluştur' : 'Generate Schedule'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SearchableDeptSelect — arama yapılabilir bölüm seçici
// ─────────────────────────────────────────────────────────
function SearchableDeptSelect({ allCurricula, selectedDept, onSelect, tr }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Açılınca input'a odaklan + buton pozisyonunu ölç
  useEffect(() => {
    if (open) {
      if (containerRef.current) {
        setRect(containerRef.current.getBoundingClientRect());
      }
      if (inputRef.current) inputRef.current.focus();
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allCurricula;
    const q = query.toLowerCase();
    return allCurricula.filter((d) =>
      d.label.toLowerCase().includes(q)
    );
  }, [allCurricula, query]);

  const displayLabel = selectedDept
    ? selectedDept.label
    : (tr ? "Bölüm seçin..." : "Select department...");

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger butonu */}
      <button
        onClick={() => { setOpen((v) => !v); setQuery(""); }}
        disabled={!allCurricula.length}
        style={{
          width: "100%",
          padding: "8px 36px 8px 12px",
          borderRadius: 8,
          fontSize: "0.85rem",
          border: open ? "2px solid #7a1f2b" : "2px solid #e5e0da",
          background: "#fff",
          color: selectedDept ? "#333" : "#aaa",
          cursor: allCurricula.length ? "pointer" : "not-allowed",
          fontWeight: selectedDept ? 600 : 400,
          outline: "none",
          textAlign: "left",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          transition: "border-color .15s",
          position: "relative",
        }}
      >
        {displayLabel}
        {/* Ok ikonu */}
        <span style={{
          position: "absolute", right: 10, top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: "transform .15s",
          fontSize: "0.7rem", color: "#999", pointerEvents: "none",
        }}>▼</span>
      </button>

      {/* Dropdown panel — position:fixed so overflow:hidden parents don't clip it */}
      {open && rect && (
        <div style={{
          position: "fixed",
          top: rect.bottom + 6,
          left: rect.left,
          width: rect.width,
          background: "#fff",
          border: "2px solid #7a1f2b",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.16)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          maxHeight: `min(520px, ${window.innerHeight - rect.bottom - 24}px)`,
          overflow: "hidden",
        }}>
          {/* Arama kutusu */}
          <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid #f0ece8" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"#999" }}
                width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr ? "Bölüm ara..." : "Search department..."}
                style={{
                  width: "100%",
                  padding: "10px 32px 10px 34px",
                  border: "1.5px solid #e5e0da",
                  borderRadius: 8,
                  fontSize: "0.88rem",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#fafafa",
                  transition: "border-color .15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#7a1f2b"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e0da"; e.target.style.background = "#fafafa"; }}
              />
              {query && (
                <button onClick={() => setQuery("")}
                  style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#aaa", fontSize:16, lineHeight:1, padding:"0 2px" }}>
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "16px 14px", fontSize: "0.85rem", color: "#aaa", textAlign: "center" }}>
                {tr ? "Sonuç bulunamadı" : "No results"}
              </div>
            ) : filtered.map((d) => {
              const isSelected = selectedDept?.prog_id === d.prog_id;
              return (
                <button
                  key={d.prog_id}
                  onClick={() => { onSelect(d); setOpen(false); setQuery(""); }}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    textAlign: "left",
                    border: "none",
                    background: isSelected ? "#fdf0f2" : "transparent",
                    color: isSelected ? "#7a1f2b" : "#333",
                    fontSize: "0.85rem",
                    fontWeight: isSelected ? 700 : 400,
                    cursor: "pointer",
                    borderBottom: "1px solid #f5f1ef",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#fdf8f5"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Kaç sonuç */}
          {query && filtered.length > 0 && (
            <div style={{ padding: "6px 14px", borderTop: "1px solid #f0ece8", fontSize: "0.72rem", color: "#bbb" }}>
              {filtered.length} {tr ? "sonuç" : "results"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const renderOptions = () => (
    <>
      {allCurricula.map((d) => (
        <option key={`program_${d.prog_id}`} value={`program_${d.prog_id}`}>
          {safeText(d.label)}
        </option>
      ))}
    </>
  );

  const selectValue = selectedDept ? `program_${selectedDept.prog_id}` : "";

  const handleSelectChange = (e) => {
    const progId = parseInt(e.target.value.replace("program_", ""), 10);
    const nextDept = allCurricula.find((d) => d.prog_id === progId);

    if (nextDept) {
      setSelectedDept(nextDept);
      setSelectedYil(null);
      setSelectedYariyil(null);
      setViewFilter("all");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 580,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f0ece8",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>
            {tr ? "Müfredattan Program Oluştur" : "Build from Curriculum"}
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.1rem",
              cursor: "pointer",
              color: "#888",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#888",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {tr ? "Bölüm" : "Department"}
            </div>

            <SearchableDeptSelect
              allCurricula={allCurricula}
              selectedDept={selectedDept}
              tr={tr}
              onSelect={(nextDept) => {
                setSelectedDept(nextDept);
                setSelectedYil(null);
                setSelectedYariyil(null);
                setViewFilter("all");
              }}
            />
          </div>

          {loading && (
            <div style={{ color: "#888", fontSize: "0.85rem", padding: "10px 0" }}>
              {tr ? "Yükleniyor..." : "Loading..."}
            </div>
          )}

          {error && (
            <div style={{ color: "#c0392b", fontSize: "0.85rem" }}>
              {safeText(error)}
            </div>
          )}

          {mufredat.length > 0 && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#888",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <span>{tr ? "Yıl" : "Year"}</span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {mufredat.map((y) => (
                    <button
                      key={y.yil}
                      onClick={() => {
                        setSelectedYil(selectedYil === y.yil ? null : y.yil);
                        setSelectedYariyil(null);
                      }}
                      style={{
                        padding: "6px 13px",
                        borderRadius: 8,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        fontWeight: 600,
                        transition: "all .15s",
                        border:
                          selectedYil === y.yil
                            ? "2px solid #7a1f2b"
                            : "2px solid #e5e0da",
                        background: selectedYil === y.yil ? "#7a1f2b" : "#fff",
                        color: selectedYil === y.yil ? "#fff" : "#333",
                      }}
                    >
                      {safeText(y.yil_adi || `${y.yil}. Yıl`)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedYil && yilData && (
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#888",
                      marginBottom: 6,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {tr ? "Dönem" : "Semester"}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    <button
                      onClick={() => setSelectedYariyil(null)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontWeight: 600,
                        border:
                          selectedYariyil === null
                            ? "2px solid #7a1f2b"
                            : "2px solid #e5e0da",
                        background: selectedYariyil === null ? "#7a1f2b" : "#fff",
                        color: selectedYariyil === null ? "#fff" : "#333",
                      }}
                    >
                      {tr ? "Tümü" : "All"}
                    </button>

                    {yilData.yariyillar.map((yy) => (
                      <button
                        key={yy.yariyil}
                        onClick={() =>
                          setSelectedYariyil(
                            selectedYariyil === yy.yariyil ? null : yy.yariyil
                          )
                        }
                        title={
                          yy.global_yariyil_adi
                            ? `Genel dönem: ${safeText(yy.global_yariyil_adi, "")}`
                            : ""
                        }
                        style={{
                          padding: "5px 12px",
                          borderRadius: 8,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          fontWeight: 600,
                          border:
                            selectedYariyil === yy.yariyil
                              ? "2px solid #7a1f2b"
                              : "2px solid #e5e0da",
                          background:
                            selectedYariyil === yy.yariyil ? "#7a1f2b" : "#fff",
                          color: selectedYariyil === yy.yariyil ? "#fff" : "#333",
                        }}
                      >
                        {safeText(yy.yariyil_adi || `${yy.yariyil}. Dönem`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedYil && yilData && (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#888",
                        marginBottom: 7,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{tr ? "Dersler" : "Courses"}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 400, fontSize: "0.73rem", color: "#aaa" }}>
                          {matchedYilDersleri.length}/{yilDersleri.length}{" "}
                          {tr ? "katalogda" : "in catalog"}
                        </span>
                        {matchedYilDersleri.length > 0 && (
                          <button
                            onClick={toggleSelectAll}
                            style={{
                              fontSize: "0.72rem",
                              padding: "3px 10px",
                              borderRadius: 6,
                              border: "1.5px solid #e5e0da",
                              background: "#fff",
                              color: "#555",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {selectedDersleri.length === matchedYilDersleri.length
                              ? (tr ? "Tümünü kaldır" : "Deselect all")
                              : (tr ? "Tümünü seç" : "Select all")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Seçili ders sayısı */}
                    {matchedYilDersleri.length > 0 && (
                      <div style={{ marginBottom: 8, fontSize: "0.74rem", color: "#7a1f2b", fontWeight: 600 }}>
                        {selectedDersleri.length} {tr ? "ders seçili" : "selected"}
                        {selectedDersleri.length !== matchedYilDersleri.length && (
                          <span style={{ color: "#aaa", fontWeight: 400, marginLeft: 4 }}>
                            ({tr ? "toplam" : "of"} {matchedYilDersleri.length})
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        border: "1px solid #f0ece8",
                        borderRadius: 10,
                        overflow: "hidden",
                        maxHeight: 340,
                        overflowY: "auto",
                      }}
                    >
                      {yilData.yariyillar
                        .filter(
                          (yariyil) =>
                            selectedYariyil == null || yariyil.yariyil === selectedYariyil
                        )
                        .map((yariyil) => (
                          <div key={yariyil.yariyil}>
                            <div
                              style={{
                                padding: "5px 12px",
                                background: "#f5f0ec",
                                fontSize: "0.71rem",
                                fontWeight: 700,
                                color: "#7a1f2b",
                                letterSpacing: "0.04em",
                                borderBottom: "1px solid #ede8e3",
                              }}
                            >
                              {safeText(yariyil.yariyil_adi)}
                            </div>

                            {(yariyil.dersler || []).map((d, di) => {
                              const isLast = di === yariyil.dersler.length - 1;

                              if (d.tur || d.aciklama) {
                                return (
                                  <SlotRow
                                    key={di}
                                    slot={d}
                                    isLast={isLast}
                                  />
                                );
                              }

                              return (
                                <CourseRow
                                  key={di}
                                  ders={d}
                                  catalogEntry={findInCatalog(d, courses)}
                                  isLast={isLast}
                                  tr={tr}
                                  selected={selectedCodes}
                                  onSelect={toggleSelected}
                                />
                              );
                            })}
                          </div>
                        ))}
                    </div>

                    <div style={{ fontSize: "0.71rem", color: "#aaa", marginTop: 6 }}>
                      {tr
                        ? "☑ = planlayıcıya ekle · ● yeşil = katalogda var"
                        : "☑ = add to scheduler · ● green = in catalog"}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid #f0ece8",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
            background: "#fff",
          }}
        >
          {/* Akıllı Planla — tam genişlik, üstte */}
          {selectedYil && (
            <button
              onClick={() => { if (selectedDersleri.length) setSmartPlanOpen(true); }}
              disabled={!selectedDersleri.length}
              style={{
                width: "100%",
                padding: "9px 16px",
                borderRadius: 8,
                border: selectedDersleri.length ? "2px solid #7a1f2b" : "2px solid #e5e0da",
                background: "#fff",
                color: selectedDersleri.length ? "#7a1f2b" : "#aaa",
                fontSize: "0.85rem",
                cursor: selectedDersleri.length ? "pointer" : "not-allowed",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {tr ? "Akıllı Planlama" : "Smart Schedule"}
            </button>
          )}

          {/* Alt satır: İptal + Planlayıcıya Yükle */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "1px solid #e5e0da",
                background: "#fff",
                color: "#555",
                fontSize: "0.85rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {tr ? "İptal" : "Cancel"}
            </button>

            <button
              onClick={handleApply}
              disabled={!selectedDersleri.length}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                border: "none",
                background: selectedDersleri.length ? "#7a1f2b" : "#e5e0da",
                color: selectedDersleri.length ? "#fff" : "#aaa",
                fontSize: "0.85rem",
                cursor: selectedDersleri.length ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              {selectedYil
                ? tr
                  ? `${selectedDersleri.length} dersi Planlayıcıya Yükle`
                  : `Load ${selectedDersleri.length} courses to Scheduler`
                : tr
                ? "Yıl seç"
                : "Select a year"}
            </button>
          </div>
        </div>
      </div>

      {smartPlanOpen && selectedDersleri.length > 0 && (
        <div
          onClick={() => setSmartPlanOpen(false)}
          style={{ position:"fixed", inset:0, zIndex:1050, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:540, height:"92vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,0.18)" }}
          >
            <SmartPlanWizard
              dersler={selectedDersleri}
              courses={courses}
              tr={tr}
              onApply={(suggestions) => {
                // suggestions: [{code, sectionId}]
                // onApplyToScheduler sadece code set kabul ediyor,
                // ama App.jsx'e direkt section seçimini iletmek için
                // onApplyWithSections prop'u kullanıyoruz
                if (onApplyWithSections) {
                  onApplyWithSections(suggestions);
                } else {
                  onApplyToScheduler(new Set(suggestions.map(s => s.code)));
                }
                setSmartPlanOpen(false);
                onClose();
              }}
              onClose={() => setSmartPlanOpen(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
}