// utils.js — shared constants & helpers

export const TIME_SLOTS = [
  "08:40",
  "09:40",
  "10:40",
  "11:40",
  "12:40",
  "13:40",
  "14:40",
  "15:40",
  "16:40",
  "17:40",
];

// Takvimin toplam saat sayısı (08:40 → 18:40 = 10 slot)
const TOTAL_SLOTS = TIME_SLOTS.length;

// Viewport yüksekliğine göre slot yüksekliği hesapla
// Header ~72px, padding ~40px → kalan alanı 9'a böl
// Min 60px, max 90px arasında sınırla
function calcSlotHeight() {
  if (typeof window === "undefined") return 82;
  const available = window.innerHeight - 72 - 40 - 48; // header + padding + dayhead
  const h = Math.floor(available / TOTAL_SLOTS);
  return Math.min(100, Math.max(70, h));
}

export let SLOT_HEIGHT = calcSlotHeight();

// Pencere boyutu değişince güncelle
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    SLOT_HEIGHT = calcSlotHeight();
  });
}

export const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const meetingPos = (meeting) => {
  const start = toMin(meeting.s);
  const end = toMin(meeting.e);
  const dayStart = toMin("08:40");

  const top = ((start - dayStart) / 60) * SLOT_HEIGHT;
  const height = ((end - start) / 60) * SLOT_HEIGHT;

  return { top, height };
};

export const DEPT_COLORS = {
  CENG: { bg: "#7a1f2b", fg: "#fff", soft: "#fce4e8" },
  EE: { bg: "#1e6091", fg: "#fff", soft: "#dbeafe" },
  IE: { bg: "#2d8659", fg: "#fff", soft: "#d4f1de" },
  MATH: { bg: "#b8541f", fg: "#fff", soft: "#fde4d0" },
  PHYS: { bg: "#5b3a8a", fg: "#fff", soft: "#e8dcf5" },
  ENG: { bg: "#1a1a1a", fg: "#fff", soft: "#e8e8e8" },
  HIST: { bg: "#7a5c1f", fg: "#fff", soft: "#f5ead0" },
  TURK: { bg: "#a02850", fg: "#fff", soft: "#fbdce8" },
};

const FALLBACK_COLORS = [
  { bg: "#7a1f2b", fg: "#fff", soft: "#f8e8eb" },
  { bg: "#1e6091", fg: "#fff", soft: "#dbeafe" },
  { bg: "#2d8659", fg: "#fff", soft: "#d4f1de" },
  { bg: "#b8541f", fg: "#fff", soft: "#fde4d0" },
  { bg: "#5b3a8a", fg: "#fff", soft: "#e8dcf5" },
  { bg: "#a02850", fg: "#fff", soft: "#fbdce8" },
  { bg: "#0f766e", fg: "#fff", soft: "#ccfbf1" },
  { bg: "#9333ea", fg: "#fff", soft: "#f3e8ff" },
  { bg: "#ca8a04", fg: "#fff", soft: "#fef3c7" },
  { bg: "#dc2626", fg: "#fff", soft: "#fee2e2" },
  { bg: "#2563eb", fg: "#fff", soft: "#dbeafe" },
  { bg: "#db2777", fg: "#fff", soft: "#fce7f3" },
  { bg: "#16a34a", fg: "#fff", soft: "#dcfce7" },
  { bg: "#ea580c", fg: "#fff", soft: "#ffedd5" },
];

function hashText(value) {
  const text = String(value || "GEN");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export const colorFor = (deptOrKey) => {
  if (DEPT_COLORS[deptOrKey]) return DEPT_COLORS[deptOrKey];
  const index = hashText(deptOrKey) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index];
};

const meetingsOverlap = (a, b) => {
  if (a.d !== b.d) return false;
  return toMin(a.s) < toMin(b.e) && toMin(b.s) < toMin(a.e);
};

export const sectionsConflict = (sA, sB) => {
  for (const m1 of sA.meetings) {
    for (const m2 of sB.meetings) {
      if (meetingsOverlap(m1, m2)) return { m1, m2 };
    }
  }
  return null;
};

export const findConflicts = (selected, courses) => {
  const conflicts = {};
  const list = selected.map((sel) => {
    const course = courses.find((c) => c.code === sel.code);
    const section = course?.sections.find((s) => s.id === sel.sectionId);
    return { sel, course, section };
  });

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!a.section || !b.section) continue;
      if (sectionsConflict(a.section, b.section)) {
        const ka = `${a.sel.code}-${a.sel.sectionId}`;
        const kb = `${b.sel.code}-${b.sel.sectionId}`;
        conflicts[ka] = kb;
        conflicts[kb] = ka;
      }
    }
  }
  return conflicts;
};