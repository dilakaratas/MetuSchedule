"""
ODTÜ Tüm Bölümler Müfredat Scraper
Kaynak: catalog.metu.edu.tr (standart, tüm bölümler aynı HTML yapısı)

Kurulum:
    pip install requests beautifulsoup4

Çalıştırma:
    python metu_catalog_scraper.py

Çıktı:
    mufredat_output/<KOD>_mufredat.json   — her bölüm için
    mufredat_output/ozet.json             — özet tablo
    mufredat_output/tum_bolumler.json     — hepsi tek dosyada
"""

import json
import re
import time
import os
import requests
from bs4 import BeautifulSoup

BASE = "https://catalog.metu.edu.tr"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
    "Referer": "https://catalog.metu.edu.tr/",
    "Connection": "keep-alive",
})

# ── Tüm lisans bölümleri: kod + Türkçe ad + catalog fac_prog ID'si ────────────
# fac_prog ID'leri: catalog.metu.edu.tr/fac_inst.php?fac_inst=<X>
#   Mimarlık=100, Fen-Ed=200, İİBF=300, Eğitim=400, Mühendislik=500
DEPARTMENTS = [
    # ── Mimarlık Fakültesi ──────────────────────────────────────────────────
    {"kod": "ARCH", "ad": "Mimarlık",                               "fac_prog": 112},
    {"kod": "CRP",  "ad": "Şehir ve Bölge Planlama",                "fac_prog": 113},
    {"kod": "ID",   "ad": "Endüstriyel Tasarım",                    "fac_prog": 125},
    # ── Fen Edebiyat Fakültesi ─────────────────────────────────────────────
    {"kod": "BIO",  "ad": "Biyolojik Bilimler",                     "fac_prog": 211},
    {"kod": "CHEM", "ad": "Kimya",                                  "fac_prog": 213},
    {"kod": "HIST", "ad": "Tarih",                                  "fac_prog": 218},
    {"kod": "MATH", "ad": "Matematik",                              "fac_prog": 219},
    {"kod": "PHIL", "ad": "Felsefe",                                "fac_prog": 221},
    {"kod": "PHYS", "ad": "Fizik",                                  "fac_prog": 222},
    {"kod": "PSY",  "ad": "Psikoloji",                              "fac_prog": 223},
    {"kod": "SOC",  "ad": "Sosyoloji",                              "fac_prog": 224},
    {"kod": "STAT", "ad": "İstatistik",                             "fac_prog": 225},
    # ── İktisadi ve İdari Bilimler Fakültesi ───────────────────────────────
    {"kod": "BA",   "ad": "İşletme",                                "fac_prog": 312},
    {"kod": "ECON", "ad": "İktisat",                                "fac_prog": 311},
    {"kod": "IR",   "ad": "Uluslararası İlişkiler",                 "fac_prog": 313},
    {"kod": "PADM", "ad": "Siyaset Bilimi ve Kamu Yönetimi",        "fac_prog": 314},
    # ── Eğitim Fakültesi ───────────────────────────────────────────────────
    {"kod": "CEIT", "ad": "Bilgisayar ve Öğretim Teknolojileri",    "fac_prog": 415},
    {"kod": "EDS",  "ad": "Eğitim Bilimleri",                       "fac_prog": 414},
    {"kod": "EECE", "ad": "Temel Eğitim",                           "fac_prog": 411},
    {"kod": "FLE",  "ad": "Yabancı Diller Eğitimi",                 "fac_prog": 413},
    {"kod": "PES",  "ad": "Beden Eğitimi ve Spor",                  "fac_prog": 416},
    {"kod": "MSE",  "ad": "Matematik ve Fen Bilimleri Eğitimi",     "fac_prog": 412},
    # ── Mühendislik Fakültesi ──────────────────────────────────────────────
    {"kod": "AEE",  "ad": "Havacılık ve Uzay Mühendisliği",         "fac_prog": 572},
    {"kod": "CHE",  "ad": "Kimya Mühendisliği",                     "fac_prog": 563},
    {"kod": "CE",   "ad": "İnşaat Mühendisliği",                    "fac_prog": 562},
    {"kod": "CENG", "ad": "Bilgisayar Mühendisliği",                "fac_prog": 571},
    {"kod": "EEE",  "ad": "Elektrik ve Elektronik Mühendisliği",    "fac_prog": 567},
    {"kod": "ES",   "ad": "Mühendislik Bilimleri",                  "fac_prog": 561},
    {"kod": "ENVE", "ad": "Çevre Mühendisliği",                     "fac_prog": 560},
    {"kod": "FDE",  "ad": "Gıda Mühendisliği",                      "fac_prog": 573},
    {"kod": "GEOE", "ad": "Jeoloji Mühendisliği",                   "fac_prog": 564},
    {"kod": "IE",   "ad": "Endüstri Mühendisliği",                  "fac_prog": 568},
    {"kod": "ME",   "ad": "Makina Mühendisliği",                    "fac_prog": 569},
    {"kod": "METE", "ad": "Metalurji ve Malzeme Mühendisliği",      "fac_prog": 570},
    {"kod": "MINE", "ad": "Maden Mühendisliği",                     "fac_prog": 565},
    {"kod": "PETE", "ad": "Petrol ve Doğal Gaz Mühendisliği",       "fac_prog": 566},
]


# ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────────

def fetch(url, retries=3):
    for attempt in range(retries):
        try:
            r = SESSION.get(url, timeout=20)
            r.raise_for_status()
            return BeautifulSoup(r.text, "html.parser")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
            else:
                print(f"  ⚠  fetch({url}): {e}")
                return None


def to_int(s):
    try:
        return int(str(s).strip())
    except Exception:
        return 0


def to_float(s):
    try:
        return float(str(s).strip().replace(",", "."))
    except Exception:
        return 0.0


def extract_catalog_code(href):
    """course.php?...&course_code=XXXXXX  →  'XXXXXX'"""
    if not href:
        return None
    m = re.search(r"course_code=(\d+)", href)
    return m.group(1) if m else None


# ── Ders tablosu ayrıştırıcı ──────────────────────────────────────────────────

SECMELI_TURLER_EN = {
    "TECHNICAL ELECTIVE", "NON-TECHNICAL ELECTIVE",
    "RESTRICTED ELECTIVE", "FREE ELECTIVE", "COMPLEMENTARY ELECTIVE",
    "UNIVERSITY ELECTIVE",
}
SECMELI_TURLER_TR = {
    "TEKNİK SEÇMELİ", "TEKNİK OLMAYAN SEÇMELİ",
    "KISITLI SEÇMELİ", "KISITLI SEÇMELİ*",
    "SERBEST SEÇMELİ", "TAMAMLAYICI SEÇMELİ",
}
ALL_SECMELI = SECMELI_TURLER_EN | SECMELI_TURLER_TR


def _is_elective_slot(text):
    return text.upper().rstrip("*").strip() in ALL_SECMELI


def _is_choice_group(text):
    t = text.lower()
    return (
        ("any" in t and "following" in t)
        or ("herhangi" in t)
        or ("aşağıdaki" in t)
        or ("following set" in t)
    )


def parse_course_table(table):
    rows = [r for r in table.find_all("tr") if r.find("td")]
    dersler = []
    i = 0

    while i < len(rows):
        cells = rows[i].find_all("td")
        if not cells:
            i += 1
            continue

        kod_text = cells[0].get_text(strip=True)
        ad_text  = cells[1].get_text(strip=True) if len(cells) > 1 else ""

        # Seçmeli grup (Any N of the following...)
        if _is_choice_group(ad_text) or _is_choice_group(kod_text):
            grup_baslik = (ad_text or kod_text).strip().rstrip(".")
            secenekler = []
            i += 1
            while i < len(rows):
                sc = rows[i].find_all("td")
                if not sc:
                    i += 1
                    continue
                sk = sc[0].get_text(strip=True)
                sa = sc[1].get_text(strip=True) if len(sc) > 1 else ""
                if _is_choice_group(sa) or _is_choice_group(sk):
                    break
                if _is_elective_slot(sa) or _is_elective_slot(sk):
                    break
                if not sk and not sa:
                    i += 1
                    continue
                a_tag = sc[0].find("a")
                cat = extract_catalog_code(a_tag.get("href", "")) if a_tag else None
                sey = {"kod": sk, "ad": sa}
                if cat:
                    sey["catalog_kodu"] = cat
                if len(sc) >= 5:
                    sey["metu_kredi"] = to_int(sc[2].get_text())
                    sey["ders_saat"]  = to_int(sc[3].get_text())
                    sey["lab_saat"]   = to_int(sc[4].get_text())
                if len(sc) >= 6:
                    sey["ects"] = to_float(sc[5].get_text())
                if sk or sa:
                    secenekler.append(sey)
                i += 1
            if secenekler:
                dersler.append({"secmeli_grup": grup_baslik, "secenekler": secenekler})
            continue

        # Seçmeli slot (TECHNICAL ELECTIVE vb.)
        if _is_elective_slot(ad_text) or _is_elective_slot(kod_text):
            tur = (ad_text if _is_elective_slot(ad_text) else kod_text).rstrip("*").strip()
            dersler.append({"tur": tur})
            i += 1
            continue

        # Normal ders
        if kod_text and ad_text and len(cells) >= 5:
            a_tag = cells[0].find("a")
            cat = extract_catalog_code(a_tag.get("href", "")) if a_tag else None
            ders = {
                "kod":        kod_text,
                "ad":         ad_text,
                "metu_kredi": to_int(cells[2].get_text()) if len(cells) > 2 else 0,
                "ders_saat":  to_int(cells[3].get_text()) if len(cells) > 3 else 0,
                "lab_saat":   to_int(cells[4].get_text()) if len(cells) > 4 else 0,
                "ects":       to_float(cells[5].get_text()) if len(cells) > 5 else 0.0,
            }
            if cat:
                ders["catalog_kodu"] = cat
            dersler.append(ders)

        i += 1

    return dersler


# ── Yıl / yarıyıl başlık çözümleyici ─────────────────────────────────────────

YEAR_NUM_MAP = {
    "FIRST": 1, "SECOND": 2, "THIRD": 3, "FOURTH": 4, "FIFTH": 5,
    "1ST": 1, "2ND": 2, "3RD": 3, "4TH": 4, "4TH": 4,
    "BİRİNCİ": 1, "İKİNCİ": 2, "ÜÇÜNCÜ": 3, "DÖRDÜNCÜ": 4, "BEŞİNCİ": 5,
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
}

SEM_NUM_MAP = {
    "FIRST": 1, "SECOND": 2, "THIRD": 3, "FOURTH": 4,
    "FIFTH": 5, "SIXTH": 6, "SEVENTH": 7, "EIGHTH": 8,
    "FALL": 1, "SPRING": 2,
    "GÜZ": 1, "BAHAR": 2,
    "BİRİNCİ": 1, "İKİNCİ": 2, "ÜÇÜNCÜ": 3, "DÖRDÜNCÜ": 4,
    "BEŞİNCİ": 5, "ALTINCI": 6, "YEDİNCİ": 7, "SEKİZİNCİ": 8,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
}

YEAR_RE = re.compile(
    r"\b(FIRST|SECOND|THIRD|FOURTH|FIFTH|1ST|2ND|3RD|4TH|"
    r"BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ)\s+YEAR\b"
    r"|\bYEAR\s+([1-5])\b"
    r"|\bYIL\b",
    re.IGNORECASE,
)

SEM_RE = re.compile(
    r"\b(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH)\s+SEMESTER\b"
    r"|\bSEMESTER\s+([1-8])\b"
    r"|\b(FALL|SPRING)\s+SEMESTER\b"
    r"|\b(GÜZ|BAHAR)\s+YARIYILI?\b"
    r"|\b(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDİNCİ|SEKİZİNCİ)\s+(YARIYIL|DÖNEM|SEMESTER)\b",
    re.IGNORECASE,
)


def detect_year(text):
    t = text.upper().strip()
    if not YEAR_RE.search(t):
        return None
    # Rakam önce
    m = re.search(r"\bYEAR\s+([1-5])\b", t)
    if m:
        return int(m.group(1))
    # Kelime
    for word, num in YEAR_NUM_MAP.items():
        if re.search(r"\b" + word + r"\b", t):
            return num
    return None


def detect_semester(text):
    t = text.upper().strip()
    if not SEM_RE.search(t):
        return None
    m = re.search(r"\bSEMESTER\s+([1-8])\b", t)
    if m:
        return int(m.group(1))
    for word, num in SEM_NUM_MAP.items():
        if re.search(r"\b" + word + r"\b", t):
            return num
    return None


# ── Ana scraper ───────────────────────────────────────────────────────────────

def scrape_department(dept):
    prog_id = dept["fac_prog"]
    url = f"{BASE}/program.php?fac_prog={prog_id}"
    print(f"  URL: {url}")

    soup = fetch(url)
    if not soup:
        return None

    result = {
        "universite": "ODTÜ",
        "bolum":      dept["ad"],
        "kod":        dept["kod"],
        "fac_prog":   prog_id,
        "kaynak":     url,
        "mufredat":   [],
    }

    aktif_yil = None
    aktif_sem = None

    # Sayfa gövdesi (article veya body)
    content = soup.find("div", id=re.compile(r"main", re.I)) or soup.body
    if not content:
        content = soup

    for elem in content.descendants:
        if not hasattr(elem, "name") or not elem.name:
            continue

        # ── Başlık ve kalın metin elemanları ─────────────────────────────
        if elem.name in ("h1", "h2", "h3", "h4", "h5", "h6", "strong", "b"):
            # Tablo içindekileri atla
            if elem.find_parent("table"):
                continue
            text = elem.get_text(" ", strip=True)

            yn = detect_year(text)
            sn = detect_semester(text)

            if yn:
                if not any(y["yil"] == yn for y in result["mufredat"]):
                    result["mufredat"].append({
                        "yil": yn,
                        "yil_adi": text,
                        "yariyillar": [],
                    })
                aktif_yil = next(y for y in result["mufredat"] if y["yil"] == yn)
                aktif_sem = None
                continue

            if sn is not None:
                if aktif_yil is None:
                    # Yarıyıl numarasından yılı çıkar (1-2 → yıl 1, 3-4 → yıl 2...)
                    yn_inferred = (sn + 1) // 2
                    if not any(y["yil"] == yn_inferred for y in result["mufredat"]):
                        result["mufredat"].append({
                            "yil": yn_inferred,
                            "yil_adi": f"Year {yn_inferred}",
                            "yariyillar": [],
                        })
                    aktif_yil = next(y for y in result["mufredat"] if y["yil"] == yn_inferred)

                if not any(s["yariyil"] == sn for s in aktif_yil["yariyillar"]):
                    aktif_yil["yariyillar"].append({
                        "yariyil": sn,
                        "yariyil_adi": text,
                        "dersler": [],
                    })
                aktif_sem = next(s for s in aktif_yil["yariyillar"] if s["yariyil"] == sn)
                continue

        # ── Tablo ────────────────────────────────────────────────────────
        if elem.name == "table":
            if elem.find_parent("table"):
                continue  # iç içe tablo

            # Caption'dan yarıyıl/yıl al
            caption = elem.find("caption")
            if caption:
                cap = caption.get_text(" ", strip=True)
                yn = detect_year(cap)
                sn = detect_semester(cap)

                if yn:
                    if not any(y["yil"] == yn for y in result["mufredat"]):
                        result["mufredat"].append({
                            "yil": yn, "yil_adi": cap, "yariyillar": []
                        })
                    aktif_yil = next(y for y in result["mufredat"] if y["yil"] == yn)

                if sn is not None:
                    if aktif_yil is None:
                        yn_inferred = (sn + 1) // 2
                        if not any(y["yil"] == yn_inferred for y in result["mufredat"]):
                            result["mufredat"].append({
                                "yil": yn_inferred, "yil_adi": f"Year {yn_inferred}", "yariyillar": []
                            })
                        aktif_yil = next(y for y in result["mufredat"] if y["yil"] == yn_inferred)
                    if not any(s["yariyil"] == sn for s in aktif_yil["yariyillar"]):
                        aktif_yil["yariyillar"].append({
                            "yariyil": sn, "yariyil_adi": cap, "dersler": []
                        })
                    aktif_sem = next(s for s in aktif_yil["yariyillar"] if s["yariyil"] == sn)

            # Ders tablosu mu kontrol et (başlık satırına bak)
            header_texts = " ".join(
                c.get_text(strip=True).lower()
                for row in elem.find_all("tr")[:2]
                for c in row.find_all(["th", "td"])
            )
            is_course_table = any(
                kw in header_texts
                for kw in ["course code", "course name", "credit", "ects", "semester total"]
            )
            if not is_course_table:
                continue

            # Aktif yıl/yarıyıl yoksa otomatik oluştur
            if aktif_yil is None:
                result["mufredat"].append({"yil": 1, "yil_adi": "Year 1", "yariyillar": []})
                aktif_yil = result["mufredat"][0]

            if aktif_sem is None:
                next_sem = len(aktif_yil["yariyillar"]) + 1 + (aktif_yil["yil"] - 1) * 2
                aktif_yil["yariyillar"].append({
                    "yariyil": next_sem,
                    "yariyil_adi": f"Semester {next_sem}",
                    "dersler": [],
                })
                aktif_sem = aktif_yil["yariyillar"][-1]

            dersler = parse_course_table(elem)
            if dersler:
                aktif_sem["dersler"].extend(dersler)

    # Sırala
    result["mufredat"].sort(key=lambda y: y["yil"])
    for yil in result["mufredat"]:
        yil["yariyillar"].sort(key=lambda s: s["yariyil"])

    return result


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    out_dir = "mufredat_output"
    os.makedirs(out_dir, exist_ok=True)

    ozet = []
    tum_bolumler = []

    print(f"ODTÜ Müfredat Scraper — {len(DEPARTMENTS)} bölüm\n{'='*60}")

    for dept in DEPARTMENTS:
        kod = dept["kod"]
        print(f"\n[{kod}] {dept['ad']}")
        try:
            data = scrape_department(dept)
            if data is None:
                raise ValueError("Sayfa alınamadı")

            out_path = os.path.join(out_dir, f"{kod.lower()}_mufredat.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            toplam = sum(
                len(s["dersler"])
                for y in data["mufredat"]
                for s in y["yariyillar"]
            )
            yil_n = len(data["mufredat"])
            print(f"  ✅  {yil_n} yıl · {toplam} ders/slot")
            ozet.append({
                "kod": kod, "ad": dept["ad"], "fac_prog": dept["fac_prog"],
                "yil_sayisi": yil_n, "ders_sayisi": toplam,
                "kaynak": data["kaynak"],
                "dosya": f"{kod.lower()}_mufredat.json",
            })
            tum_bolumler.append(data)

        except Exception as e:
            print(f"  ❌  HATA: {e}")
            ozet.append({"kod": kod, "ad": dept["ad"], "hata": str(e)})

        time.sleep(1.5)

    with open(os.path.join(out_dir, "ozet.json"), "w", encoding="utf-8") as f:
        json.dump(ozet, f, ensure_ascii=False, indent=2)

    with open(os.path.join(out_dir, "tum_bolumler.json"), "w", encoding="utf-8") as f:
        json.dump(tum_bolumler, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    ok   = sum(1 for o in ozet if "hata" not in o)
    fail = sum(1 for o in ozet if "hata" in o)
    print(f"Tamamlandı → ✅ {ok} başarılı · ❌ {fail} başarısız")
    print(f"Çıktılar: {out_dir}/")

    print(f"\n{'KOD':<8} {'BÖLÜM':<44} {'YIL':>4} {'DERS':>6}")
    print("-"*64)
    for o in ozet:
        if "hata" in o:
            print(f"❌ {o['kod']:<7} {o['ad']:<44}  {o['hata']}")
        else:
            print(f"   {o['kod']:<7} {o['ad']:<44} {o['yil_sayisi']:>4} {o['ders_sayisi']:>6}")


# ── Tek bölüm hızlı test ─────────────────────────────────────────────────────

def test_one(kod="IE"):
    dept = next(d for d in DEPARTMENTS if d["kod"] == kod)
    data = scrape_department(dept)
    if data:
        for yil in data["mufredat"]:
            for sem in yil["yariyillar"]:
                print(f"  Yıl {yil['yil']} · Yarıyıl {sem['yariyil']} · {len(sem['dersler'])} kayıt")
    return data


if __name__ == "__main__":
    main()