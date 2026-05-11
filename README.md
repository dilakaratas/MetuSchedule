## METU Scheduler

This project allows Middle East Technical University students to create and visualize their course schedules with a user-friendly interface.

## Motivation

This project was built with the aim of making the course selection and schedule planning process easier for METU students.

Instead of manually checking course information and possible time conflicts, students can use this application to view course data and build a cleaner weekly schedule.

## Code

This project was built using React.js and Vite.

The course data is generated from METU course catalog data and stored in JSON format. The frontend reads this data and displays it through a calendar-based interface.

## Features

- Browse METU course data
- View departments and related courses
- Display courses on a weekly calendar
- Detect and visualize course schedule information
- Clean and simple user interface
- JSON-based course data structure

## Technologies Used

- React.js
- Vite
- JavaScript
- CSS
- JSON

## Project Structure

```text
VITE-VERSION/
├── data/
│   └── metu_courses_raw_debug.json
├── scraper/
├── src/
│   ├── components/
│   │   ├── Calendar.jsx
│   │   ├── Header.jsx
│   │   └── Sidebar.jsx
│   ├── App.jsx
│   ├── data.js
│   ├── i18n.js
│   ├── main.jsx
│   ├── metu_courses_clean.json
│   ├── styles.css
│   └── utils.js
├── package.json
├── vite.config.js
└── README.md