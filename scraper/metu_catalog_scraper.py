import re
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup


OIBS_URL = "https://oibs2.metu.edu.tr/View_Program_Course_Details_64/main.php"

SCRAPE_ALL_DEPARTMENTS = True

TEST_DEPARTMENT_CODE = "887"

# Çekmek istediğimiz dönem:
# 20251 -> Fall
# 20252 -> Spring
# 20253 -> Summer
TARGET_TERM = "20252"

MAX_WORKERS = 4

REQUEST_DELAY_SECONDS = 0.3

REQUEST_RETRIES = 3

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

OUTPUT_FILE = BASE_DIR / "public" / "metu_courses_clean.json"
RAW_OUTPUT_FILE = DATA_DIR / "metu_courses_raw_debug.json"

DEBUG_DIR = BASE_DIR / "debug"
DEBUG_DIR.mkdir(exist_ok=True)

DEBUG_DEPARTMENT_FILE = DEBUG_DIR / "debug_department.html"
DEBUG_COURSE_DETAIL_FILE = DEBUG_DIR / "debug_course_detail.html"


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Pragma": "no-cache",
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def sleep_short():
    if REQUEST_DELAY_SECONDS > 0:
        time.sleep(REQUEST_DELAY_SECONDS)


def get_html(session: requests.Session, url: str) -> str:
    response = session.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.content.decode("utf-8", errors="ignore")


def post_html(session: requests.Session, url: str, payload: dict) -> str:
    response = session.post(
        url,
        headers=HEADERS,
        data=payload,
        timeout=30
    )
    response.raise_for_status()
    return response.content.decode("utf-8", errors="ignore")


def post_html_with_retry(
    session: requests.Session,
    url: str,
    payload: dict,
    retries: int = REQUEST_RETRIES
) -> str:
    last_error = None

    for attempt in range(1, retries + 1):
        try:
            html = post_html(session, url, payload)
            sleep_short()
            return html

        except Exception as e:
            last_error = e
            print(f"  Retry {attempt}/{retries} hata: {e}")
            time.sleep(1.5 * attempt)

    raise last_error


def extract_options(html: str):
    soup = BeautifulSoup(html, "lxml")

    options = []

    for option in soup.find_all("option"):
        value = option.get("value", "").strip()
        text = option.get_text(" ", strip=True)

        if value:
            options.append({
                "value": value,
                "text": text
            })

    return options


def detect_current_term(options):
    """
    Sayfadaki ilk 5 haneli term değerini bulur.
    Örnek: 20253
    Bu sadece department listesini ayırmak için kullanılacak.
    Dersleri çekmek için TARGET_TERM kullanılacak.
    """
    for option in options:
        value = option["value"]

        if re.fullmatch(r"\d{5}", value):
            return value

    return None


def extract_available_terms(options):
    """
    Sayfadaki tüm dönem option'larını döndürür.
    Örnek: ["20253", "20252", "20251"]
    """
    terms = []

    for option in options:
        value = option["value"]

        if re.fullmatch(r"\d{5}", value):
            terms.append(value)

    return list(dict.fromkeys(terms))


def extract_departments(options, detected_current_term):
    """
    OIBS sayfasında option listesi şu mantıkta geliyor:
    önce department seçenekleri,
    sonra term seçenekleri.

    Bu yüzden ilk term'e kadar olan option'lar department kabul ediliyor.
    Burada scrape edilecek term değil, sayfada görünen ilk term kullanılmalı.
    """
    departments = []

    for option in options:
        value = option["value"]

        if value == detected_current_term:
            break

        departments.append(option)

    return departments


def find_department_by_code(departments, department_code: str):
    for dept in departments:
        if dept["value"] == department_code:
            return dept

    return None


def find_department_by_text(departments, keyword: str):
    keyword_lower = keyword.lower()

    for dept in departments:
        if keyword_lower in dept["text"].lower():
            return dept

    return None


def fetch_department_courses(
    session: requests.Session,
    department_code: str,
    term: str
) -> str:
    payload = {
        "textWithoutThesis": "1",
        "select_dept": department_code,
        "select_semester": term,
        "submit_CourseList": "Submit",
        "hidden_redir": "Login",
    }

    return post_html_with_retry(session, OIBS_URL, payload)


def extract_course_codes_from_department(html: str):
    """
    Department course list sayfasından numeric course code değerlerini çeker.
    Örnek: 8870500, 8877862, 8877864
    """
    soup = BeautifulSoup(html, "lxml")

    course_codes = []

    for input_tag in soup.find_all("input"):
        input_type = input_tag.get("type", "").lower()
        value = input_tag.get("value", "").strip()

        if input_type == "radio" and value.isdigit():
            course_codes.append(value)

    return list(dict.fromkeys(course_codes))


def fetch_course_detail(session: requests.Session, course_code: str) -> str:
    payload = {
        "SubmitCourseInfo": "Course Info",
        "text_course_code": course_code,
        "hidden_redir": "Course_List",
    }

    return post_html_with_retry(session, OIBS_URL, payload)


def parse_header_info(text: str):
    department = None
    semester = None
    course_code = None
    course_name = None
    credit = None

    dept_match = re.search(
        r"Department\s*:\s*(.*?)\s+Semester\s*:\s*(\d+)",
        text,
        flags=re.IGNORECASE | re.DOTALL
    )

    if dept_match:
        department = clean_text(dept_match.group(1))
        semester = clean_text(dept_match.group(2))

    course_match = re.search(
        r"Course Code\s*:\s*(\d+)\s+Course Name\s*:\s*(.*?)\s+Credit\s*:",
        text,
        flags=re.IGNORECASE | re.DOTALL
    )

    if course_match:
        course_code = clean_text(course_match.group(1))
        course_name = clean_text(course_match.group(2))

    credit_match = re.search(
        r"Credit\s*:\s*([0-9.,()]+)",
        text,
        flags=re.IGNORECASE
    )

    if credit_match:
        credit = clean_text(credit_match.group(1))

    return {
        "department": department,
        "semester": semester,
        "courseCode": course_code,
        "courseName": course_name,
        "credit": credit
    }


def parse_course_detail(course_detail_html: str):
    soup = BeautifulSoup(course_detail_html, "lxml")
    text = soup.get_text("\n", strip=True)

    header_info = parse_header_info(text)

    sections = []

    day_names = {
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    }

    ignore_values = {
        "",
        "Back",
        "Course Syllabus",
        "Critical Course Information",
        "Section",
        "Instructor Name I",
        "Instructor Name II",
    }

    def is_time(value: str) -> bool:
        return bool(re.fullmatch(r"\d{1,2}:\d{2}", clean_text(value)))

    def get_cells(row):
        cells = []

        for cell in row.find_all(["td", "th"]):
            text_value = clean_text(cell.get_text(" ", strip=True))

            input_tag = cell.find("input")
            if input_tag:
                input_value = clean_text(input_tag.get("value", ""))
                if input_value:
                    text_value = input_value

            if text_value:
                cells.append(text_value)

        return cells

    def extract_times_from_cells(cells):
        times = []

        for i, cell in enumerate(cells):
            if cell in day_names:
                start = cells[i + 1] if i + 1 < len(cells) else ""
                end = cells[i + 2] if i + 2 < len(cells) else ""
                place = cells[i + 3] if i + 3 < len(cells) else ""

                if is_time(start) and is_time(end):
                    times.append({
                        "day": cell,
                        "start": start,
                        "end": end,
                        "place": clean_text(place)
                    })

        return times

    section_inputs = soup.find_all(
        "input",
        attrs={"name": re.compile(r"submit_section", re.IGNORECASE)}
    )

    for section_input in section_inputs:
        section_no = clean_text(section_input.get("value", ""))

        if not section_no:
            continue

        section = {
            "sectionNo": section_no,
            "instructors": [],
            "times": []
        }

        section_row = section_input.find_parent("tr")

        if not section_row:
            sections.append(section)
            continue

        cells = get_cells(section_row)

        for item in cells:
            if item in ignore_values:
                continue

            if item == section_no:
                continue

            if item in day_names:
                continue

            if is_time(item):
                continue

            if item.lower() in ["day", "start", "end", "classroom"]:
                continue

            if len(item) > 150:
                continue

            section["instructors"].append(item)

        section["times"].extend(extract_times_from_cells(cells))

        next_row = section_row.find_next_sibling("tr")

        while next_row:
            next_section_input = next_row.find(
                "input",
                attrs={"name": re.compile(r"submit_section", re.IGNORECASE)}
            )

            if next_section_input:
                break

            next_cells = get_cells(next_row)

            if next_cells:
                row_text = " ".join(next_cells)

                if row_text.lower().startswith("note"):
                    break

                if "Press section button" in row_text:
                    break

                section["times"].extend(extract_times_from_cells(next_cells))

            next_row = next_row.find_next_sibling("tr")

        section["instructors"] = list(dict.fromkeys(section["instructors"]))

        unique_times = []
        seen_times = set()

        for time_item in section["times"]:
            key = (
                time_item.get("day"),
                time_item.get("start"),
                time_item.get("end"),
                time_item.get("place"),
            )

            if key not in seen_times:
                seen_times.add(key)
                unique_times.append(time_item)

        section["times"] = unique_times

        sections.append(section)

    return {
        **header_info,
        "sections": sections
    }


def normalize_course(parsed_course, fallback_course_code=None):
    """
    Frontend'in okuyacağı temiz course objesi.
    fallback_course_code sadece debug için tutulur.
    Ana courseCode parse edilen olmalı.
    """
    return {
        "courseCode": parsed_course.get("courseCode") or fallback_course_code,
        "courseName": parsed_course.get("courseName"),
        "credit": parsed_course.get("credit"),
        "sections": parsed_course.get("sections", [])
    }


def is_valid_parsed_course(parsed_course):
    """
    Yanlış/ana sayfa HTML'i geldiğinde courseCode/courseName null kalıyordu.
    Bunu yakalamak için validasyon.
    """
    if not parsed_course:
        return False

    if not parsed_course.get("courseCode"):
        return False

    if not parsed_course.get("courseName"):
        return False

    return True


def scrape_single_course(course_code: str, base_cookies: dict):
    try:
        local_session = requests.Session()
        local_session.cookies.update(base_cookies)

        course_detail_html = fetch_course_detail(
            session=local_session,
            course_code=course_code
        )

        parsed = parse_course_detail(course_detail_html)

        if not is_valid_parsed_course(parsed):
            preview = BeautifulSoup(course_detail_html, "lxml").get_text("\n", strip=True)[:500]
            raise ValueError(
                "Ders detayı parse edilemedi. "
                "Muhtemelen ODTÜ ana sayfa/boş sayfa döndü. "
                f"HTML text preview: {preview}"
            )

        clean_course = normalize_course(parsed, fallback_course_code=course_code)

        return {
            "success": True,
            "courseCode": course_code,
            "clean": clean_course,
            "raw": {
                "courseCode": course_code,
                "parsed": parsed
            },
            "error": None
        }

    except Exception as e:
        return {
            "success": False,
            "courseCode": course_code,
            "clean": None,
            "raw": None,
            "error": str(e)
        }


def scrape_department(session, department, term):
    department_code = department["value"]
    department_name = department["text"]

    print("\n--------------------------------------------------")
    print(f"Seçilen department: {department_name}")
    print(f"Department code: {department_code}")
    print(f"Çekilecek term: {term}")
    print("Ders listesi çekiliyor...")

    department_html = fetch_department_courses(
        session=session,
        department_code=department_code,
        term=term
    )

    with open(DEBUG_DEPARTMENT_FILE, "w", encoding="utf-8") as f:
        f.write(department_html)

    course_codes = extract_course_codes_from_department(department_html)

    print(f"Bulunan course code sayısı: {len(course_codes)}")
    print(f"İlk 20 course code: {course_codes[:20]}")

    clean_courses = []
    raw_courses = []
    errors = []

    if not course_codes:
        return {
            "clean": {
                "departmentCode": department_code,
                "departmentName": department_name,
                "term": term,
                "courseCount": 0,
                "coursesWithSectionsCount": 0,
                "courses": []
            },
            "raw": {
                "departmentCode": department_code,
                "departmentName": department_name,
                "term": term,
                "courseCodes": [],
                "courses": [],
                "errors": []
            }
        }

    base_cookies = requests.utils.dict_from_cookiejar(session.cookies)

    print(f"Ders detayları paralel çekiliyor... Worker sayısı: {MAX_WORKERS}")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_course = {
            executor.submit(scrape_single_course, course_code, base_cookies): course_code
            for course_code in course_codes
        }

        for index, future in enumerate(as_completed(future_to_course), start=1):
            course_code = future_to_course[future]
            result = future.result()

            print(f"[{index}/{len(course_codes)}] Ders tamamlandı: {course_code}")

            if result["success"]:
                clean_course = result["clean"]
                raw_course = result["raw"]

                section_count = len(clean_course.get("sections", []))

                print(f"  Ders adı: {clean_course.get('courseName')}")
                print(f"  Section sayısı: {section_count}")

                clean_courses.append(clean_course)
                raw_courses.append(raw_course)

            else:
                print(f"  Hata oluştu: {course_code}")
                print(f"  {result['error'][:300]}")

                errors.append({
                    "courseCode": course_code,
                    "error": result["error"]
                })

    clean_courses.sort(key=lambda x: x.get("courseCode") or "")
    raw_courses.sort(key=lambda x: x.get("courseCode") or "")

    courses_with_sections = [
        course for course in clean_courses
        if course.get("sections")
    ]

    print("Department tamamlandı.")
    print(f"Toplam başarılı ders: {len(clean_courses)}")
    print(f"Section bulunan ders: {len(courses_with_sections)}")
    print(f"Hatalı ders: {len(errors)}")

    return {
        "clean": {
            "departmentCode": department_code,
            "departmentName": department_name,
            "term": term,
            "courseCount": len(clean_courses),
            "coursesWithSectionsCount": len(courses_with_sections),
            "courses": clean_courses
        },
        "raw": {
            "departmentCode": department_code,
            "departmentName": department_name,
            "term": term,
            "courseCodes": course_codes,
            "courses": raw_courses,
            "errors": errors
        }
    }


def main():
    start_time = time.time()

    session = requests.Session()

    print("ODTÜ ana sayfası okunuyor...")
    html = get_html(session, OIBS_URL)

    options = extract_options(html)
    print(f"Toplam option bulundu: {len(options)}")

    detected_current_term = detect_current_term(options)

    if not detected_current_term:
        raise ValueError("Current term bulunamadı. Sayfa yapısı değişmiş olabilir.")

    scrape_term = TARGET_TERM

    print(f"Sayfada bulunan current term: {detected_current_term}")
    print(f"Scrape edilecek term: {scrape_term}")

    available_terms = extract_available_terms(options)

    print(f"Sayfada görünen dönemler: {available_terms}")

    if scrape_term not in available_terms:
        print("UYARI:")
        print(f"{scrape_term} sayfadaki dönem option listesinde görünmüyor.")
        print("Yine de post isteği bu term ile gönderilecek.")

    departments = extract_departments(options, detected_current_term)
    print(f"Bulunan department sayısı: {len(departments)}")

    print("\nİlk 10 department:")
    for dept in departments[:10]:
        print(dept)

    if SCRAPE_ALL_DEPARTMENTS:
        selected_departments = departments
        print("\nFULL MODE: Tüm department'lar scrape edilecek.")
    else:
        test_department = find_department_by_code(departments, TEST_DEPARTMENT_CODE)

        if not test_department:
            raise ValueError(f"Department code bulunamadı: {TEST_DEPARTMENT_CODE}")

        selected_departments = [test_department]
        print(f"\nTEST MODE: Sadece department {TEST_DEPARTMENT_CODE} scrape edilecek.")

    clean_departments = []
    raw_departments = []

    total_departments = len(selected_departments)

    for index, department in enumerate(selected_departments, start=1):
        print("\n==================================================")
        print(f"Department ilerleme: [{index}/{total_departments}]")

        try:
            result = scrape_department(
                session=session,
                department=department,
                term=scrape_term
            )

            clean_departments.append(result["clean"])
            raw_departments.append(result["raw"])

        except Exception as e:
            print(f"Department seviyesinde hata oluştu: {department} - {e}")

            clean_departments.append({
                "departmentCode": department.get("value"),
                "departmentName": department.get("text"),
                "term": scrape_term,
                "courseCount": 0,
                "coursesWithSectionsCount": 0,
                "courses": [],
                "error": str(e)
            })

            raw_departments.append({
                "departmentCode": department.get("value"),
                "departmentName": department.get("text"),
                "term": scrape_term,
                "courseCodes": [],
                "courses": [],
                "errors": [
                    {
                        "scope": "department",
                        "error": str(e)
                    }
                ]
            })

        clean_output_partial = {
            "term": scrape_term,
            "detectedCurrentTerm": detected_current_term,
            "availableTerms": available_terms,
            "departmentCount": len(clean_departments),
            "departments": clean_departments
        }

        raw_output_partial = {
            "term": scrape_term,
            "detectedCurrentTerm": detected_current_term,
            "availableTerms": available_terms,
            "allDepartmentCountOnPage": len(departments),
            "scrapedDepartmentCount": len(raw_departments),
            "allDepartments": departments,
            "departments": raw_departments
        }

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(clean_output_partial, f, ensure_ascii=False, indent=2)

        with open(RAW_OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(raw_output_partial, f, ensure_ascii=False, indent=2)

        print(f"Ara kayıt alındı: {OUTPUT_FILE}")

    elapsed_seconds = time.time() - start_time

    clean_output = {
        "term": scrape_term,
        "detectedCurrentTerm": detected_current_term,
        "availableTerms": available_terms,
        "departmentCount": len(clean_departments),
        "departments": clean_departments,
        "elapsedSeconds": round(elapsed_seconds, 2)
    }

    raw_output = {
        "term": scrape_term,
        "detectedCurrentTerm": detected_current_term,
        "availableTerms": available_terms,
        "allDepartmentCountOnPage": len(departments),
        "scrapedDepartmentCount": len(raw_departments),
        "allDepartments": departments,
        "departments": raw_departments,
        "elapsedSeconds": round(elapsed_seconds, 2)
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(clean_output, f, ensure_ascii=False, indent=2)

    with open(RAW_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(raw_output, f, ensure_ascii=False, indent=2)

    print("\nScrape tamamlandı.")
    print(f"Çekilen term: {scrape_term}")
    print(f"Sayfada bulunan current term: {detected_current_term}")
    print(f"Clean JSON yazıldı: {OUTPUT_FILE}")
    print(f"Raw debug JSON yazıldı: {RAW_OUTPUT_FILE}")
    print(f"Toplam süre: {round(elapsed_seconds, 2)} saniye")


if __name__ == "__main__":
    main()