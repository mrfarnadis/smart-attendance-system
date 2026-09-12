/* =========================================================
   DIGITAL ATTENDANCE SYSTEM
   Firebase + GitHub Pages
   ========================================================= */

/* =========================
   FIREBASE IMPORTS
========================= */

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    get,
    update,
    remove,
    onValue,
    push
} from
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


/* =========================
   FIREBASE CONFIGURATION
========================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyBtYTUHRoMZ30TlJkmi1XuC7QMLoacunvE",

    authDomain:
        "attendance---management-system.firebaseapp.com",

    databaseURL:
        "https://attendance---management-system-default-rtdb.firebaseio.com/",

    projectId:
        "attendance---management-system",

    storageBucket:
        "attendance---management-system.firebasestorage.app",

    messagingSenderId:
        "626663323135",

    appId:
        "1:626663323135:web:fd4b7d396da2bb217623ca",

    measurementId:
        "G-XFWPVR9W14"
};


/* =========================
   INITIALIZE FIREBASE
========================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getDatabase(app);


/* =========================
   GLOBAL VARIABLES
========================= */

let currentUser = null;

let students = {};

let attendanceRecords = {};

let auditRecords = {};

let currentAttendance = {};

let currentLectureId = null;

let unsubscribeStudents = null;

let unsubscribeAttendance = null;


/* =========================
   HELPER FUNCTIONS
========================= */

function $(id) {
    return document.getElementById(id);
}


function show(id, visible = true) {

    const element = $(id);

    if (!element) return;

    element.classList.toggle("hidden", !visible);
}


function text(id, value) {

    const element = $(id);

    if (!element) return;

    element.textContent = value ?? "";
}


function sanitize(value) {

    return String(value || "")
        .trim()
        .replace(/[.#$/[\]]/g, "_")
        .replace(/\s+/g, "_");
}


function nowISO() {

    return new Date().toISOString();
}


function today() {

    const d = new Date();

    const year = d.getFullYear();

    const month = String(d.getMonth() + 1).padStart(2, "0");

    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   AUTHENTICATION
========================================================= */

const loginEmail = $("loginEmail");

const loginPassword = $("loginPassword");

const loginBtn = $("loginBtn");

const loginMessage = $("loginMessage");


if (loginBtn) {

    loginBtn.addEventListener("click", async function () {

        const email = loginEmail?.value.trim() || "";

        const password = loginPassword?.value || "";


        if (!email || !password) {

            text(
                "loginMessage",
                "Please enter email and password."
            );

            return;
        }


        text("loginMessage", "Logging in...");

        loginBtn.disabled = true;


        try {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            text(
                "loginMessage",
                "Login successful."
            );

        } catch (error) {

            console.error("LOGIN ERROR:", error);

            text(
                "loginMessage",
                `Login failed: ${error.code} - ${error.message}`
            );

        } finally {

            loginBtn.disabled = false;
        }

    });

}


/* Allow Enter key to login */

if (loginPassword) {

    loginPassword.addEventListener("keydown", function (event) {

        if (event.key === "Enter") {

            loginBtn?.click();

        }

    });

}


/* =========================
   LOGOUT
========================= */

const logoutBtn = $("logoutBtn");


if (logoutBtn) {

    logoutBtn.addEventListener("click", async function () {

        try {

            await signOut(auth);

        } catch (error) {

            console.error(error);

            alert(error.message);

        }

    });

}


/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(auth, user => {

    currentUser = user;


    if (user) {

        console.log(
            "Logged in:",
            user.email
        );


        show("loginScreen", false);

        show("loginPage", false);

        show("appScreen", true);

        show("dashboard", true);


        text(
            "teacherEmail",
            user.email
        );


        loadFirebaseData();

        setDefaultDate();


    } else {

        console.log("Not logged in");


        show("loginScreen", true);

        show("loginPage", true);

        show("appScreen", false);

        show("dashboard", false);

    }

});


/* =========================================================
   DEFAULT DATE
========================================================= */

function setDefaultDate() {

    const dateInput =
        $("attendanceDate") ||
        $("date");

    if (dateInput && !dateInput.value) {

        dateInput.value = today();

    }

}


/* =========================================================
   FIREBASE DATA LOADING
========================================================= */

function loadFirebaseData() {

    /* -------------------------
       STUDENTS
    ------------------------- */

    const studentsRef =
        ref(db, "students");


    if (unsubscribeStudents) {

        unsubscribeStudents();

    }


    unsubscribeStudents =
        onValue(studentsRef, snapshot => {

            students =
                snapshot.val() || {};

            renderStudentList();

            renderAttendanceList();

            updateStatistics();

            renderDefaulters();

        });


    /* -------------------------
       ATTENDANCE
    ------------------------- */

    const attendanceRef =
        ref(db, "attendance");


    if (unsubscribeAttendance) {

        unsubscribeAttendance();

    }


    unsubscribeAttendance =
        onValue(attendanceRef, snapshot => {

            attendanceRecords =
                snapshot.val() || {};

            updateStatistics();

            renderDefaulters();

            renderHistory();

        });


    const auditRef =
        ref(db, "audit");

    if (window._unsubscribeAudit) {
        window._unsubscribeAudit();
    }

    window._unsubscribeAudit =
        onValue(auditRef, snapshot => {

            auditRecords =
                snapshot.val() || {};

            renderAudit();

        });

}


/* =========================================================
   STUDENT MANAGEMENT
========================================================= */

const addStudentBtn =
    $("addStudentBtn");


if (addStudentBtn) {

    addStudentBtn.addEventListener(
        "click",
        addStudent
    );

}


async function addStudent() {

    if (!currentUser) {

        alert("Please login first.");

        return;
    }


    const rollInput =
        $("studentRoll");

    const nameInput =
        $("studentName");

    const classInput =
        $("studentClass");


    const roll =
        rollInput?.value.trim() || "";

    const name =
        nameInput?.value.trim() || "";

    const className =
        classInput?.value.trim() || "";


    if (!roll || !name) {

        alert(
            "Please enter student roll number and name."
        );

        return;
    }


    const studentId =
        sanitize(roll);


    const student = {

        id: studentId,

        roll: roll,

        name: name,

        className: className,

        createdAt: nowISO(),

        createdBy:
            currentUser.email

    };


    try {

        await set(
            ref(db, `students/${studentId}`),
            student
        );


        await createAudit(
            "ADD_STUDENT",
            studentId,
            `Student added: ${name}`
        );


        if (rollInput)
            rollInput.value = "";

        if (nameInput)
            nameInput.value = "";

        alert(
            "Student added successfully."
        );


    } catch (error) {

        console.error(error);

        alert(
            "Could not add student: " +
            error.message
        );

    }

}


/* =========================================================
   DELETE STUDENT
========================================================= */

async function deleteStudent(studentId) {

    if (!currentUser) return;


    const student =
        students[studentId];


    if (!student) return;


    const confirmDelete =
        confirm(
            `Delete ${student.name} (${student.roll})?`
        );


    if (!confirmDelete) return;


    try {

        await remove(
            ref(db, `students/${studentId}`)
        );


        await createAudit(
            "DELETE_STUDENT",
            studentId,
            `Student deleted: ${student.name}`
        );


    } catch (error) {

        console.error(error);

        alert(
            "Delete failed: " +
            error.message
        );

    }

}


/* =========================================================
   STUDENT LIST
========================================================= */

function renderStudentList() {

    const tbody = $("studentTableBody");

    if (!tbody) return;

    const search =
        (
            $("studentSearch")?.value ||
            ""
        )
        .toLowerCase()
        .trim();

    const list =
        Object.entries(students)
        .filter(([id, student]) => {

            return (
                String(student.name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                String(student.roll || "")
                    .toLowerCase()
                    .includes(search)

                ||

                String(student.className || "")
                    .toLowerCase()
                    .includes(search)
            );

        })
        .sort((a, b) =>
            String(a[1].roll || "")
                .localeCompare(
                    String(b[1].roll || ""),
                    undefined,
                    { numeric: true }
                )
        );


    tbody.innerHTML = "";

    if (list.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        No students found.
                    </div>
                </td>
            </tr>
        `;

        return;
    }


    list.forEach(([id, student]) => {

        const stats =
            calculateStudentStats(id);

        const percentageClass =
            stats.percentage < 75
                ? "percentage-bad"
                : "percentage-good";

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>
                <strong>${escapeHTML(student.roll)}</strong>
            </td>

            <td>
                ${escapeHTML(student.name)}
            </td>

            <td>
                ${escapeHTML(student.className || "-")}
            </td>

            <td>
                ${stats.total}
            </td>

            <td>
                ${stats.present}
            </td>

            <td class="${percentageClass}">
                ${stats.percentage.toFixed(2)}%
            </td>

            <td>
                <button
                    class="delete-btn"
                    data-delete-student="${escapeHTML(id)}"
                >
                    Delete
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });


    tbody
        .querySelectorAll("[data-delete-student]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => deleteStudent(
                    button.dataset.deleteStudent
                )
            );

        });

}


/* Student search */

const studentSearch =
    $("studentSearch");


if (studentSearch) {

    studentSearch.addEventListener(
        "input",
        renderStudentList
    );

}


/* =========================================================
   ATTENDANCE LECTURE INFORMATION
========================================================= */

function getAttendanceDetails() {

    const date =
        (
            $("attendanceDate")?.value ||
            $("date")?.value ||
            today()
        );

    const className =
        (
            $("attendanceClass")?.value ||
            $("className")?.value ||
            ""
        )
        .trim();

    const subject =
        (
            $("attendanceSubject")?.value ||
            $("subject")?.value ||
            ""
        )
        .trim();


    return {
        date,
        className,
        subject
    };

}


function makeLectureId(
    date,
    className,
    subject
) {

    return sanitize(
        `${date}_${className}_${subject}`
    );

}


/* =========================================================
   START / LOAD LECTURE
========================================================= */

const loadAttendanceBtn =
    $("loadAttendanceBtn") ||
    $("startAttendanceBtn");


if (loadAttendanceBtn) {

    loadAttendanceBtn.addEventListener(
        "click",
        loadAttendance
    );

}


async function loadAttendance() {

    if (!currentUser) {

        alert("Please login first.");

        return;
    }


    const {
        date,
        className,
        subject
    } = getAttendanceDetails();


    if (!date || !className || !subject) {

        alert(
            "Please enter Date, Class and Subject."
        );

        return;
    }


    currentLectureId =
        makeLectureId(
            date,
            className,
            subject
        );


    const lectureRef =
        ref(
            db,
            `attendance/${currentLectureId}`
        );


    try {

        const snapshot =
            await get(lectureRef);


        if (snapshot.exists()) {

            const data =
                snapshot.val();


            currentAttendance =
                data.attendance || {};

            alert(
                "Existing attendance loaded."
            );


        } else {

            currentAttendance = {};


            Object.keys(students)
                .forEach(studentId => {

                    currentAttendance[
                        studentId
                    ] = "absent";

                });


            alert(
                "New lecture created. " +
                "All students are initially Absent. " +
                "Mark Present as required."
            );

        }


        renderAttendanceList();

        updateCurrentLectureSummary();

    } catch (error) {

        console.error(error);

        alert(
            "Could not load attendance: " +
            error.message
        );

    }

}


/* =========================================================
   ATTENDANCE LIST
========================================================= */

function renderAttendanceList() {

    const container =
        $("attendanceList");


    if (!container) return;


    const search =
        (
            $("attendanceSearch")?.value ||
            ""
        )
        .toLowerCase()
        .trim();


    const list =
        Object.values(students)
        .filter(student => {

            return (
                String(student.name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                String(student.roll || "")
                    .toLowerCase()
                    .includes(search)
            );

        });


    if (list.length === 0) {

        container.innerHTML =
            `<div class="empty-state">
                No students available.
            </div>`;

        return;
    }


    container.innerHTML =
        list
        .sort((a, b) =>
            String(a.roll)
                .localeCompare(
                    String(b.roll),
                    undefined,
                    { numeric: true }
                )
        )
        .map(student => {

            const studentId =
                student.id ||
                sanitize(student.roll);

            const status =
                currentAttendance[
                    studentId
                ] || "absent";


            return `
                <div
                    class="attendance-row"
                    data-student-row="${escapeHTML(student.id)}"
                >

                    <div class="attendance-student">

                        <strong>
                            ${escapeHTML(student.name)}
                        </strong>

                        <small>
                            Roll No: ${escapeHTML(student.roll)}
                        </small>

                    </div>


                    <div class="attendance-buttons">

                        <button
                            class="present-btn ${
                                status === "present"
                                    ? "selected"
                                    : ""
                            }"
                            data-attendance="present"
                            data-student="${escapeHTML(
                                student.id ||
                                sanitize(student.roll)
                            )}"
                        >
                            Present
                        </button>


                        <button
                            class="absent-btn ${
                                status === "absent"
                                    ? "selected"
                                    : ""
                            }"
                            data-attendance="absent"
                            data-student="${escapeHTML(
                                student.id ||
                                sanitize(student.roll)
                            )}"
                        >
                            Absent
                        </button>

                    </div>

                </div>
            `;

        })
        .join("");


    container
        .querySelectorAll(
            "[data-attendance]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const studentId =
                        button.dataset.student;

                    const status =
                        button.dataset.attendance;


                    currentAttendance[
                        studentId
                    ] = status;


                    renderAttendanceList();

                    updateCurrentLectureSummary();

                }
            );

        });

}


/* Attendance search */

const attendanceSearch =
    $("attendanceSearch");


if (attendanceSearch) {

    attendanceSearch.addEventListener(
        "input",
        renderAttendanceList
    );

}


/* =========================================================
   SAVE ATTENDANCE
========================================================= */

const saveAttendanceBtn =
    $("saveAttendanceBtn");


if (saveAttendanceBtn) {

    saveAttendanceBtn.addEventListener(
        "click",
        saveAttendance
    );

}


async function saveAttendance() {

    if (!currentUser) {

        alert("Please login first.");

        return;
    }


    const {
        date,
        className,
        subject
    } = getAttendanceDetails();


    if (!date || !className || !subject) {

        alert(
            "Enter Date, Class and Subject first."
        );

        return;
    }


    if (
        Object.keys(students).length === 0
    ) {

        alert(
            "No students have been added."
        );

        return;
    }


    currentLectureId =
        makeLectureId(
            date,
            className,
            subject
        );


    /* Students without a selected status
       are considered absent */

    Object.keys(students)
        .forEach(studentId => {

            if (
                !currentAttendance[
                    studentId
                ]
            ) {

                currentAttendance[
                    studentId
                ] = "absent";

            }

        });


    const values =
        Object.values(currentAttendance);


    const present =
        values.filter(
            status => status === "present"
        ).length;


    const total =
        Object.keys(students).length;


    const absent =
        total - present;


    const percentage =
        total > 0
            ? Number(
                ((present / total) * 100)
                    .toFixed(2)
              )
            : 0;


    const existingSnapshot =
        await get(
            ref(
                db,
                `attendance/${currentLectureId}`
            )
        );


    const existing =
        existingSnapshot.exists()
            ? existingSnapshot.val()
            : null;


    const record = {

        date,

        className,

        subject,

        attendance:
            currentAttendance,

        present,

        absent,

        total,

        percentage,

        teacher:
            currentUser.email,

        createdAt:
            existing?.createdAt ||
            nowISO(),

        updatedAt:
            nowISO()

    };


    try {

        await set(
            ref(
                db,
                `attendance/${currentLectureId}`
            ),
            record
        );


        await createAudit(
            existing
                ? "EDIT_ATTENDANCE"
                : "SAVE_ATTENDANCE",

            currentLectureId,

            `${subject} attendance saved for ${date}`
        );


        alert(
            existing
                ? "Attendance updated successfully."
                : "Attendance saved successfully."
        );


        updateCurrentLectureSummary();


    } catch (error) {

        console.error(error);

        alert(
            "Could not save attendance: " +
            error.message
        );

    }

}
/* =========================================================
   CURRENT LECTURE SUMMARY
========================================================= */

function updateCurrentLectureSummary() {

    const values =
        Object.values(currentAttendance);


    const total =
        Object.keys(students).length;


    const present =
        values.filter(
            x => x === "present"
        ).length;


    const absent =
        Math.max(
            total - present,
            0
        );


    text(
        "totalStudents",
        total
    );

    text(
        "presentCount",
        present
    );

    text(
        "absentCount",
        absent
    );


    const percentage =
        total
            ? ((present / total) * 100)
                .toFixed(2)
            : "0.00";


    text(
        "lecturePercentage",
        `${percentage}%`
    );

}


/* =========================================================
   STUDENT ATTENDANCE STATISTICS
========================================================= */

function calculateStudentStats(studentId) {

    let total = 0;

    let present = 0;


    Object.values(attendanceRecords)
        .forEach(record => {

            if (
                record.attendance &&
                record.attendance[
                    studentId
                ]
            ) {

                total++;


                if (
                    record.attendance[
                        studentId
                    ] === "present"
                ) {

                    present++;

                }

            }

        });


    const absent =
        total - present;


    const percentage =
        total > 0
            ? (present / total) * 100
            : 0;


    return {

        total,

        present,

        absent,

        percentage

    };

}
/* =========================================================
   OVERALL STATISTICS
========================================================= */

function updateStatistics() {

    const studentCount =
        Object.keys(students).length;


    text(
        "studentTotal",
        studentCount
    );


    const records =
        Object.values(attendanceRecords);


    const lectures =
        records.length;


    let present = 0;

    let absent = 0;


    records.forEach(record => {

        present +=
            Number(record.present || 0);

        absent +=
            Number(record.absent || 0);

    });


    text(
        "lectureTotal",
        lectures
    );


    text(
        "overallPresent",
        present
    );


    text(
        "overallAbsent",
        absent
    );


    renderStudentStatistics();

}
/* =========================================================
   STUDENT STATISTICS TABLE
========================================================= */

function renderStudentStatistics() {

    const container =
        $("studentStatistics");


    if (!container) return;


    const list =
        Object.values(students);


    container.innerHTML =
        list
        .sort((a, b) =>
            String(a.roll)
                .localeCompare(
                    String(b.roll),
                    undefined,
                    { numeric: true }
                )
        )
        .map(student => {

            const stats =
                calculateStudentStats(
                    student.id
                );


            return `
                <tr>

                    <td>
                        ${escapeHTML(student.roll)}
                    </td>

                    <td>
                        ${escapeHTML(student.name)}
                    </td>

                    <td>
                        ${stats.total}
                    </td>

                    <td>
                        ${stats.present}
                    </td>

                    <td>
                        ${stats.absent}
                    </td>

                    <td>
                        ${stats.percentage.toFixed(2)}%
                    </td>

                    <td>
                        ${
                            stats.percentage < 75
                                ? "Defaulter"
                                : "OK"
                        }
                    </td>

                </tr>
            `;

        })
        .join("");

}
/* =========================================================
   75% DEFAULTER CALCULATION
========================================================= */

function lecturesRequiredFor75(
    present,
    total
) {

    if (total === 0)
        return 0;


    if (
        present / total >= 0.75
    ) {

        return 0;

    }


    let required = 0;


    while (
        (present + required) /
        (total + required)
        < 0.75
    ) {

        required++;


        if (required > 10000)
            break;

    }


    return required;

}
/* =========================================================
   DEFAULTERS
========================================================= */

function renderDefaulters() {

    const container =
        $("defaulterList");


    if (!container) return;


    const defaulters =
        Object.values(students)
        .map(student => {

            const stats =
                calculateStudentStats(
                    student.id
                );


            return {

                student,

                stats,

                required:
                    lecturesRequiredFor75(
                        stats.present,
                        stats.total
                    )

            };

        })
        .filter(item =>
            item.stats.total > 0 &&
            item.stats.percentage < 75
        );


    if (defaulters.length === 0) {

        container.innerHTML =
            `<div class="empty-state">
                No defaulters. Everyone is at or above 75%.
            </div>`;

        return;
    }


    container.innerHTML =
        defaulters
        .sort(
            (a, b) =>
                a.stats.percentage -
                b.stats.percentage
        )
        .map(item => {

            return `
                <div class="defaulter-card">

                    <strong>
                        ${escapeHTML(
                            item.student.name
                        )}
                    </strong>

                    <span>
                        Roll:
                        ${escapeHTML(
                            item.student.roll
                        )}
                    </span>

                    <span>
                        Attendance:
                        ${item.stats.percentage.toFixed(2)}%
                    </span>

                    <span>
                        Present:
                        ${item.stats.present}
                        /
                        ${item.stats.total}
                    </span>

                    <span>
                        Required for 75%:
                        ${item.required}
                        more lecture(s)
                    </span>

                </div>
            `;

        })
        .join("");

}
/* =========================================================
   HISTORY
========================================================= */

function renderHistory() {

    const tbody = $("historyTableBody");

    if (!tbody) return;

    const dateFilter =
        $("historyDate")?.value || "";

    const classFilter =
        (
            $("historyClass")?.value ||
            ""
        )
        .toLowerCase()
        .trim();

    const subjectFilter =
        (
            $("historySubject")?.value ||
            ""
        )
        .toLowerCase()
        .trim();

    const records =
        Object.entries(attendanceRecords)
        .filter(([id, record]) => {

            if (
                dateFilter &&
                record.date !== dateFilter
            ) {
                return false;
            }

            if (
                classFilter &&
                !String(record.className || "")
                    .toLowerCase()
                    .includes(classFilter)
            ) {
                return false;
            }

            if (
                subjectFilter &&
                !String(record.subject || "")
                    .toLowerCase()
                    .includes(subjectFilter)
            ) {
                return false;
            }

            return true;
        })
        .sort(
            ([, a], [, b]) =>
                String(b.updatedAt || "")
                    .localeCompare(
                        String(a.updatedAt || "")
                    )
        );


    tbody.innerHTML = "";

    if (records.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        No attendance history.
                    </div>
                </td>
            </tr>
        `;

        return;
    }


    records.forEach(([id, record]) => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(record.date)}</td>

            <td>${escapeHTML(record.className)}</td>

            <td>${escapeHTML(record.subject)}</td>

            <td>${record.present || 0}</td>

            <td>${record.absent || 0}</td>

            <td>${escapeHTML(record.teacher || "")}</td>

            <td>
                <button
                    class="edit-btn"
                    data-edit-lecture="${escapeHTML(id)}"
                >
                    Edit
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });


    tbody
        .querySelectorAll(
            "[data-edit-lecture]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => editLecture(
                    button.dataset.editLecture
                )
            );

        });

}
/* =========================================================
   EDIT ATTENDANCE
========================================================= */

async function editLecture(
    lectureId
) {

    const record =
        attendanceRecords[
            lectureId
        ];


    if (!record) {

        alert(
            "Attendance record not found."
        );

        return;
    }


    currentLectureId =
        lectureId;


    currentAttendance =
        {
            ...(record.attendance || {})
        };


    const dateInput =
        $("attendanceDate") ||
        $("date");

    const classInput =
        $("attendanceClass") ||
        $("className");

    const subjectInput =
        $("attendanceSubject") ||
        $("subject");


    if (dateInput)
        dateInput.value =
            record.date || "";

    if (classInput)
        classInput.value =
            record.className || "";

    if (subjectInput)
        subjectInput.value =
            record.subject || "";


    renderAttendanceList();

    updateCurrentLectureSummary();


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}
/* =========================================================
   AUDIT HISTORY
========================================================= */

async function createAudit(
    action,
    target,
    description
) {

    if (!currentUser)
        return;


    try {

        const auditRef =
            push(
                ref(db, "audit")
            );


        await set(
            auditRef,
            {

                action,

                target,

                description,

                teacher:
                    currentUser.email,

                timestamp:
                    nowISO()

            }
        );

    } catch (error) {

        console.error(
            "Audit error:",
            error
        );

    }

}
/* =========================================================
   EXCEL EXPORT
========================================================= */

function loadSheetJS() {

    return new Promise(
        (resolve, reject) => {

            if (window.XLSX) {

                resolve(window.XLSX);

                return;
            }


            const script =
                document.createElement(
                    "script"
                );


            script.src =
                "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";


            script.onload =
                () => resolve(
                    window.XLSX
                );


            script.onerror =
                reject;


            document.head.appendChild(
                script
            );

        }
    );

}
/* -------------------------
   STUDENT REPORT
------------------------- */

const exportStudentBtn =
    $("exportStudentsBtn");


if (exportStudentBtn) {

    exportStudentBtn.addEventListener(
        "click",
        exportStudentReport
    );

}


async function exportStudentReport() {

    try {

        const XLSX =
            await loadSheetJS();


        const data =
            Object.values(students)
            .map(student => {

                const stats =
                    calculateStudentStats(
                        student.id
                    );


                return {

                    "Roll No":
                        student.roll,

                    "Student Name":
                        student.name,

                    "Class":
                        student.className || "",

                    "Total Lectures":
                        stats.total,

                    "Attended":
                        stats.present,

                    "Absent":
                        stats.absent,

                    "Attendance %":
                        Number(
                            stats.percentage
                                .toFixed(2)
                        ),

                    "Status":
                        stats.percentage < 75
                            ? "Defaulter"
                            : "OK",

                    "Lectures Required":
                        lecturesRequiredFor75(
                            stats.present,
                            stats.total
                        )

                };

            });


        downloadExcel(
            XLSX,
            data,
            "Student_Attendance_Report.xlsx"
        );


    } catch (error) {

        console.error(error);

        alert(
            "Excel export failed."
        );

    }

}


/* -------------------------
   COMPLETE ATTENDANCE
------------------------- */

const exportCompleteBtn =
    $("exportAttendanceBtn");


if (exportCompleteBtn) {

    exportCompleteBtn.addEventListener(
        "click",
        exportCompleteReport
    );

}


async function exportCompleteReport() {

    try {

        const XLSX =
            await loadSheetJS();


        const rows = [];


        Object.values(
            attendanceRecords
        )
        .forEach(record => {

            Object.values(students)
                .forEach(student => {

                    const status =
                        record.attendance?.[
                            student.id
                        ] || "absent";


                    rows.push({

                        Date:
                            record.date,

                        Class:
                            record.className,

                        Subject:
                            record.subject,

                        "Roll No":
                            student.roll,

                        "Student Name":
                            student.name,

                        Attendance:
                            status,

                        Teacher:
                            record.teacher || ""

                    });

                });

        });


        downloadExcel(
            XLSX,
            rows,
            "Complete_Attendance.xlsx"
        );


    } catch (error) {

        console.error(error);

        alert(
            "Excel export failed."
        );

    }

}
/* -------------------------
   DEFAULTER REPORT
------------------------- */

const exportDefaulterBtn =
    $("exportDefaultersBtn");


if (exportDefaulterBtn) {

    exportDefaulterBtn.addEventListener(
        "click",
        exportDefaulterReport
    );

}


async function exportDefaulterReport() {

    try {

        const XLSX =
            await loadSheetJS();


        const data =
            Object.values(students)
            .map(student => {

                const stats =
                    calculateStudentStats(
                        student.id
                    );


                return {

                    "Roll No":
                        student.roll,

                    "Student Name":
                        student.name,

                    "Total Lectures":
                        stats.total,

                    "Present":
                        stats.present,

                    "Absent":
                        stats.absent,

                    "Attendance %":
                        Number(
                            stats.percentage
                                .toFixed(2)
                        ),

                    "Lectures Required":
                        lecturesRequiredFor75(
                            stats.present,
                            stats.total
                        ),

                    "Status":
                        stats.percentage < 75
                            ? "DEFAULTER"
                            : "OK"

                };

            })
            .filter(
                row =>
                    row["Attendance %"] < 75
            );


        downloadExcel(
            XLSX,
            data,
            "Defaulter_Report.xlsx"
        );


    } catch (error) {

        console.error(error);

        alert(
            "Excel export failed."
        );

    }

}
/* =========================================================
   EXCEL DOWNLOAD
========================================================= */

function downloadExcel(
    XLSX,
    data,
    filename
) {

    const worksheet =
        XLSX.utils.json_to_sheet(
            data
        );


    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Attendance"
    );


    XLSX.writeFile(
        workbook,
        filename
    );

}

/* =========================================================
   JSON BACKUP
========================================================= */

const backupBtn =
    $("backupJsonBtn");


if (backupBtn) {

    backupBtn.addEventListener(
        "click",
        downloadBackup
    );

}


function downloadBackup() {

    const backup = {

        exportedAt:
            nowISO(),

        project:
            "Digital Attendance System",

        students,

        attendance:
            attendanceRecords

    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    backup,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const a =
        document.createElement(
            "a"
        );


    a.href = url;

    a.download =
        `attendance-backup-${today()}.json`;


    document.body.appendChild(a);

    a.click();

    a.remove();


    URL.revokeObjectURL(url);

}

/* =========================================================
   MONTHLY REPORT
========================================================= */

const monthlyBtn =
    $("monthlyReportBtn");


if (monthlyBtn) {

    monthlyBtn.addEventListener(
        "click",
        monthlyReport
    );

}


function monthlyReport() {

    const month =
        $("reportMonth")?.value ||
        today().slice(0, 7);


    const records =
        Object.values(
            attendanceRecords
        )
        .filter(
            record =>
                String(record.date)
                    .startsWith(month)
        );


    const results = {};


    Object.values(students)
        .forEach(student => {

            let total = 0;

            let present = 0;


            records.forEach(record => {

                const status =
                    record.attendance?.[
                        student.id
                    ];


                if (status) {

                    total++;

                    if (
                        status ===
                        "present"
                    ) {

                        present++;

                    }

                }

            });


            results[
                student.id
            ] = {

                name:
                    student.name,

                roll:
                    student.roll,

                total,

                present,

                percentage:
                    total
                        ? (
                            present /
                            total *
                            100
                          ).toFixed(2)
                        : "0.00"

            };

        });


    displayReport(
        results,
        `Monthly Report - ${month}`
    );

}

/* =========================================================
   SEMESTER REPORT
========================================================= */

const semesterBtn =
    $("semesterReportBtn");


if (semesterBtn) {

    semesterBtn.addEventListener(
        "click",
        semesterReport
    );

}


function semesterReport() {

    const results = {};


    Object.values(students)
        .forEach(student => {

            const stats =
                calculateStudentStats(
                    student.id
                );


            results[
                student.id
            ] = {

                name:
                    student.name,

                roll:
                    student.roll,

                total:
                    stats.total,

                present:
                    stats.present,

                percentage:
                    stats.percentage
                        .toFixed(2)

            };

        });


    displayReport(
        results,
        "Semester Report"
    );

}

/* =========================================================
   DISPLAY REPORT
========================================================= */

function displayReport(
    results,
    title
) {

    const container =
        $("reportOutput");


    if (!container) {

        console.table(results);

        alert(
            `${title}\n\n` +
            Object.values(results)
                .map(item =>
                    `${item.roll} - ${item.name}: ${item.percentage}%`
                )
                .join("\n")
        );

        return;

    }


    container.innerHTML = `

        <h3>
            ${escapeHTML(title)}
        </h3>

        <div class="report-table-wrapper">

            <table>

                <thead>

                    <tr>

                        <th>Roll</th>

                        <th>Name</th>

                        <th>Total</th>

                        <th>Present</th>

                        <th>Attendance</th>

                    </tr>

                </thead>

                <tbody>

                    ${
                        Object.values(results)
                        .map(item => `

                            <tr>

                                <td>
                                    ${escapeHTML(item.roll)}
                                </td>

                                <td>
                                    ${escapeHTML(item.name)}
                                </td>

                                <td>
                                    ${item.total}
                                </td>

                                <td>
                                    ${item.present}
                                </td>

                                <td>
                                    ${item.percentage}%
                                </td>

                            </tr>

                        `)
                        .join("")
                    }

                </tbody>

            </table>

        </div>
    `;

}


/* =========================================================
   REPORT CONTROLS
========================================================= */

const generateReportBtn =
    $("generateReportBtn");

if (generateReportBtn) {

    generateReportBtn.addEventListener(
        "click",
        () => {

            const type =
                $("reportType")?.value ||
                "semester";

            if (type === "monthly") {
                monthlyReport();
            } else {
                semesterReport();
            }

        }
    );

}

const reportMonth =
    $("reportMonth");

if (reportMonth && !reportMonth.value) {
    reportMonth.value =
        today().slice(0, 7);
}

/* =========================================================
   REFRESH BUTTON
========================================================= */

const closeModalBtn =
    $("closeModalBtn");

if (closeModalBtn) {
    closeModalBtn.addEventListener(
        "click",
        () => $("editModal")?.classList.add("hidden")
    );
}

const updateAttendanceBtn =
    $("updateAttendanceBtn");

if (updateAttendanceBtn) {
    updateAttendanceBtn.addEventListener(
        "click",
        async () => {

            $("editModal")?.classList.add("hidden");

            if (currentLectureId) {
                await saveAttendance();
            }

        }
    );
}

const refreshBtn =
    $("refreshBtn");


if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        () => {

            renderStudentList();

            renderAttendanceList();

            updateStatistics();

            renderDefaulters();

            renderHistory();

        }
    );

}


/* =========================================================
   RESET CURRENT ATTENDANCE
========================================================= */

const resetAttendanceBtn =
    $("resetAttendanceBtn");


if (resetAttendanceBtn) {

    resetAttendanceBtn.addEventListener(
        "click",
        () => {

            if (
                !confirm(
                    "Mark all students Absent?"
                )
            ) return;


            currentAttendance = {};


            Object.keys(students)
                .forEach(studentId => {

                    currentAttendance[
                        studentId
                    ] = "absent";

                });


            renderAttendanceList();

            updateCurrentLectureSummary();

        }
    );

}


/* =========================================================
   MARK ALL PRESENT
========================================================= */

const markAllPresentBtn =
    $("markAllPresentBtn");


if (markAllPresentBtn) {

    markAllPresentBtn.addEventListener(
        "click",
        () => {

            Object.keys(students)
                .forEach(studentId => {

                    currentAttendance[
                        studentId
                    ] = "present";

                });


            renderAttendanceList();

            updateCurrentLectureSummary();

        }
    );

}



/* =========================================================
   MARK ALL ABSENT
========================================================= */

const markAllAbsentBtn =
    $("markAllAbsentBtn");

if (markAllAbsentBtn) {

    markAllAbsentBtn.addEventListener(
        "click",
        () => {

            Object.keys(students)
                .forEach(studentId => {

                    currentAttendance[
                        studentId
                    ] = "absent";

                });

            renderAttendanceList();
            updateCurrentLectureSummary();

        }
    );

}

/* =========================================================
   INITIAL UI
========================================================= */

setDefaultDate();

console.log(
    "Digital Attendance System loaded successfully."
);


/* =========================================================
   MODAL BACKDROP CLOSE
========================================================= */

const editModalElement = $("editModal");

if (editModalElement) {

    editModalElement.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                editModalElement
            ) {

                editModalElement.classList.add(
                    "hidden"
                );

            }

        }
    );

}
