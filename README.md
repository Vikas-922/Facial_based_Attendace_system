# 🎓 Facial Recognition-Based Attendance Web App

This is a web-based attendance management system that uses **facial recognition technology** to automate and secure the process of marking attendance. The system supports **three types of users**: Admin, Teacher, and Student.

---

## 🔐 User Roles & Features

### 🛠️ Admin
- Add and manage teachers
- Add subjects
- Assign subjects to teachers

### 👨‍🏫 Teacher
- Take attendance in two ways:
  1. **Manual Mode**: Mark students as present or absent manually
  2. **Camera Mode**: System captures batch images periodically and marks attendance of recognized faces
- Allow/Disallow students to mark their own attendance
- View attendance records in a table format

### 👨‍🎓 Student
- View their personal attendance records
- Mark attendance (if allowed by the teacher) by:
  - Validating their face using a live image captured via camera

---

## 🧑‍💻 Tech Stack

| Technology | Purpose |
|------------|---------|
| **React JS** | Frontend (user interface) |
| **Python Flask** | Backend server & APIs |
| **OpenCV** | Facial recognition and image processing |
| **MongoDB** | Database to store user and attendance data |

---

  <a href="https://res.cloudinary.com/denezzat5/video/upload/v1745470638/OTHER/bdhoqdktqjqnwepzncaf.mp4" target="_blank">
   ▶️ Watch Video demo 
  </a>


