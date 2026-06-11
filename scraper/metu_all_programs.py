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


# ─── HTTP ───────────────────────────────────────────────────────────────────

def get_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"  [HATA] {url}: {e}")
        return None


# ─── DISCOVERY ──────────────────────────────────────────────────────────────

def discover_faculties():
    """
    Ana sayfadan tüm fakülte/enstitü/okul ID'lerini ve adlarını çeker.
    Döndürür: [(fac_id, fac_name), ...]
    """
    content = get_page(f"{BASE_URL}/index.php")
    if not content:
        return []

    soup = BeautifulSoup(content, "html.parser")
    faculties = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "fac_inst.php?fac_inst=" in href:
            try:
                fac_id = int(href.split("fac_inst=")[1].split("&")[0])
                name = a.get_text(strip=True).lstrip("[").rstrip("]")
                # NCC prefix temizle
                if name.startswith("NCC] "):
                    name = "[NCC] " + name[5:]
                if (fac_id, name) not in faculties:
                    faculties.append((fac_id, name))
            except ValueError:
                pass

    return faculties


def discover_programs(fac_id, fac_name):
    """
    Bir fakülte sayfasından tüm program ID'lerini ve adlarını çeker.
    Döndürür: [(prog_id, prog_name, degree), ...]
    """
    url = f"{BASE_URL}/fac_inst.php?fac_inst={fac_id}"
    content = get_page(url)
    if not content:
        return []

    soup = BeautifulSoup(content, "html.parser")
    programs = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "program.php?fac_prog=" in href:
            try:
                prog_id = int(href.split("fac_prog=")[1].split("&")[0])
                prog_name = a.get_text(strip=True)

                # Derece bilgisi varsa (kardeş td)
                degree = None
                parent_td = a.find_parent("td")
                if parent_td:
                    next_td = parent_td.find_next_sibling("td")
                    if next_td:
                        degree = next_td.get_text(strip=True) or None

                programs.append((prog_id, prog_name, degree))
            except ValueError:
                pass

    return programs


# ─── PARSING ────────────────────────────────────────────────────────────────

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


def parse_courses(table):
    courses = []
    for row in table.find_all("tr"):
        code_td = row.find("td", class_="short_course")
        name_td = row.find("td", class_="course")
        if not (code_td and name_td):
            continue

        code_raw = code_td.get_text(strip=True)
        name = name_td.get_text(strip=True)
        cells = row.find_all("td")

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


def parse_curriculum(soup):
    content = soup.find("div", class_="field-body") or soup
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


# ─── SCRAPING ───────────────────────────────────────────────────────────────

def scrape_program(prog_id, prog_name, degree=None):
    url = f"{BASE_URL}/program.php?fac_prog={prog_id}"
    content = get_page(url)
    if not content:
        return None

    soup = BeautifulSoup(content, "html.parser")

    h2 = soup.find("h2")
    dept_name = h2.get_text(strip=True) if h2 else prog_name

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
    required = sum(1 for s in curriculum for c in s["courses"] if c.get("type") == "required")

    return {
        "program_id": prog_id,
        "program_name": prog_name,
        "degree": degree,
        "department_name": dept_name,
        "head_of_department": head_of_dept,
        "website": website,
        "catalog_url": url,
        "total_semesters": len(curriculum),
        "total_course_entries": total_courses,
        "required_courses": required,
        "curriculum": curriculum
    }


def scrape_faculty(fac_id, fac_name):
    url = f"{BASE_URL}/fac_inst.php?fac_inst={fac_id}"
    content = get_page(url)
    dean = None
    fac_website = None

    if content:
        soup = BeautifulSoup(content, "html.parser")
        # Dekan bilgisi
        depts_div = soup.find("div", id="depts_links")
        if not depts_div:
            # Bazı sayfalarda farklı yapı olabilir; düz metin ara
            for a in soup.find_all("a", href=True):
                if "acad_pers" in a["href"]:
                    dean = a.get_text(strip=True)
                    break
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.startswith("http") and "metu.edu.tr" in href and "catalog" not in href:
                    fac_website = href
                    break
        else:
            for a in depts_div.find_all("a"):
                href = a.get("href", "")
                if "acad_pers" in href:
                    dean = a.get_text(strip=True)
                elif href.startswith("http"):
                    fac_website = href

    programs_meta = discover_programs(fac_id, fac_name)
    print(f"\n{'─'*60}")
    print(f"  {fac_name}  (ID: {fac_id}) — {len(programs_meta)} program bulundu")
    print(f"{'─'*60}")

    programs = []
    for prog_id, prog_name, degree in programs_meta:
        print(f"  Çekiliyor: [{prog_id}] {prog_name} ...")
        data = scrape_program(prog_id, prog_name, degree)
        if data:
            semesters = data["total_semesters"]
            required = data["required_courses"]
            total = data["total_course_entries"]
            print(f"    → {semesters} dönem, {required} zorunlu ders ({total} toplam)")
            programs.append(data)
        time.sleep(1.0)

    return {
        "faculty_id": fac_id,
        "faculty_name": fac_name,
        "dean": dean,
        "website": fac_website,
        "catalog_url": url,
        "total_programs": len(programs),
        "programs": programs
    }


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  METU Tüm Fakülteler — Catalog Scraper")
    print("=" * 60)

    faculties_meta = discover_faculties()
    print(f"\n  {len(faculties_meta)} fakülte/enstitü/okul keşfedildi:")
    for fid, fname in faculties_meta:
        print(f"    [{fid}] {fname}")

    all_data = {
        "university": "Middle East Technical University (METU / ODTÜ)",
        "source": f"{BASE_URL}/index.php",
        "faculties": []
    }

    total_programs = 0
    for fac_id, fac_name in faculties_meta:
        fac_data = scrape_faculty(fac_id, fac_name)
        all_data["faculties"].append(fac_data)
        total_programs += fac_data["total_programs"]
        time.sleep(1.5)

    output_file = "metu_all_programs.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"  Tamamlandı!")
    print(f"  {len(all_data['faculties'])} fakülte, {total_programs} program çekildi.")
    print(f"  Kaydedildi: {output_file}")
    print("=" * 60)


if __name__ == "__main__":
    main()
