

import requests
import json
import time
from bs4 import BeautifulSoup, NavigableString

BASE_URL = "https://catalog.metu.edu.tr"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr,en;q=0.9",
    "Referer": "https://catalog.metu.edu.tr/"
}

# Mühendislik Fakültesi program ID'leri
ENGINEERING_PROGRAMS = [
    (572, "Aerospace Engineering"),
    (563, "Chemical Engineering"),
    (562, "Civil Engineering"),
    (571, "Computer Engineering"),
    (567, "Electrical and Electronics Engineering"),
    (561, "Engineering Sciences"),
    (560, "Environmental Engineering"),
    (573, "Food Engineering"),
    (564, "Geological Engineering"),
    (568, "Industrial Engineering"),
    (569, "Mechanical Engineering"),
    (570, "Metallurgical and Materials Engineering"),
    (565, "Mining Engineering"),
    (566, "Petroleum and Natural Gas Engineering"),
]


def get_page(url):
    """Sayfayı çek, hata olursa None döndür."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"  [HATA] {url}: {e}")
        return None


def parse_courses(table):
    """Bir ders tablosunu parse edip liste döndürür."""
    courses = []
    for row in table.find_all("tr"):
        code_td = row.find("td", class_="short_course")
        name_td = row.find("td", class_="course")
        if not (code_td and name_td):
            continue

        code_raw = code_td.get_text(strip=True)
        name = name_td.get_text(strip=True)
        cells = row.find_all("td")

        # Elective placeholder (boş code veya sadece &nbsp;)
        is_elective = not code_raw or all(c in ('\xa0', ' ') for c in code_raw)

        if is_elective:
            if name:
                courses.append({
                    "code": None,
                    "name": name,
                    "credit": None,
                    "contact_h_w": None,
                    "lab_h_w": None,
                    "ects": _parse_float(cells[5].get_text(strip=True)) if len(cells) > 5 else None,
                    "type": "elective_slot"
                })
        else:
            courses.append({
                "code": code_raw,
                "name": name,
                "credit": _parse_int(cells[2].get_text(strip=True)) if len(cells) > 2 else None,
                "contact_h_w": _parse_int(cells[3].get_text(strip=True)) if len(cells) > 3 else None,
                "lab_h_w": _parse_int(cells[4].get_text(strip=True)) if len(cells) > 4 else None,
                "ects": _parse_float(cells[5].get_text(strip=True)) if len(cells) > 5 else None,
                "type": "required"
            })
    return courses


def _parse_int(s):
    try:
        return int(s)
    except (ValueError, TypeError):
        return s or None


def _parse_float(s):
    try:
        return float(s)
    except (ValueError, TypeError):
        return s or None


def parse_curriculum(soup):
    """
    Müfredat yıl/dönem yapısını çıkarır.
    Döndürür: [{"year": str, "semester": str, "courses": [...]}]
    """
    content = soup.find("div", class_="field-body") or soup

    # Yıl başlıkları <center><h4>FIRST YEAR</h4></center> içinde
    year_centers = [tag for tag in content.find_all("center") if tag.find("h4")]
    curriculum = []

    for i, center in enumerate(year_centers):
        year_text = center.find("h4").get_text(strip=True)
        next_center = year_centers[i + 1] if i + 1 < len(year_centers) else None

        semester_name = None
        node = center.next_sibling

        while node:
            if node == next_center:
                break

            if isinstance(node, NavigableString):
                text = node.strip()
                if "Semester" in text and len(text) < 60:
                    semester_name = text
            elif hasattr(node, 'name') and node.name:
                if node.name == 'table':
                    courses = parse_courses(node)
                    if courses:
                        curriculum.append({
                            "year": year_text,
                            "semester": semester_name or "Unknown Semester",
                            "courses": courses
                        })
                else:
                    text = node.get_text(strip=True)
                    if "Semester" in text and len(text) < 60:
                        semester_name = text

            node = node.next_sibling

    return curriculum


def scrape_program(prog_id, prog_name):
    """Bir programın tüm bilgilerini çek ve döndür."""
    url = f"{BASE_URL}/program.php?fac_prog={prog_id}"
    print(f"  Çekiliyor: [{prog_id}] {prog_name} ...")

    content = get_page(url)
    if not content:
        return None

    soup = BeautifulSoup(content, "html.parser")

    # Bölüm adı
    h2 = soup.find("h2")
    dept_name = h2.get_text(strip=True) if h2 else prog_name

    # Bölüm başkanı ve web adresi
    head_of_dept = None
    website = None
    depts_div = soup.find("div", id="depts_links")
    if depts_div:
        for link in depts_div.find_all("a"):
            href = link.get("href", "")
            if "acad_pers" in href:
                head_of_dept = link.get_text(strip=True)
            elif href.startswith("http"):
                website = href

    curriculum = parse_curriculum(soup)
    total_courses = sum(len(s["courses"]) for s in curriculum)
    required = sum(
        1 for s in curriculum for c in s["courses"] if c.get("type") == "required"
    )

    print(f"    → {len(curriculum)} dönem, {required} zorunlu ders ({total_courses} toplam)")

    return {
        "program_id": prog_id,
        "program_name": prog_name,
        "department_name": dept_name,
        "head_of_department": head_of_dept,
        "website": website,
        "catalog_url": url,
        "total_semesters": len(curriculum),
        "total_course_entries": total_courses,
        "curriculum": curriculum
    }


def main():
    print("=" * 60)
    print("METU Mühendislik Fakültesi Catalog Scraper")
    print("=" * 60)

    result = {
        "faculty": "Faculty of Engineering",
        "faculty_id": 500,
        "source_url": f"{BASE_URL}/fac_inst.php?fac_inst=500",
        "programs": []
    }

    for prog_id, prog_name in ENGINEERING_PROGRAMS:
        prog_data = scrape_program(prog_id, prog_name)
        if prog_data:
            result["programs"].append(prog_data)
        time.sleep(1.2) 

    output_file = "metu_engineering_catalog.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f" Tamamlandı! {len(result['programs'])} program çekildi.")
    print(f" Kaydedildi: {output_file}")
    print("=" * 60)


if __name__ == "__main__":
    main()