"""
ODTÜ Mühendislik Fakültesi Lisans Müfredatı Scraper
=====================================================
Tüm 15 mühendislik bölümünün müfredatını yıl/dönem/ders bilgisiyle çeker.

Kaynak URL'ler:
  Ana kaynak : https://catalog2.metu.edu.tr/1/{prog_id}/{slug}
  AE fallback: https://ae2.metu.edu.tr/en/undergraduate-curriculum

Gereksinimler:
    pip install requests beautifulsoup4

Kullanım:
    python metu_eng_faculty_scraper.py
    Çıktı: metu_eng_faculty_mufredat.json
"""

import json
import re
import time
import requests
from bs4 import BeautifulSoup

# ── Sabitler ───────────────────────────────────────────────────────────────────

BASE          = "https://catalog2.metu.edu.tr"
FACULTY_URL   = f"{BASE}/faculty-of-engineering/500"
CATALOG_LEGACY = "https://catalog.metu.edu.tr"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Bölüm tanımları: prog_id, catalog2 slug, fallback URL (403 durumunda)
# fallback=None olan bölümler yalnızca catalog2'den çekilir.
DEPARTMENTS = [
    {
        "ad":       "Aerospace Engineering",
        "prog_id":  572,
        "slug":     "aerospace-engineering",
        "fallback": "https://ae2.metu.edu.tr/en/undergraduate-curriculum",
    },
    {"ad": "Chemical Engineering",                   "prog_id": 563, "slug": "chemical-engineering",                   "fallback": None},
    {"ad": "Civil Engineering",                       "prog_id": 562, "slug": "civil-engineering",                       "fallback": None},
    {"ad": "Computer Engineering",                    "prog_id": 571, "slug": "computer-engineering",                    "fallback": None},
    {"ad": "Electrical and Electronics Engineering",  "prog_id": 567, "slug": "electrical-and-electronics-engineering",  "fallback": None},
    {"ad": "Engineering Sciences",                    "prog_id": 561, "slug": "engineering-sciences",                    "fallback": None},
    {"ad": "Environmental Engineering",               "prog_id": 560, "slug": "environmental-engineering",               "fallback": None},
    {"ad": "Food Engineering",                        "prog_id": 573, "slug": "food-engineering",                        "fallback": None},
    {"ad": "Geological Engineering",                  "prog_id": 564, "slug": "geological-engineering",                  "fallback": None},
    {"ad": "Industrial Engineering",                  "prog_id": 568, "slug": "industrial-engineering",                  "fallback": None},
    {"ad": "Mechanical Engineering",                  "prog_id": 569, "slug": "mechanical-engineering",                  "fallback": None},
    {"ad": "Metallurgical and Materials Engineering", "prog_id": 570, "slug": "metallurgical-and-materials-engineering", "fallback": None},
    {"ad": "Mining Engineering",                      "prog_id": 565, "slug": "mining-engineering",                      "fallback": None},
    {"ad": "Petroleum and Natural Gas Engineering",   "prog_id": 566, "slug": "petroleum-and-natural-gas-engineering",   "fallback": None},
]

# ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

def fetch(url: str, retries: int = 3) -> BeautifulSoup:
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
            return BeautifulSoup(r.text, "html.parser")
        except requests.RequestException as exc:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    [UYARI] {exc} – {wait}s sonra tekrar deneniyor...")
                time.sleep(wait)
            else:
                raise


def catalog2_url(dept: dict) -> str:
    return f"{BASE}/1/{dept['prog_id']}/{dept['slug']}"


def extract_catalog_code(href: str) -> str | None:
    """
    /course/phys105/2300105          → '2300105'
    course.php?course_code=2300105   → '2300105'
    course.php?prog=X&course_code=Y  → 'Y'
    """
    if not href:
        return None
    m = re.search(r"/course/[^/]+/(\d+)", href)
    if m:
        return m.group(1)
    m = re.search(r"course_code=(\d+)", href)
    return m.group(1) if m else None


def to_float(s) -> float:
    try:
        return float(str(s).strip().replace(",", "."))
    except (ValueError, AttributeError):
        return 0.0


def to_int(s) -> int:
    try:
        return int(str(s).strip().split(".")[0])
    except (ValueError, AttributeError):
        return 0


# ── Parser A: catalog2.metu.edu.tr ───────────────────────────────────────────
#
# Yapı:
#   <h3>First Year » First Semester</h3>
#   <table> ... </table>
#   ...
# Yıl/dönem bilgisi h3 başlığından, ders bilgisi tablodan çekilir.

YEAR_MAP = {
    "first year": 1,  "second year": 2,
    "third year": 3,  "fourth year": 4,
    "birinci yıl": 1, "ikinci yıl":  2,
    "üçüncü yıl":  3, "dördüncü yıl":4,
}
SEMESTER_WORDS = {
    "first": 1, "second": 2, "third": 3, "fourth": 4,
    "fifth": 5, "sixth":  6, "seventh":7, "eighth":  8,
    "birinci": 1, "ikinci": 2, "üçüncü": 3, "dördüncü": 4,
    "beşinci": 5, "altıncı": 6, "yedinci": 7, "sekizinci": 8,
}


def heading_to_year_semester(text: str):
    lower = text.lower()
    yil   = next((v for k, v in YEAR_MAP.items() if k in lower), None)

    # "Semester N" biçimi (N = 1 veya 2 → yıl içi sıra)
    m = re.search(r"semester\s+(\d)", lower)
    if m:
        rel   = int(m.group(1))
        donem = (yil - 1) * 2 + rel if yil and rel <= 2 else rel
        return yil, donem

    # "First Semester", "İkinci Yarıyıl" gibi kelime biçimleri
    for kelime, no in SEMESTER_WORDS.items():
        if f"{kelime} semester" in lower or f"{kelime} yarıyıl" in lower:
            return yil, no

    return yil, None


def parse_course_row_catalog2(cells) -> dict | None:
    if len(cells) < 2:
        return None
    kod = cells[0].get_text(strip=True)
    ad  = cells[1].get_text(strip=True)
    if not kod or kod.lower() in ("course code", "ders kodu"):
        return None

    a = cells[0].find("a")
    ders = {"kod": kod, "ad": ad}
    cat  = extract_catalog_code(a["href"]) if a else None
    if cat:
        ders["catalog_kodu"] = cat
    if len(cells) >= 6:
        ders["odtu_kredi"] = to_int(cells[2].get_text())
        ders["ders_saat"]  = to_float(cells[3].get_text())
        ders["lab_saat"]   = to_float(cells[4].get_text())
        ders["ects"]       = to_float(cells[5].get_text())
    elif len(cells) >= 4:
        ders["odtu_kredi"] = to_int(cells[2].get_text())
        ders["ects"]       = to_float(cells[3].get_text())
    return ders


def parse_catalog2(soup: BeautifulSoup) -> list:
    """catalog2.metu.edu.tr/1/... sayfasını parse eder."""
    main = (
        soup.find("div", id="main-content")
        or soup.find("div", class_="region-content")
        or soup
    )
    yariyillar: list       = []
    aktif:      dict | None = None
    secmeli:    dict | None = None

    for elem in main.descendants:
        if not hasattr(elem, "name") or not elem.name:
            continue

        # Dönem başlığı
        if elem.name in ("h3", "h4"):
            metin      = elem.get_text(strip=True)
            yil, donem = heading_to_year_semester(metin)
            if donem is not None:
                aktif   = {"yariyil": donem, "yariyil_adi": metin, "dersler": []}
                if yil:
                    aktif["yil"] = yil
                yariyillar.append(aktif)
                secmeli = None

        # Ders tablosu
        elif elem.name == "table" and aktif is not None:
            for row in elem.find_all("tr"):
                cells    = row.find_all(["td", "th"])
                if not cells:
                    continue
                ilk = cells[0].get_text(strip=True).lower()

                # "Any N of the following set"
                if re.search(r"\bany\b.+\bfollowing\b", ilk):
                    secmeli = {
                        "secmeli_grup": cells[0].get_text(strip=True),
                        "secenekler":   [],
                    }
                    aktif["dersler"].append(secmeli)
                    continue

                if not ilk or ilk in ("course code", "ders kodu"):
                    secmeli = None
                    continue

                ders = parse_course_row_catalog2(cells)
                if not ders:
                    secmeli = None
                    continue

                if secmeli:
                    secmeli["secenekler"].append(ders)
                else:
                    aktif["dersler"].append(ders)

    return yariyillar


# ── Parser B: ae2.metu.edu.tr (Aerospace Engineering) ────────────────────────
#
# Yapı:
#   <h4>1st YEAR</h4>
#   (tablo içinde Fall/Spring sütunları, iç içe tablo)
#
# Bu sayfa tablo hücrelerini birleştirip Fall/Spring'i tek satırda verir;
# h4 ile yıl, Fall/Spring metniyle dönem tespit edilir.

AE_YEAR_MAP = {"prep": 0, "1st": 1, "2nd": 2, "3rd": 3, "4th": 4}
AE_SEMESTER_MAP = {"fall": "Fall", "spring": "Spring"}


def parse_ae_curriculum(soup: BeautifulSoup) -> list:
    """ae2.metu.edu.tr/en/undergraduate-curriculum sayfasını parse eder."""
    main = soup.find("div", id="main-content") or soup

    yariyillar: list       = []
    aktif_yil:  int | None = None
    aktif_sem:  dict | None = None

    for elem in main.descendants:
        if not hasattr(elem, "name") or not elem.name:
            continue

        # Yıl başlığı: <h4>1st YEAR</h4>
        if elem.name == "h4":
            metin = elem.get_text(strip=True).lower()
            for kisa, no in AE_YEAR_MAP.items():
                if f"{kisa} year" in metin or (kisa == "prep" and "prep" in metin):
                    aktif_yil  = no
                    aktif_sem  = None
                    break

        # Tablo — her tablo bir dönem (Fall veya Spring)
        elif elem.name == "table" and aktif_yil is not None:
            # Dönem bilgisini başlık hücresinden al
            caption    = elem.find("caption")
            header_row = elem.find("tr")
            sem_name   = None

            if caption:
                t = caption.get_text(strip=True).lower()
                for k, v in AE_SEMESTER_MAP.items():
                    if k in t:
                        sem_name = v
                        break

            if sem_name is None and header_row:
                for th in header_row.find_all(["th", "td"]):
                    t = th.get_text(strip=True).lower()
                    for k, v in AE_SEMESTER_MAP.items():
                        if k in t:
                            sem_name = v
                            break
                    if sem_name:
                        break

            if sem_name is None:
                continue   # dönem belirlenemedi

            # Mutlak dönem numarası
            if aktif_yil == 0:
                donem = 0   # prep school
            else:
                donem = (aktif_yil - 1) * 2 + (1 if sem_name == "Fall" else 2)

            aktif_sem = {
                "yil":         aktif_yil,
                "yariyil":     donem,
                "yariyil_adi": f"{aktif_yil}{'st' if aktif_yil==1 else 'nd' if aktif_yil==2 else 'rd' if aktif_yil==3 else 'th'} Year – {sem_name} Semester",
                "dersler":     [],
            }
            yariyillar.append(aktif_sem)
            secmeli: dict | None = None

            for row in elem.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if len(cells) < 2:
                    continue
                kod = cells[0].get_text(strip=True)
                ad  = cells[1].get_text(strip=True) if len(cells) > 1 else ""

                # Başlık/boş satır
                if not kod or kod.lower() in ("code", "course code"):
                    secmeli = None
                    continue

                # Seçmeli satırı (Restricted Technical Elective gibi)
                if re.search(r"elective", ad, re.I) and not re.match(r"[A-Z]{2,}", kod):
                    tur_ders = {
                        "tur":      kod.strip(),
                        "aciklama": ad.strip(),
                    }
                    # Kredi bilgisi
                    if len(cells) >= 3:
                        kredi_str = cells[2].get_text(strip=True)
                        m = re.search(r"\((\d+)-(\d+)\)(\d+)", kredi_str)
                        if m:
                            tur_ders["ders_saat"]  = int(m.group(1))
                            tur_ders["lab_saat"]   = int(m.group(2))
                            tur_ders["odtu_kredi"] = int(m.group(3))
                    aktif_sem["dersler"].append(tur_ders)
                    continue

                # Seçmeli grup (Restricted Technical Elective altındaki seçenekler)
                # AE sayfasında seçenekler ayrı satırda, boşlukla ayrılmış kod listesiyle
                if re.search(r"restricted.*elective", kod, re.I):
                    secmeli = {
                        "secmeli_grup": kod.strip(),
                        "secenekler":   [],
                    }
                    aktif_sem["dersler"].append(secmeli)
                    continue

                # Normal ders
                # AE sayfasında kredi "(3-2)4" biçiminde tek hücrede
                ders: dict = {"kod": kod, "ad": ad}
                a = cells[0].find("a")
                cat = extract_catalog_code(a["href"]) if a else None
                if cat:
                    ders["catalog_kodu"] = cat

                if len(cells) >= 3:
                    kredi_str = cells[2].get_text(strip=True)
                    m = re.search(r"\((\d+)-(\d+)\)(\d+)", kredi_str)
                    if m:
                        ders["ders_saat"]  = int(m.group(1))
                        ders["lab_saat"]   = int(m.group(2))
                        ders["odtu_kredi"] = int(m.group(3))
                    elif kredi_str.upper() == "NC":
                        ders["odtu_kredi"] = 0

                if secmeli:
                    secmeli["secenekler"].append(ders)
                else:
                    aktif_sem["dersler"].append(ders)

    return yariyillar


# ── Parser C: mine.metu.edu.tr ve benzeri bölüm siteleri ─────────────────────
#
# Yapı (catalog2'nin kapanması durumunda kullanılabilir):
#   <strong>FIRST YEAR</strong> + <strong>First Semester</strong>
#   <table> ... </table>
# Bu yapı aynı zamanda orijinal CENG scraper'ının hedef aldığı
# ceng.metu.edu.tr yapısına benzer.
#
# NOT: Şu an catalog2 bu bölümler için çalışıyor; bu parser ileride
# lazım olursa kullanılabilir.

STRONG_YEAR_MAP = {
    "first year": 1, "second year": 2, "third year": 3, "fourth year": 4,
    "1st year":   1, "2nd year":   2,  "3rd year":  3,  "4th year":  4,
}
STRONG_SEM_MAP = {
    "first semester":   1, "second semester":  2, "third semester":  3,
    "fourth semester":  4, "fifth semester":   5, "sixth semester":  6,
    "seventh semester": 7, "eighth semester":  8,
    "fall semester":    None,   # yıl bazında hesaplanacak
    "spring semester":  None,
}


def parse_dept_site(soup: BeautifulSoup) -> list:
    """
    mine.metu.edu.tr, mete.metu.edu.tr gibi bölüm sitelerini parse eder.
    <strong> ya da <b> etiketli yıl/dönem başlıkları + <table> yapısını işler.
    """
    main = soup.find("div", id="main-content") or soup
    yariyillar: list        = []
    aktif:      dict | None = None
    aktif_yil:  int | None  = None
    secmeli:    dict | None = None
    sem_counter: int        = 0   # mutlak dönem sayacı

    for elem in main.descendants:
        if not hasattr(elem, "name") or not elem.name:
            continue

        # Yıl/dönem başlığı: <strong>, <b>, <p><strong>, veya <h2>/<h3>
        if elem.name in ("strong", "b", "h2", "h3", "h4"):
            metin  = elem.get_text(strip=True).lower().strip()
            # Yıl tespiti
            for k, v in STRONG_YEAR_MAP.items():
                if k == metin:
                    aktif_yil   = v
                    sem_counter = (v - 1) * 2
                    aktif       = None
                    secmeli     = None
                    break
            # Dönem tespiti
            for k, v in STRONG_SEM_MAP.items():
                if k in metin:
                    sem_counter += 1
                    donem = sem_counter
                    aktif = {
                        "yil":         aktif_yil,
                        "yariyil":     donem,
                        "yariyil_adi": elem.get_text(strip=True),
                        "dersler":     [],
                    }
                    yariyillar.append(aktif)
                    secmeli = None
                    break

        # Ders tablosu
        elif elem.name == "table" and aktif is not None:
            for row in elem.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if not cells:
                    continue
                ilk = cells[0].get_text(strip=True).lower()

                if not ilk or ilk in ("course code", "ders kodu"):
                    secmeli = None
                    continue

                ders = parse_course_row_catalog2(cells)
                if not ders:
                    secmeli = None
                    continue

                aktif["dersler"].append(ders)

    return yariyillar


# ── Ana scrape mantığı ────────────────────────────────────────────────────────

def scrape_department(dept: dict) -> list:
    """
    Bir bölüm için müfredatı çeker.
    Önce catalog2'yi dener; 4xx alırsa fallback URL'yi kullanır.
    """
    c2_url = catalog2_url(dept)

    # 1. catalog2 denemesi
    try:
        soup = fetch(c2_url)
        result = parse_catalog2(soup)
        if result:
            print(f"    ✓ catalog2  → {len(result)} dönem")
            return result
        print("    ⚠ catalog2 boş döndü, fallback deneniyor...")
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else "?"
        print(f"    ⚠ catalog2 HTTP {code}, fallback deneniyor...")
    except Exception as e:
        print(f"    ⚠ catalog2 hata ({e}), fallback deneniyor...")

    # 2. Fallback URL (varsa)
    fb = dept.get("fallback")
    if not fb:
        raise RuntimeError("catalog2 başarısız ve fallback URL tanımlı değil")

    soup   = fetch(fb)
    result = parse_ae_curriculum(soup)   # AE tipi fallback
    if not result:
        result = parse_dept_site(soup)   # Genel bölüm sitesi tipi
    if result:
        print(f"    ✓ fallback  → {len(result)} dönem  ({fb})")
    else:
        print(f"    ✗ Fallback de boş döndü: {fb}")
    return result


def scrape_all() -> dict:
    print(f"\n{len(DEPARTMENTS)} bölüm işlenecek:\n")
    for d in DEPARTMENTS:
        print(f"  [{d['prog_id']:3d}] {d['ad']}")
    print()

    fakulte = {
        "universite": "ODTÜ",
        "fakulte":    "Mühendislik Fakültesi",
        "kaynak":     FACULTY_URL,
        "bolumler":   [],
    }

    for idx, dept in enumerate(DEPARTMENTS, 1):
        print(f"[{idx:2d}/{len(DEPARTMENTS)}] {dept['ad']}")
        print(f"         catalog2: {catalog2_url(dept)}")

        try:
            yariyillar = scrape_department(dept)
            toplam_ders = sum(
                len(y["dersler"])
                + sum(
                    len(d.get("secenekler", []))
                    for d in y["dersler"]
                    if isinstance(d, dict) and "secenekler" in d
                )
                for y in yariyillar
            )
            print(f"         → {len(yariyillar)} dönem, ~{toplam_ders} ders/slot")

            fakulte["bolumler"].append({
                "ad":       dept["ad"],
                "prog_id":  dept["prog_id"],
                "kaynak":   catalog2_url(dept),
                "mufredat": yariyillar,
            })

        except Exception as exc:
            print(f"         ✗ HATA: {exc}")
            fakulte["bolumler"].append({
                "ad":       dept["ad"],
                "prog_id":  dept["prog_id"],
                "kaynak":   catalog2_url(dept),
                "hata":     str(exc),
                "mufredat": [],
            })

        time.sleep(1)

    return fakulte


# ── Giriş noktası ─────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("ODTÜ Mühendislik Fakültesi Müfredat Scraper")
    print("=" * 60)

    data        = scrape_all()
    basarili    = sum(1 for b in data["bolumler"] if b.get("mufredat"))
    toplam_ders = sum(
        sum(len(y["dersler"]) for y in b["mufredat"])
        for b in data["bolumler"]
    )

    print("\n" + "=" * 60)
    print(f"  Toplam bölüm      : {len(data['bolumler'])}")
    print(f"  Başarıyla çekilen : {basarili}")
    print(f"  Toplam ders/slot  : {toplam_ders}")
    print("=" * 60)

    output = "metu_eng_faculty_mufredat.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\nKaydedildi → {output}")


if __name__ == "__main__":
    main()