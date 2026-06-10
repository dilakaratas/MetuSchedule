"""
METU CENG Lisans Müfredatı Scraper
====================================
https://ceng.metu.edu.tr/index.php/tr/lisans-mufredati sayfasından:
  - Yıl / Yarıyıl bilgisi
  - Ders kodu (display: PHYS105), tam catalog kodu (course_code=2300105)
  - Ders adı, ODTÜ kredisi, Ders h/w, Lab h/w, ECTS

Kurulum:
    pip install requests beautifulsoup4 lxml

Çalıştırma:
    python ceng_curriculum_scraper.py

Çıktı:
    ceng_curriculum.json
"""

import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

OUTPUT_FILE = Path("ceng_curriculum.json")
CURRICULUM_URL = "https://ceng.metu.edu.tr/index.php/tr/lisans-mufredati"

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


def extract_course_code(href: str) -> str | None:
    """
    'https://catalog.metu.edu.tr/course.php?prog=571&course_code=2300105'
    → '2300105'
    """
    if not href:
        return None
    m = re.search(r"course_code=(\d+)", href)
    return m.group(1) if m else None


def parse_curriculum(soup: BeautifulSoup) -> list:
    """
    Yapı:
      <h2>Birinci Yıl</h2>
        <em>Birinci Yarıyıl</em>
        <table>...</table>
        <em>İkinci Yarıyıl</em>
        <table>...</table>
      <h2>İkinci Yıl</h2>
        ...
    """
    results = []

    # Ana içerik alanını bul
    main = (
        soup.find("main")
        or soup.find("div", {"id": "main-content"})
        or soup.find("div", class_=re.compile(r"(content|field-body|node)"))
        or soup
    )

    current_year = None
    current_semester = None

    # Tüm element'leri sırayla gez
    for tag in main.find_all(["h2", "h3", "em", "p", "table"]):

        text = clean(tag.get_text())

        # ── Yıl başlığı: "Birinci Yıl", "İkinci Yıl" ...
        if tag.name in ["h2", "h3"]:
            if re.search(r"[Yy]ıl|[Yy]ear", text):
                current_year = text
                current_semester = None
            continue

        # ── Yarıyıl etiketi: "Birinci Yarıyıl", "İkinci Yarıyıl" ...
        if tag.name in ["em", "p"]:
            if re.search(r"[Yy]arıyıl|[Ss]emester", text):
                current_semester = text
            continue

        # ── Tablo: ders satırları
        if tag.name == "table":
            rows = tag.find_all("tr")
            for row in rows:
                cells = row.find_all(["td", "th"])
                if len(cells) < 2:
                    continue

                # Header satırını atla
                cell_texts = [clean(c.get_text()) for c in cells]
                if "DERS KODU" in cell_texts[0].upper() or "DERS ADI" in cell_texts[1].upper():
                    continue

                # İlk hücre: ders kodu linki
                first_cell = cells[0]
                link = first_cell.find("a")

                display_code = clean(first_cell.get_text())  # "PHYS105"
                catalog_url = link.get("href", "").strip() if link else None
                course_code = extract_course_code(catalog_url)  # "2300105"

                course_name = cell_texts[1] if len(cell_texts) > 1 else None
                metu_credit = cell_texts[2] if len(cell_texts) > 2 else None
                lecture_hw = cell_texts[3] if len(cell_texts) > 3 else None
                lab_hw = cell_texts[4] if len(cell_texts) > 4 else None
                ects = cell_texts[5] if len(cell_texts) > 5 else None

                if not display_code or not course_name:
                    continue

                results.append({
                    "year": current_year,
                    "semester": current_semester,
                    "displayCode": display_code,       # "PHYS105"
                    "courseCode": course_code,          # "2300105"  ← catalog kodu
                    "courseName": course_name,
                    "metuCredit": metu_credit,
                    "lectureHW": lecture_hw,
                    "labHW": lab_hw,
                    "ects": ects,
                    "catalogUrl": catalog_url,
                })

    return results


def scrape():
    print("METU CENG Lisans Müfredatı Scraper başlıyor...\n")

    soup = fetch(CURRICULUM_URL)
    courses = parse_curriculum(soup)

    if not courses:
        print("⚠️  Hiç ders bulunamadı! Accordion/JS sorunu olabilir.")
        print("   Bulunan başlıklar:", [clean(h.get_text())[:40] for h in soup.find_all(["h2","h3"])])
        return

    # Yıl/yarıyıl dağılımı
    from collections import defaultdict
    by_year = defaultdict(lambda: defaultdict(list))
    for c in courses:
        by_year[c["year"]][c["semester"]].append(c)

    output = {
        "source": CURRICULUM_URL,
        "totalCourses": len(courses),
        "curriculum": []
    }

    for year, semesters in by_year.items():
        year_obj = {"year": year, "semesters": []}
        for semester, sem_courses in semesters.items():
            year_obj["semesters"].append({
                "semester": semester,
                "courseCount": len(sem_courses),
                "courses": sem_courses
            })
        output["curriculum"].append(year_obj)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✅ Tamamlandı! {len(courses)} ders → {OUTPUT_FILE.resolve()}")
    print()
    for year, semesters in by_year.items():
        print(f"  {year}")
        for sem, clist in semesters.items():
            print(f"    {sem}: {len(clist)} ders")
            for c in clist:
                print(f"      {c['displayCode']:10} code={c['courseCode']}  {c['courseName'][:40]}")


if __name__ == "__main__":
    scrape()