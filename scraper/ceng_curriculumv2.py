"""
ODTÜ Bilgisayar Mühendisliği Lisans Müfredatı Scraper
Kaynak: https://ceng.metu.edu.tr/index.php/tr/lisans-mufredati

Gereksinimler:
    pip install requests beautifulsoup4

Kullanım:
    python metu_ceng_scraper.py
    Çıktı: metu_ceng_mufredat.json
"""

import json
import re
import requests
from bs4 import BeautifulSoup

URL = "https://ceng.metu.edu.tr/index.php/tr/lisans-mufredati"

YIL_ADLARI = {
    "Birinci Yıl": 1,
    "İkinci Yıl": 2,
    "Üçüncü Yıl": 3,
    "Dördüncü Yıl": 4,
}

YARIYIL_ADLARI = {
    "Birinci Yarıyıl": 1,
    "İkinci Yarıyıl": 2,
    "Üçüncü Yarıyıl": 3,
    "Dördüncü Yarıyıl": 4,
    "Beşinci Yarıyıl": 5,
    "Altıncı Yarıyıl": 6,
    "Yedinci Yarıyıl": 7,
    "Sekizinci Yarıyıl": 8,
}

SECMELI_TURLER = {
    "TEKNİK SEÇMELİ",
    "TEKNİK OLMAYAN SEÇMELİ",
    "KISITLI SEÇMELİ",
    "SERBEST SEÇMELİ",
}


def fetch_page(url: str) -> BeautifulSoup:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; CENG-Scraper/1.0)"}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def extract_course_code(href: str) -> str | None:
    """https://catalog.metu.edu.tr/course.php?prog=571&course_code=2300105
    → '2300105'"""
    if not href:
        return None
    m = re.search(r"course_code=(\d+)", href)
    return m.group(1) if m else None


def to_int(s: str) -> int:
    try:
        return int(s.strip())
    except (ValueError, AttributeError):
        return 0


def to_float(s: str) -> float:
    try:
        return float(s.strip().replace(",", "."))
    except (ValueError, AttributeError):
        return 0.0


def parse_table(table) -> list:
    """
    Bir <table> elementini parse eder.
    Her satır için:
      - Normal ders  → dict with kod, catalog_kodu, ad, odtu_kredi, ders_saat, lab_saat, ects
      - Seçmeli grup → {secmeli_grup, secenekler:[...]}
      - Seçmeli slot → {tur, aciklama}
    """
    rows = [r for r in table.find_all("tr") if r.find("td")]
    dersler = []
    i = 0

    while i < len(rows):
        cells = rows[i].find_all("td")
        if not cells:
            i += 1
            continue

        kod_cell  = cells[0]
        ad_text   = cells[1].get_text(strip=True) if len(cells) > 1 else ""
        kod_text  = kod_cell.get_text(strip=True)

        # ── Seçmeli grup başlığı ──────────────────────────────────────────
        if "herhangi biri" in ad_text.lower() or "herhangi biri" in kod_text.lower():
            grup_baslik = ad_text or kod_text
            secenekler = []
            i += 1

            while i < len(rows):
                s_cells = rows[i].find_all("td")
                if not s_cells:
                    i += 1
                    continue

                s_kod_text = s_cells[0].get_text(strip=True)
                s_ad_text  = s_cells[1].get_text(strip=True) if len(s_cells) > 1 else ""

                # Yeni grup başlığı veya seçmeli slot → dur
                if "herhangi biri" in s_ad_text.lower():
                    break
                if s_ad_text in SECMELI_TURLER or s_kod_text in SECMELI_TURLER:
                    break

                # Boş satır → atla
                if not s_kod_text and not s_ad_text:
                    i += 1
                    continue

                # Link → catalog_kodu
                a_tag = s_cells[0].find("a")
                catalog_kodu = extract_course_code(a_tag["href"]) if a_tag else None

                secenek = {"kod": s_kod_text, "ad": s_ad_text}
                if catalog_kodu:
                    secenek["catalog_kodu"] = catalog_kodu
                if len(s_cells) >= 6:
                    secenek["odtu_kredi"] = to_int(s_cells[2].get_text())
                    secenek["ders_saat"]  = to_int(s_cells[3].get_text())
                    secenek["lab_saat"]   = to_int(s_cells[4].get_text())
                    secenek["ects"]       = to_float(s_cells[5].get_text())

                secenekler.append(secenek)
                i += 1

            if secenekler:
                dersler.append({"secmeli_grup": grup_baslik, "secenekler": secenekler})
            continue

        # ── Seçmeli slot (TEKNİK SEÇMELİ, vb.) ──────────────────────────
        if ad_text in SECMELI_TURLER or kod_text in SECMELI_TURLER:
            tur = ad_text if ad_text in SECMELI_TURLER else kod_text
            dersler.append({"tur": tur, "aciklama": tur.title() + " ders slotu"})
            i += 1
            continue

        # ── Normal ders ───────────────────────────────────────────────────
        if kod_text and len(cells) >= 6:
            a_tag = kod_cell.find("a")
            catalog_kodu = extract_course_code(a_tag["href"]) if a_tag else None

            ders = {
                "kod":        kod_text,
                "ad":         ad_text,
                "odtu_kredi": to_int(cells[2].get_text()),
                "ders_saat":  to_int(cells[3].get_text()),
                "lab_saat":   to_int(cells[4].get_text()),
                "ects":       to_float(cells[5].get_text()),
            }
            if catalog_kodu:
                ders["catalog_kodu"] = catalog_kodu

            dersler.append(ders)

        i += 1

    return dersler


def scrape() -> dict:
    soup = fetch_page(URL)

    mufredat = {
        "universite": "ODTÜ",
        "bolum":      "Bilgisayar Mühendisliği",
        "kaynak":     URL,
        "mufredat":   [],
    }

    aktif_yil     = None
    yil_sayac     = 0

    # Sayfadaki tüm h2 ve table elemanlarını DOM sırasıyla işle
    for elem in soup.find_all(["h2", "table"]):

        # ── Yıl başlığı ──────────────────────────────────────────────────
        if elem.name == "h2":
            metin = elem.get_text(strip=True)
            if metin in YIL_ADLARI:
                yil_obj = {
                    "yil":       YIL_ADLARI[metin],
                    "yil_adi":   metin,
                    "yariyillar": [],
                }
                mufredat["mufredat"].append(yil_obj)
                aktif_yil = yil_obj
            continue

        # ── Tablo ────────────────────────────────────────────────────────
        if elem.name == "table" and aktif_yil is not None:
            # Yarıyıl adını <caption>'dan al
            caption = elem.find("caption")
            if not caption:
                continue

            caption_text = caption.get_text(strip=True)
            if caption_text not in YARIYIL_ADLARI:
                continue  # müfredat tablosu değil (çift anadal vb.)

            yariyil_obj = {
                "yariyil":     YARIYIL_ADLARI[caption_text],
                "yariyil_adi": caption_text,
                "dersler":     parse_table(elem),
            }
            aktif_yil["yariyillar"].append(yariyil_obj)

    return mufredat


def main():
    print("Müfredat sayfası çekiliyor...")
    data = scrape()

    yil_sayisi = len(data["mufredat"])
    ders_sayisi = sum(
        len(y["dersler"])
        for yil in data["mufredat"]
        for y in yil["yariyillar"]
    )
    print(f"  {yil_sayisi} yıl, toplam ~{ders_sayisi} ders/slot bulundu.")

    output = "metu_ceng_mufredat.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Kaydedildi: {output}")


if __name__ == "__main__":
    main()