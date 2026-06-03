"""
METU CENG Ders Listesi Scraper
==============================
Kurulum:
    pip install requests beautifulsoup4 lxml

Çalıştırma:
    python ceng_course_scraper.py

Çıktı:
    ceng_courses.json
"""

import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

OUTPUT_FILE = Path("ceng_courses.json")
COURSE_LIST_URL = "https://ceng.metu.edu.tr/index.php/tr/course-list"
TECHNICAL_ELECTIVES_URL = "https://ceng.metu.edu.tr/tr/teknik-secmeli-dersler"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "tr,en;q=0.9",
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def fetch(url: str) -> BeautifulSoup:
    print(f"  Fetching: {url}")
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    time.sleep(0.5)
    return BeautifulSoup(r.content.decode("utf-8", errors="ignore"), "lxml")


def split_code_name(text: str):
    """'ceng100 Computer Engineering' → ('CENG 100', 'Computer Engineering')"""
    m = re.match(r"^([a-zA-Z]+\s*\d+)\s+(.*)", text.strip())
    if m:
        raw_code = m.group(1).strip()
        name = m.group(2).strip()
        m2 = re.match(r"([a-zA-Z]+)\s*(\d+)", raw_code)
        if m2:
            return f"{m2.group(1).upper()} {m2.group(2)}", name
        return raw_code.upper(), name
    return None, text.strip()


# ── Sayfa 1: course-list ──────────────────────────────────────────────────────

def parse_course_list(soup: BeautifulSoup) -> dict:
    result = {"zorunlu_dersler": [], "servis_dersleri": []}

    # Yapı: <div class="accordion-item">
    #           <div class="accordion-header"><h3>Zorunlu Dersler</h3>...</div>
    #           <div class="accordion-content">...<ul><li><a>...</a></li></ul>...</div>

    for item in soup.find_all("div", class_="accordion-item"):
        header = item.find("div", class_="accordion-header")
        if not header:
            continue
        heading_text = clean(header.get_text())

        if "Zorunlu" in heading_text:
            key = "zorunlu_dersler"
        elif "Servis" in heading_text:
            key = "servis_dersleri"
        else:
            continue

        content = item.find("div", class_="accordion-content")
        if not content:
            continue

        for li in content.find_all("li"):
            link = li.find("a")
            if not link:
                continue
            href = link.get("href", "").strip()
            text = clean(link.get_text())

            if "teknik-secmeli" in href.lower() or "teknik seçmeli" in text.lower():
                continue

            code, name = split_code_name(text)
            result[key].append({
                "courseCode": code,
                "courseName": name,
                "catalogUrl": href if href.startswith("http") else None,
            })

    return result


# ── Sayfa 2: teknik-secmeli-dersler ──────────────────────────────────────────

def parse_table(content_div) -> list:
    courses = []
    table = content_div.find("table")
    if not table:
        return courses
    for row in table.find_all("tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        texts = [clean(c.get_text()) for c in cells]
        if "DERS KODU" in texts[0].upper():
            continue
        code = re.sub(r"\s+", " ", texts[0].strip()).upper()
        name = texts[1]
        credit = texts[2] if len(texts) > 2 else None
        if not code or not name:
            continue
        courses.append({"courseCode": code, "courseName": name, "credit": credit})
    return courses


def parse_technical_electives(soup: BeautifulSoup) -> dict:
    result = {
        "kategori_1": {
            "aciklama": "Bölüm tarafından açılan teknik seçmeli dersler (token-tabanlı atama).",
            "dersler": []
        },
        "kategori_2": {
            "aciklama": "Diğer bölümler tarafından açılan, ön-onaylı dersler. Bölüm onayı gerektirir.",
            "dersler": []
        },
        "kategori_3": {
            "aciklama": "2. kategori dışındaki tüm uygun dersler. Bölüm onayı gerektirir, 1xx kodlu dersler kabul edilmez.",
            "dersler": []
        },
    }

    # Yapı: <div class="accordion-item">
    #           <div class="accordion-header"><h3>1inci Kategori...</h3></div>
    #           <div class="accordion-content"><table>...</table></div>

    for item in soup.find_all("div", class_="accordion-item"):
        header = item.find("div", class_="accordion-header")
        if not header:
            continue
        heading_text = clean(header.get_text())

        if "1inci" in heading_text:
            key = "kategori_1"
        elif "2nci" in heading_text:
            key = "kategori_2"
        elif "3ncü" in heading_text:
            continue  # Liste yok
        else:
            continue

        content = item.find("div", class_="accordion-content")
        if not content:
            continue

        result[key]["dersler"] = parse_table(content)

    return result


# ── Ana ────────────────────────────────────────────────────────────────────────

def scrape():
    print("METU CENG Ders Listesi Scraper başlıyor...\n")

    print("1) course-list sayfası çekiliyor...")
    soup1 = fetch(COURSE_LIST_URL)
    course_data = parse_course_list(soup1)
    print(f"   Zorunlu Dersler : {len(course_data['zorunlu_dersler'])} ders")
    print(f"   Servis Dersleri : {len(course_data['servis_dersleri'])} ders")

    print("\n2) teknik-secmeli-dersler sayfası çekiliyor...")
    soup2 = fetch(TECHNICAL_ELECTIVES_URL)
    tech_data = parse_technical_electives(soup2)
    print(f"   Kat. 1 : {len(tech_data['kategori_1']['dersler'])} ders")
    print(f"   Kat. 2 : {len(tech_data['kategori_2']['dersler'])} ders")
    print(f"   Kat. 3 : Kural tanımlı (liste yok)")

    total = (
        len(course_data["zorunlu_dersler"])
        + len(course_data["servis_dersleri"])
        + len(tech_data["kategori_1"]["dersler"])
        + len(tech_data["kategori_2"]["dersler"])
    )

    output = {
        "source": {
            "courseListUrl": COURSE_LIST_URL,
            "technicalElectivesUrl": TECHNICAL_ELECTIVES_URL,
        },
        "zorunlu_dersler": course_data["zorunlu_dersler"],
        "servis_dersleri": course_data["servis_dersleri"],
        "teknik_secmeli_dersler": tech_data,
        "summary": {
            "zorunluDersCount": len(course_data["zorunlu_dersler"]),
            "servisDersCount": len(course_data["servis_dersleri"]),
            "teknikSecmeli1Count": len(tech_data["kategori_1"]["dersler"]),
            "teknikSecmeli2Count": len(tech_data["kategori_2"]["dersler"]),
            "totalCount": total,
        },
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Tamamlandı! Toplam {total} ders → {OUTPUT_FILE.resolve()}")
    print("\n── Özet ──────────────────────────────────────────────")
    print(f"Zorunlu Dersler       : {output['summary']['zorunluDersCount']}")
    print(f"Servis Dersleri       : {output['summary']['servisDersCount']}")
    print(f"Teknik Seçmeli Kat.1  : {output['summary']['teknikSecmeli1Count']}")
    print(f"Teknik Seçmeli Kat.2  : {output['summary']['teknikSecmeli2Count']}")
    print(f"TOPLAM                : {total}")


if __name__ == "__main__":
    scrape()