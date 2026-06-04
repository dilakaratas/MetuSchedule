"""
ODTÜ Endüstri Mühendisliği Lisans Müfredatı Scraper
Kaynak: https://ie.metu.edu.tr/tr/endustri-muhendisligi-lisans-ogretim-programi

Gereksinimler:
    pip install requests beautifulsoup4

Kullanım:
    python ie_metu_scraper.py
    Çıktı: ie_metu_mufredat.json
"""

import json
import re
import requests
from bs4 import BeautifulSoup, NavigableString

URL = "https://ie.metu.edu.tr/tr/endustri-muhendisligi-lisans-ogretim-programi"

# strong içindeki yıl başlıkları (BİRİNCİ YIL yok, 1. yıl implicit)
YIL_MAP = {
    "İKİNCİ YIL":   2,
    "ÜÇÜNCÜ YIL":   3,
    "DÖRDÜNCÜ YIL": 4,
}

YIL_ADI_MAP = {
    1: "Birinci Yıl",
    2: "İkinci Yıl",
    3: "Üçüncü Yıl",
    4: "Dördüncü Yıl",
}

# strong içindeki dönem başlıkları
DONEM_MAP = {
    "Birinci Dönem":  1,
    "İkinci Dönem":   2,
    "Üçüncü Dönem":   3,
    "Dördüncü Dönem": 4,
    "Beşinci Dönem":  5,
    "Altıncı Dönem":  6,
    "Yedinci Dönem":  7,
    "Sekizinci Dönem": 8,
}

SECMELI_TURLER = {
    "TEKNİK SEÇMELİ",
    "TEKNİK OLMAYAN SEÇMELİ",
    "KISITLI SEÇMELİ",
    "KISITLI SEÇMELİ*",
    "SERBEST SEÇMELİ",
}


def fetch_page(url):
    headers = {"User-Agent": "Mozilla/5.0 (compatible; IE-Scraper/1.0)"}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def extract_course_code(href):
    if not href:
        return None
    m = re.search(r"course_code=(\d+)", href)
    return m.group(1) if m else None


def to_int(s):
    try:
        return int(str(s).strip())
    except (ValueError, AttributeError):
        return 0


def to_float(s):
    try:
        return float(str(s).strip().replace(",", "."))
    except (ValueError, AttributeError):
        return 0.0


def parse_table(table):
    """Tablo → ders listesi. caption yok, thead var."""
    rows = [r for r in table.find_all("tr") if r.find("td")]
    dersler = []
    i = 0

    while i < len(rows):
        cells = rows[i].find_all("td")
        if not cells:
            i += 1
            continue

        kod_cell = cells[0]
        ad_text  = cells[1].get_text(strip=True) if len(cells) > 1 else ""
        kod_text = kod_cell.get_text(strip=True)

        # ── Seçmeli grup başlığı ──────────────────────────────────────────
        if "aşağıdaki" in (ad_text + kod_text).lower():
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
                if "aşağıdaki" in (sa + sk).lower():
                    break
                if sa.upper().rstrip("*") in {t.rstrip("*") for t in SECMELI_TURLER}:
                    break
                if not sk and not sa:
                    i += 1
                    continue
                a_tag = sc[0].find("a")
                cat = extract_course_code(a_tag["href"]) if a_tag else None
                sey = {"kod": sk, "ad": sa}
                if cat:
                    sey["catalog_kodu"] = cat
                if len(sc) >= 6:
                    sey.update({
                        "odtu_kredi": to_int(sc[2].get_text()),
                        "ders_saat":  to_int(sc[3].get_text()),
                        "lab_saat":   to_int(sc[4].get_text()),
                        "akts":       to_float(sc[5].get_text()),
                    })
                if sk or sa:
                    secenekler.append(sey)
                i += 1
            if secenekler:
                dersler.append({"secmeli_grup": grup_baslik, "secenekler": secenekler})
            continue

        # ── Seçmeli slot ──────────────────────────────────────────────────
        raw_tur = (ad_text or kod_text).strip()
        if raw_tur.upper().rstrip("*") in {t.rstrip("*") for t in SECMELI_TURLER}:
            tur = raw_tur.rstrip("*").strip()
            dersler.append({"tur": tur, "aciklama": tur.title() + " ders slotu"})
            i += 1
            continue

        # ── Normal ders ───────────────────────────────────────────────────
        if kod_text and len(cells) >= 6:
            a_tag = kod_cell.find("a")
            cat = extract_course_code(a_tag["href"]) if a_tag else None
            ders = {
                "kod":        kod_text,
                "ad":         ad_text,
                "odtu_kredi": to_int(cells[2].get_text()),
                "ders_saat":  to_int(cells[3].get_text()),
                "lab_saat":   to_int(cells[4].get_text()),
                "akts":       to_float(cells[5].get_text()),
            }
            if cat:
                ders["catalog_kodu"] = cat
            dersler.append(ders)

        i += 1
    return dersler


def scrape():
    soup = fetch_page(URL)

    mufredat = {
        "universite": "ODTÜ",
        "bolum":      "Endüstri Mühendisliği",
        "kaynak":     URL,
        "mufredat":   [],
    }

    # 1. yıl implicit — hemen oluştur
    yil1 = {"yil": 1, "yil_adi": "Birinci Yıl", "yariyillar": []}
    mufredat["mufredat"].append(yil1)
    aktif_yil   = yil1
    aktif_donem = None

    # Ana içerik div'ini bul
    content = (
        soup.find("div", class_="field-item") or
        soup.find("div", class_="content") or
        soup.find("div", id=re.compile(r"main")) or
        soup.body
    )

    # Tüm direct çocukları (ve torunları) sırayla gez
    # strong tag'larını ve table tag'larını DOM sırasıyla işle
    for elem in content.descendants:
        if not hasattr(elem, "name") or not elem.name:
            continue

        # ── strong → yıl veya dönem başlığı ──────────────────────────────
        if elem.name == "strong":
            text = elem.get_text(strip=True)

            # Yıl başlığı
            if text.upper() in YIL_MAP:
                yil_no = YIL_MAP[text.upper()]
                # Daha önce eklenmemişse ekle
                if not any(y["yil"] == yil_no for y in mufredat["mufredat"]):
                    yil_obj = {
                        "yil":        yil_no,
                        "yil_adi":    YIL_ADI_MAP[yil_no],
                        "yariyillar": [],
                    }
                    mufredat["mufredat"].append(yil_obj)
                    aktif_yil   = yil_obj
                    aktif_donem = None
                continue

            # Dönem başlığı
            if text in DONEM_MAP and aktif_yil is not None:
                donem_no = DONEM_MAP[text]
                # Aynı dönem zaten varsa atla
                if any(d["yariyil"] == donem_no for d in aktif_yil["yariyillar"]):
                    # aktif_donem'i güncelle
                    aktif_donem = next(d for d in aktif_yil["yariyillar"] if d["yariyil"] == donem_no)
                    continue
                donem_obj = {
                    "yariyil":     donem_no,
                    "yariyil_adi": text,
                    "dersler":     [],
                }
                aktif_yil["yariyillar"].append(donem_obj)
                aktif_donem = donem_obj
            continue

        # ── table → aktif döneme ekle ─────────────────────────────────────
        if elem.name == "table" and aktif_donem is not None:
            if elem.find_parent("table"):
                continue  # nested table
            dersler = parse_table(elem)
            aktif_donem["dersler"].extend(dersler)

    return mufredat


def main():
    print("IE müfredat sayfası çekiliyor...")
    data = scrape()

    yil_sayisi = len(data["mufredat"])
    ders_sayisi = sum(
        len(y["dersler"])
        for yil in data["mufredat"]
        for y in yil["yariyillar"]
    )
    print(f"  {yil_sayisi} yıl, ~{ders_sayisi} ders/slot bulundu.")

    output = "ie_metu_mufredat.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Kaydedildi: {output}")


if __name__ == "__main__":
    main()