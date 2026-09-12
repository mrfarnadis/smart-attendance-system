/* ============================================================
   SMART ATTENDANCE MANAGEMENT SYSTEM
   Firebase + HTML + CSS + JavaScript
============================================================ */


/* ============================================================
   FIREBASE IMPORTS
============================================================ */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    get,
    push,
    remove,
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


/* ============================================================
   FIREBASE CONFIGURATION

   REPLACE THESE VALUES WITH YOUR FIREBASE PROJECT VALUES.
============================================================ */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBtYTUHRoMZ30TlJkmi1XuC7QMLoacunvE",
  authDomain: "attendance---management-system.firebaseapp.com",
  projectId: "attendance---management-system",
  storageBucket: "attendance---management-system.firebasestorage.app",
  messagingSenderId: "626663323135",
  appId: "1:626663323135:web:fd4b7d396da2bb217623ca",
  measurementId: "G-XFWPVR9W14"
};


/* ============================================================
   INITIALIZE FIREBASE
============================================================ */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getDatabase(app);


/* ============================================================
   GLOBAL STATE
============================================================ */

let currentUser = null;

let students = {};

let attendanceRecords = {};

let currentAttendance = {};

let editingLectureId = null;

let confirmCallback = null;


/* ============================================================
   DOM
============================================================ */

const loginScreen =
    document.getElementById("loginScreen");

const appScreen =
    document.getElementById("app");

const loginBtn =
    document.getElementById("loginBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const loginMessage =
    document.getElementById("loginMessage");

const teacherEmail =
    document.getElementById("teacherEmail");

const attendanceDate =
    document.getElementById("attendanceDate");

const className =
    document.getElementById("className");

const subjectName =
    document.getElementById("subjectName");

const attendanceList =
    document.getElementById("attendanceList");

const attendanceSearch =
    document.getElementById("attendanceSearch");

const totalStudents =
    document.getElementById("totalStudents");

const presentCount =
    document.getElementById("presentCount");

const absentCount =
    document.getElementById("absentCount");

const lecturePercentage =
    document.getElementById("lecturePercentage");


/* ============================================================
   DEFAULT DATE
============================================================ */

attendanceDate.value =
    new Date().toISOString().split("T")[0];


/* ============================================================
   LOGIN
============================================================ */

loginBtn.addEventListener("click", async () => {

    const email =
        document.getElementById("loginEmail")
            .value.trim();

    const password =
        document.getElementById("loginPassword")
            .value;

    if (!email || !password) {

        loginMessage.textContent =
            "Please enter email and password.";

        return;
    }

    loginMessage.textContent =
        "Logging in...";

    try {

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        loginMessage.textContent = "";

    } catch (error) {

        console.error(error);

        loginMessage.textContent =
            "Login failed. Check email and password.";

    }

});


/* ============================================================
   LOGOUT
============================================================ */

logoutBtn.addEventListener("click", async () => {

    await signOut(auth);

});


/* ============================================================
   AUTH STATE
============================================================ */

onAuthStateChanged(auth, user => {

    if (user) {

        currentUser = user;

        loginScreen.classList.add("hidden");

        appScreen.classList.remove("hidden");

        teacherEmail.textContent =
            user.email;

        startDatabaseListeners();

        loadHistory();

        loadAudit();

        renderStudents();

        renderAttendance();

    } else {

        currentUser = null;

        loginScreen.classList.remove("hidden");

        appScreen.classList.add("hidden");

    }

});


/* ============================================================
   DATABASE LISTENERS
============================================================ */

function startDatabaseListeners() {

    const studentsRef =
        ref(db, "students");

    onValue(studentsRef, snapshot => {

        students =
            snapshot.val() || {};

        renderStudents();

        renderAttendance();

        updateAttendanceSummary();

        generateDefaulters();

    });


    const attendanceRef =
        ref(db, "attendance");

    onValue(attendanceRef, snapshot => {

        attendanceRecords =
            snapshot.val() || {};

        loadHistory();

        renderStudents();

        generateDefaulters();

    });

}


/* ============================================================
   ADD STUDENT
============================================================ */

document
    .getElementById("addStudentBtn")
    .addEventListener("click", async () => {

        const roll =
            document.getElementById("studentRoll")
                .value.trim();

        const name =
            document.getElementById("studentName")
                .value.trim();

        const studentClass =
            document.getElementById("studentClass")
                .value.trim();

        if (!roll || !name) {

            alert(
                "Roll number and student name are required."
            );

            return;
        }

        const safeId =
            roll.replace(/[.#$[\]/]/g, "_");

        if (students[safeId]) {

            alert(
                "This roll number already exists."
            );

            return;
        }

        await set(
            ref(db, `students/${safeId}`),
            {
                roll,
                name,
                className: studentClass,

                createdAt:
                    new Date().toISOString(),

                createdBy:
                    currentUser.email
            }
        );

        await createAudit(
            "STUDENT_ADDED",
            `Student ${roll} - ${name} added`
        );

        document.getElementById("studentRoll").value = "";

        document.getElementById("studentName").value = "";

        document.getElementById("studentClass").value = "";

        alert("Student added successfully.");

    });


/* ============================================================
   RENDER STUDENTS
============================================================ */

function renderStudents() {

    const tbody =
        document.getElementById("studentTableBody");

    const search =
        document.getElementById("studentSearch")
            .value.toLowerCase();

    tbody.innerHTML = "";

    const list =
        Object.entries(students)
            .filter(([id, student]) => {

                return (
                    student.name
                        .toLowerCase()
                        .includes(search)

                    ||

                    student.roll
                        .toLowerCase()
                        .includes(search)

                    ||

                    (student.className || "")
                        .toLowerCase()
                        .includes(search)
                );

            })
            .sort((a, b) =>
                a[1].roll.localeCompare(
                    b[1].roll,
                    undefined,
                    { numeric: true }
                )
            );


    if (!list.length) {

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

        const row =
            document.createElement("tr");

        const percentageClass =
            stats.percentage < 75
                ? "percentage-bad"
                : "percentage-good";

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
                ${stats.totalLectures}
            </td>

            <td>
                ${stats.present}
            </td>

            <td class="${percentageClass}">
                ${stats.percentage}%
            </td>

            <td>

                <button
                    class="delete-btn"
                    data-id="${id}">

                    Delete

                </button>

            </td>

        `;

        tbody.appendChild(row);

    });


    document
        .querySelectorAll(".delete-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.id;

                    showConfirm(
                        "Delete this student and their student record?",
                        () => deleteStudent(id)
                    );

                }
            );

        });

}


/* ============================================================
   DELETE STUDENT
============================================================ */

async function deleteStudent(id) {

    const student =
        students[id];

    if (!student) return;

    await remove(
        ref(db, `students/${id}`)
    );

    await createAudit(
        "STUDENT_DELETED",
        `Student ${student.roll} - ${student.name} deleted`
    );

    alert("Student deleted.");

}


/* ============================================================
   SEARCH STUDENTS
============================================================ */

document
    .getElementById("studentSearch")
    .addEventListener(
        "input",
        renderStudents
    );


/* ============================================================
   ATTENDANCE INITIALIZATION
============================================================ */

function initializeAttendance() {

    currentAttendance = {};

    Object.keys(students)
        .forEach(id => {

            currentAttendance[id] =
                "absent";

        });

}


/* ============================================================
   RENDER ATTENDANCE
============================================================ */

function renderAttendance() {

    const search =
        attendanceSearch.value
            .toLowerCase();

    attendanceList.innerHTML = "";

    const list =
        Object.entries(students)
            .filter(([id, student]) => {

                return (
                    student.name
                        .toLowerCase()
                        .includes(search)

                    ||

                    student.roll
                        .toLowerCase()
                        .includes(search)
                );

            })
            .sort((a, b) =>
                a[1].roll.localeCompare(
                    b[1].roll,
                    undefined,
                    { numeric: true }
                )
            );


    if (!list.length) {

        attendanceList.innerHTML = `
            <div class="empty-state">
                No students found.
            </div>
        `;

        updateAttendanceSummary();

        return;
    }


    list.forEach(([id, student]) => {

        if (!currentAttendance[id]) {

            currentAttendance[id] =
                "absent";

        }

        const status =
            currentAttendance[id];


        const row =
            document.createElement("div");

        row.className =
            "attendance-row";


        row.innerHTML = `

            <div class="roll">
                ${escapeHTML(student.roll)}
            </div>

            <div class="student-name">
                ${escapeHTML(student.name)}
            </div>

            <div class="attendance-status">
                ${
                    status === "present"
                    ? "✓ Present"
                    : "✕ Absent"
                }
            </div>

            <button
                class="attendance-btn present-btn
                ${status === "present" ? "active" : ""}"
                data-id="${id}"
                data-status="present">

                ✓ Present

            </button>

            <button
                class="attendance-btn absent-btn
                ${status === "absent" ? "active" : ""}"
                data-id="${id}"
                data-status="absent">

                ✕ Absent

            </button>

        `;

        attendanceList.appendChild(row);

    });


    document
        .querySelectorAll(".attendance-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.id;

                    const status =
                        button.dataset.status;

                    currentAttendance[id] =
                        status;

                    renderAttendance();

                    updateAttendanceSummary();

                }
            );

        });


    updateAttendanceSummary();

}


/* ============================================================
   SEARCH ATTENDANCE
============================================================ */

attendanceSearch.addEventListener(
    "input",
    renderAttendance
);


/* ============================================================
   MARK ALL PRESENT
============================================================ */

document
    .getElementById("markAllPresentBtn")
    .addEventListener("click", () => {

        Object.keys(students)
            .forEach(id => {

                currentAttendance[id] =
                    "present";

            });

        renderAttendance();

    });


/* ============================================================
   MARK ALL ABSENT
============================================================ */

document
    .getElementById("markAllAbsentBtn")
    .addEventListener("click", () => {

        Object.keys(students)
            .forEach(id => {

                currentAttendance[id] =
                    "absent";

            });

        renderAttendance();

    });


/* ============================================================
   SUMMARY
============================================================ */

function updateAttendanceSummary() {

    const ids =
        Object.keys(students);

    const total =
        ids.length;

    let present = 0;

    ids.forEach(id => {

        if (
            currentAttendance[id] ===
            "present"
        ) {

            present++;

        }

    });

    const absent =
        total - present;

    const percentage =
        total
            ? ((present / total) * 100)
                .toFixed(1)
            : "0.0";


    totalStudents.textContent =
        total;

    presentCount.textContent =
        present;

    absentCount.textContent =
        absent;

    lecturePercentage.textContent =
        `${percentage}%`;

}


/* ============================================================
   SAVE ATTENDANCE
============================================================ */

document
    .getElementById("saveAttendanceBtn")
    .addEventListener("click", saveAttendance);


async function saveAttendance() {

    const date =
        attendanceDate.value;

    const classValue =
        className.value.trim();

    const subject =
        subjectName.value.trim();


    if (!date) {

        alert("Please select date.");

        return;
    }

    if (!classValue) {

        alert("Please enter class.");

        return;
    }

    if (!subject) {

        alert("Please enter subject.");

        return;
    }

    if (!Object.keys(students).length) {

        alert("Add students first.");

        return;
    }


    const attendance = {};


    Object.keys(students)
        .forEach(id => {

            attendance[id] =
                currentAttendance[id] ||
                "absent";

        });


    const lectureId =
        createLectureId(
            date,
            classValue,
            subject
        );


    const existing =
        await get(
            ref(db, `attendance/${lectureId}`)
        );


    if (existing.exists()) {

        const overwrite =
            confirm(
                "Attendance for this date/class/subject already exists. Replace it?"
            );

        if (!overwrite) return;

    }


    const present =
        Object.values(attendance)
            .filter(x => x === "present")
            .length;

    const absent =
        Object.values(attendance)
            .filter(x => x === "absent")
            .length;


    const lectureData = {

        date,

        className:
            classValue,

        subject,

        attendance,

        present,

        absent,

        total:
            Object.keys(students).length,

        percentage:
            Number(
                (
                    present /
                    Object.keys(students).length *
                    100
                ).toFixed(2)
            ),

        teacher:
            currentUser.email,

        createdAt:
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()

    };


    await set(
        ref(db, `attendance/${lectureId}`),
        lectureData
    );


    await createAudit(
        "ATTENDANCE_SAVED",
        `${date} | ${classValue} | ${subject}`
    );


    alert(
        "✓ Attendance saved and synchronized."
    );


    initializeAttendance();

    renderAttendance();

}


/* ============================================================
   CREATE LECTURE ID
============================================================ */

function createLectureId(
    date,
    classValue,
    subject
) {

    return (
        `${date}_${classValue}_${subject}`
    )
        .replace(/[.#$[\]/\s]/g, "_");

}


/* ============================================================
   STUDENT ATTENDANCE STATISTICS
============================================================ */

function calculateStudentStats(studentId) {

    let totalLectures = 0;

    let present = 0;


    Object.values(attendanceRecords)
        .forEach(record => {

            if (
                record.attendance &&
                record.attendance[studentId]
            ) {

                totalLectures++;

                if (
                    record.attendance[studentId]
                    === "present"
                ) {

                    present++;

                }

        
