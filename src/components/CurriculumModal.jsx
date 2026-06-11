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

const VIEW_FILTERS = [
  { key: "all", tr: "Tümü", en: "All" },
  { key: "done", tr: "Alınanlar", en: "Completed" },
  { key: "todo", tr: "Kalanlar", en: "Remaining" },
];

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

function storageKey(id) {
  return `metu_done_${String(id).replace(/\W/g, "_")}`;
}

function loadDone(id) {
  try {
    const r = localStorage.getItem(storageKey(id));
    return r ? new Set(JSON.parse(r)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDone(id, set) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify([...set]));
  } catch {}
}

function CourseRow({ ders, catalogEntry, isLast, tr, done, onToggle, viewFilter }) {
  const [open, setOpen] = useState(false);

  const sections = catalogEntry?.sections || [];
  const hasSections = sections.length > 0;
  const url = catalogUrl(ders) || catalogEntry?.catalogUrl || null;
  const isDone = done.has(normCode(ders.kod));

  if (viewFilter === "done" && !isDone) return null;
  if (viewFilter === "todo" && isDone) return null;

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid #f5f0ec" }}>
      <div
        onClick={(e) => {
          if (e.target.dataset.toggle) return;
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
          background: isDone
            ? "#f0fdf4"
            : open
            ? "#fdf8f5"
            : catalogEntry
            ? "#fff"
            : "#fafafa",
          opacity: catalogEntry ? 1 : 0.55,
          cursor: catalogEntry ? "pointer" : "default",
          transition: "background .12s",
        }}
      >
        <button
          data-toggle="1"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(normCode(ders.kod));
          }}
          title={
            isDone
              ? tr
                ? "Alındı — kaldır"
                : "Marked done — undo"
              : tr
              ? "Alındı işaretle"
              : "Mark as done"
          }
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            flexShrink: 0,
            border: isDone ? "none" : "2px solid #d1d5db",
            background: isDone ? "#22c55e" : "transparent",
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
          {isDone ? "✓" : ""}
        </button>

        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            flexShrink: 0,
            background: catalogEntry ? "#22c55e" : "#d1d5db",
          }}
        />

        <span
          style={{
            fontSize: "0.77rem",
            fontWeight: 700,
            color: isDone ? "#15803d" : "#7a1f2b",
            minWidth: 68,
            flexShrink: 0,
            textDecoration: isDone ? "line-through" : "none",
            opacity: isDone ? 0.7 : 1,
          }}
        >
          {safeText(ders.kod, "")}
        </span>

        <span
          style={{
            fontSize: "0.77rem",
            color: isDone ? "#888" : "#333",
            flex: 1,
            lineHeight: 1.4,
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {safeText(ders.ad)}
        </span>

        {(ders.odtu_kredi != null || ders.ects || ders.akts) && (
          <span style={{ fontSize: "0.72rem", color: "#aaa", flexShrink: 0, marginRight: 4 }}>
            {ders.odtu_kredi != null
              ? `${safeText(ders.odtu_kredi, "")}k`
              : `${safeText(ders.ects ?? ders.akts, "")} ECTS`}
          </span>
        )}

        {catalogEntry && !isDone ? (
          hasSections ? (
            <span
              style={{
                fontSize: "0.7rem",
                color: "#aaa",
                flexShrink: 0,
                display: "inline-block",
                transition: "transform .15s",
                transform: open ? "rotate(180deg)" : "none",
              }}
            >
              ▼
            </span>
          ) : url ? (
            <span style={{ fontSize: "0.7rem", color: "#aaa", flexShrink: 0 }}>↗</span>
          ) : null
        ) : null}
      </div>

      {open && hasSections && (
        <div
          style={{
            background: "#fdf8f5",
            borderTop: "1px solid #f0ece8",
            padding: "8px 12px 10px 40px",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "#7a5c1f",
              marginBottom: 6,
            }}
          >
            {tr ? `${sections.length} şube:` : `${sections.length} section(s):`}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {sections.map((sec, i) => {
              const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum"];
              const schedule = (sec.meetings || [])
                .map((m) => `${dayNames[m.d] ?? m.d} ${m.s}–${m.e}`)
                .join(", ");

              return (
                <div
                  key={i}
                  style={{
                    fontSize: "0.73rem",
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: "#fff",
                    border: "1px solid #e5e0da",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#7a1f2b" }}>§{safeText(sec.id, "")}</span>
                  <span style={{ color: "#555" }}>{safeText(sec.instructor)}</span>
                  <span style={{ color: "#374151", flex: 1 }}>
                    {schedule || (tr ? "Zaman yok" : "No schedule")}
                  </span>
                  {sec.crn && (
                    <span style={{ fontSize: "0.69rem", color: "#888" }}>
                      CRN: {safeText(sec.crn, "")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: "0.71rem",
                color: "#7a1f2b",
                marginTop: 6,
                display: "inline-block",
              }}
            >
              ↗ {tr ? "Katalog sayfasını aç" : "Open catalog page"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function SlotRow({ slot, isLast, viewFilter }) {
  if (viewFilter === "done") return null;

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
          width: 7,
          height: 7,
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

  const [viewFilter, setViewFilter] = useState("all");
  const [confirmClear, setConfirmClear] = useState(null);

  const doneKey = selectedDept ? `program_${selectedDept.prog_id}` : "program_none";
  const [done, setDone] = useState(() => loadDone(doneKey));

  useEffect(() => {
    setDone(loadDone(doneKey));
  }, [doneKey]);

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

  const toggleDone = useCallback(
    (kod) => {
      setDone((prev) => {
        const next = new Set(prev);

        if (next.has(kod)) {
          next.delete(kod);
        } else {
          next.add(kod);
        }

        saveDone(doneKey, next);

        return next;
      });
    },
    [doneKey]
  );

  const mufredat = curriculum?.mufredat || [];

  const allDersCodes = useMemo(() => {
    const codes = [];

    mufredat.forEach((yil) =>
      yil.yariyillar?.forEach((y) =>
        y.dersler?.forEach((d) => {
          if (d.kod) {
            codes.push(normCode(d.kod));
          }
        })
      )
    );

    return codes;
  }, [mufredat]);

  const yilStats = useMemo(
    () =>
      mufredat.map((yil) => {
        const codes = [];

        yil.yariyillar?.forEach((y) =>
          y.dersler?.forEach((d) => {
            if (d.kod) {
              codes.push(normCode(d.kod));
            }
          })
        );

        return {
          yil: yil.yil,
          yil_adi: yil.yil_adi,
          total: codes.length,
          done: codes.filter((c) => done.has(c)).length,
        };
      }),
    [mufredat, done]
  );

  const totalDone = done.size;
  const totalCodes = allDersCodes.length;
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
    let list = yilDersleri.filter((d) => findInCatalog(d, courses));

    if (viewFilter === "todo") {
      list = list.filter((d) => !done.has(normCode(d.kod)));
    }

    if (viewFilter === "done") {
      list = list.filter((d) => done.has(normCode(d.kod)));
    }

    return list;
  }, [yilDersleri, courses, viewFilter, done]);

  const handleApply = () => {
    if (!matchedYilDersleri.length) return;

    onApplyToScheduler(
      new Set(
        matchedYilDersleri.map((d) =>
          d.catalog_kodu ? String(d.catalog_kodu) : normCode(d.kod)
        )
      )
    );

    onClose();
  };

  const clearDone = () => {
    const empty = new Set();

    setDone(empty);
    saveDone(doneKey, empty);
    setConfirmClear(null);
  };

  
// ─────────────────────────────────────────────────────────
// SearchableDeptSelect — arama yapılabilir bölüm seçici
// ─────────────────────────────────────────────────────────
function SearchableDeptSelect({ allCurricula, selectedDept, onSelect, tr }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  // Açılınca input'a odaklan
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
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

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0, right: 0,
          background: "#fff",
          border: "2px solid #7a1f2b",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
          zIndex: 2000,
          display: "flex",
          flexDirection: "column",
          maxHeight: 320,
          overflow: "hidden",
        }}>
          {/* Arama kutusu */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #f0ece8" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"#aaa" }}
                width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr ? "Bölüm ara..." : "Search department..."}
                style={{
                  width: "100%",
                  padding: "6px 8px 6px 28px",
                  border: "1.5px solid #e5e0da",
                  borderRadius: 6,
                  fontSize: "0.82rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {query && (
                <button onClick={() => setQuery("")}
                  style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#aaa", fontSize:14, lineHeight:1, padding:"0 2px" }}>
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: "0.82rem", color: "#aaa", textAlign: "center" }}>
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
                    padding: "8px 14px",
                    textAlign: "left",
                    border: "none",
                    background: isSelected ? "#fdf0f2" : "transparent",
                    color: isSelected ? "#7a1f2b" : "#333",
                    fontSize: "0.82rem",
                    fontWeight: isSelected ? 700 : 400,
                    cursor: "pointer",
                    borderBottom: "1px solid #f9f5f3",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
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
          {query && (
            <div style={{ padding: "5px 12px", borderTop: "1px solid #f0ece8", fontSize: "0.7rem", color: "#bbb" }}>
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
              <div
                style={{
                  background: "linear-gradient(135deg, #7a1f2b 0%, #a33040 100%)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 14,
                  color: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.68rem",
                      opacity: 0.75,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {tr ? "GENEL İLERLEME" : "OVERALL PROGRESS"}
                  </span>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>{totalDone}</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.7 }}>
                      /{totalCodes}
                    </span>
                    <span
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 900,
                        opacity: 0.3,
                        marginLeft: 6,
                      }}
                    >
                      {totalCodes ? Math.round((totalDone / totalCodes) * 100) : 0}%
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    height: 5,
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.2)",
                    overflow: "hidden",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 99,
                      background: "rgba(255,255,255,0.9)",
                      width: totalCodes ? `${(totalDone / totalCodes) * 100}%` : "0%",
                      transition: "width .5s cubic-bezier(.4,0,.2,1)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {yilStats.map((ys) => (
                    <div key={ys.yil} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.65rem", opacity: 0.8, minWidth: 72 }}>
                        {safeText(ys.yil_adi || `${ys.yil}. Yıl`)}
                      </span>

                      <div
                        style={{
                          flex: 1,
                          height: 3,
                          borderRadius: 99,
                          background: "rgba(255,255,255,0.2)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 99,
                            background:
                              ys.done === ys.total && ys.total > 0
                                ? "#86efac"
                                : "rgba(255,255,255,0.7)",
                            width: ys.total ? `${(ys.done / ys.total) * 100}%` : "0%",
                            transition: "width .5s",
                          }}
                        />
                      </div>

                      <span
                        style={{
                          fontSize: "0.63rem",
                          opacity: 0.75,
                          minWidth: 30,
                          textAlign: "right",
                        }}
                      >
                        {ys.done}/{ys.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

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
                  <div
                    style={{
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #e5e0da",
                      }}
                    >
                      {VIEW_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setViewFilter(f.key)}
                          style={{
                            padding: "5px 12px",
                            fontSize: "0.77rem",
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                            background: viewFilter === f.key ? "#7a1f2b" : "#fff",
                            color: viewFilter === f.key ? "#fff" : "#555",
                            borderRight: f.key !== "todo" ? "1px solid #e5e0da" : "none",
                          }}
                        >
                          {tr ? f.tr : f.en}
                        </button>
                      ))}
                    </div>

                    {done.size > 0 && (
                      <button
                        onClick={() => setConfirmClear("year")}
                        style={{
                          fontSize: "0.75rem",
                          padding: "5px 12px",
                          borderRadius: 8,
                          border: "1px solid #fca5a5",
                          background: "#fff5f5",
                          color: "#dc2626",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {tr ? "Temizle" : "Clear all"}
                      </button>
                    )}
                  </div>

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
                      <span style={{ fontWeight: 400, fontSize: "0.73rem" }}>
                        {matchedYilDersleri.length}/{yilDersleri.length}{" "}
                        {tr ? "katalogda" : "in catalog"}
                      </span>
                    </div>

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
                                    viewFilter={viewFilter}
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
                                  done={done}
                                  onToggle={toggleDone}
                                  viewFilter={viewFilter}
                                />
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
                </>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #f0ece8",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
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
            disabled={!matchedYilDersleri.length}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: matchedYilDersleri.length ? "#7a1f2b" : "#e5e0da",
              color: matchedYilDersleri.length ? "#fff" : "#aaa",
              fontSize: "0.85rem",
              cursor: matchedYilDersleri.length ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            {selectedYil
              ? tr
                ? `${matchedYilDersleri.length} dersi Planlayıcıya Yükle`
                : `Load ${matchedYilDersleri.length} courses to Scheduler`
              : tr
              ? "Yıl seç"
              : "Select a year"}
          </button>
        </div>
      </div>

      {confirmClear && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setConfirmClear(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "28px 32px",
              maxWidth: 340,
              width: "100%",
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: "0.95rem",
                color: "#222",
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              {tr
                ? "Tamamlanan ders işaretlemeleri sıfırlanacak. Emin misin?"
                : "All progress marks will be cleared. Are you sure?"}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmClear(null)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#f5f5f5",
                  color: "#444",
                  cursor: "pointer",
                  fontSize: "0.88rem",
                }}
              >
                {tr ? "Vazgeç" : "Cancel"}
              </button>

              <button
                onClick={clearDone}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                }}
              >
                {tr ? "Evet, sıfırla" : "Yes, clear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}