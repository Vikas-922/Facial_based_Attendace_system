// src/components/StudentDashboard.js
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Webcam from "react-webcam";
import { FaUserPlus,FaClipboardList,FaEye,FaCheckCircle,FaCamera, FaUserGraduate } from "react-icons/fa";
import '../styles/StudentDashboard.css';

export default function StudentDashboard() {
  // Get user details from local storage
  const userType = localStorage.getItem('userType');
  const studentId = localStorage.getItem('userId') || 'S00001';
  
  // States for student details and enrolled subjects
  const [studentDetails, setStudentDetails] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  
  // States for face registration and attendance capture images
  const [registrationImage, setRegistrationImage] = useState(null);
  const [attendanceImage, setAttendanceImage] = useState(null);
  
  // Attendance related states
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0,10));
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  
  // Modal state and webcam reference for attendance capture
  const [showCameraModal, setShowCameraModal] = useState(false);
  const webcamRef = useRef(null);

  // Navigation state for showing sections
  const [activeSection, setActiveSection] = useState('viewAttendance');

  useEffect(() => {
    if (userType !== 'student') {
      toast.error("Access denied: Only students can access this dashboard");
      return;
    }
    
    // Fetch student details using the stored studentId
    const fetchStudentDetails = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/students/${studentId}`);
        const data = await response.json();
        if(data.error) {
          toast.error(data.error);
        } else {
          setStudentDetails(data.student);
          // Once student details are received, fetch the subjects based on course and class_year
          fetchSubjects(data.student.course, data.student.class_year);
        }
      } catch (error) {
        toast.error("Network error while fetching student details");
      }
    };

    // Fetch subjects for the student based on course and class year.
    const fetchSubjects = async (course, class_year) => {
      try {
        const response = await fetch(`http://localhost:5000/api/subjects?course=${course}&class_year=${class_year}`);
        const data = await response.json();
        if(data.error) {
          toast.error(data.error);
        } else {
          setSubjects(data.subjects);
          if(data.subjects.length > 0) {
            setSelectedSubject(data.subjects[0].subject_id);
          }
        }
      } catch (error) {
        toast.error("Network error while fetching subjects");
      }
    };

    fetchStudentDetails();
  }, [studentId, userType]);

  // Handler for uploading image for face registration
  const handleRegistrationImageUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setRegistrationImage(reader.result);
    if (file) reader.readAsDataURL(file);
  };

  // Open the camera modal for attendance capture
  const openCameraModal = () => {
    setShowCameraModal(true);
  };

  // Capture image from webcam and close modal
  const captureAttendanceImage = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setAttendanceImage(imageSrc);
      setShowCameraModal(false);
      toast.success("Image captured successfully");
    }
  };

  const closeCameraModal = () => {
    setShowCameraModal(false);
  };

  // API call to register face using the uploaded registration image
  const registerFace = async () => {
    if (!registrationImage) {
      toast.error("Please upload an image for face registration");
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000/api/students/${studentId}/face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: registrationImage })
      });
      const data = await response.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success(data.message || "Face registered successfully");
        // Update face_registered status in UI
        setStudentDetails(prev => ({ ...prev, face_registered: true }));
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  // API call to mark attendance using the captured Facial image
  const markAttendance = async () => {
    if (!attendanceImage) {
      toast.error("Please capture an image from the camera for attendance");
      return;
    }
    if (!selectedSubject) {
      toast.error("Please select a subject");
      return;
    }
    const payload = {
      student_id: studentId,
      subject_id: selectedSubject,
      status: "present",
      image: attendanceImage,
      teacher_marked: false,
      date: attendanceDate
    };
    try {
      const response = await fetch("http://localhost:5000/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if(data.error) toast.error(data.error);
      else {
        toast.success(data.message || "Attendance marked successfully");
        fetchAttendance();
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  // API call to fetch attendance records
  const fetchAttendance = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/attendance?student_id=${studentId}&date=${attendanceDate}`);
      const data = await response.json();
      console.log("attendance data", data);
      
      if (data.error) toast.error(data.error);
      else {
        setAttendanceRecords(data.attendance);
        toast.success("Attendance fetched successfully");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  useEffect(() => {
    if (activeSection === 'viewAttendance') {
      fetchAttendance();
    }
  }, [activeSection]);

  return (
    <div className="student-dashboard container">
      <h1 className="dashboard-title">Student Dashboard</h1>
      
      {/* Navigation Buttons */}
      <div className="dashboard-nav">
        <button 
          className={`nav-button ${activeSection === 'viewAttendance' ? 'active' : ''}`} 
          onClick={() => setActiveSection('viewAttendance')}
        >
          <FaEye/> View Attendance
        </button>
        <button 
          className={`nav-button ${activeSection === 'markAttendance' ? 'active' : ''}`} 
          onClick={() => setActiveSection('markAttendance')}
        >
          <FaCheckCircle /> Mark Attendance
        </button>
        <button 
          className={`nav-button ${activeSection === 'registerFace' ? 'active' : ''}`} 
          onClick={() => setActiveSection('registerFace')}
        >
          <FaCamera /> Register Face
        </button>
        <button 
          className={`nav-button ${activeSection === 'studentDetails' ? 'active' : ''}`} 
          onClick={() => setActiveSection('studentDetails')}
        >
          <FaUserGraduate /> Student Details
        </button>
      </div>

      {/* Student Details Section */}
      {activeSection === 'studentDetails' && studentDetails && (
        <div className="card student-details">
          <h2>Student Details</h2>
          <p><strong>ID:</strong> {studentDetails.student_id}</p>
          <p><strong>Name:</strong> {studentDetails.name}</p>
          <p><strong>Course:</strong> {studentDetails.course}</p>
          <p><strong>Class Year:</strong> {studentDetails.class_year}</p>
          <p><strong>Division:</strong> {studentDetails.division}</p>
          <p>
            <strong>Face Registered:</strong>{" "}
            {studentDetails.face_registered ? (
              <span className="status-indicator registered">Yes</span>
            ) : (
              <span className="status-indicator not-registered">No</span>
            )}
          </p>
        </div>
      )}

      {/* Register Face Section */}
      {activeSection === 'registerFace' && (
        <div className="card register-face">
          <h2>Register Face</h2>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleRegistrationImageUpload} 
            className="file-input"
          />
          <button onClick={registerFace} className="submit-button">Register Face</button>
        </div>
      )}

      {/* Mark Attendance Section */}
      {activeSection === 'markAttendance' && (
        <div className="card mark-attendance">
          <h2>Mark Attendance</h2>
          <div className="subject-selection">
            <label htmlFor="subject-select">Select Subject: </label>
            <select 
              id="subject-select" 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="subject-dropdown"
            >
              {subjects.map((subject) => (
                <option key={subject.subject_id} value={subject.subject_id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div className="date-selection">
            <label htmlFor="attendance-date">Select Date: </label>
            <input 
              type="date" 
              id="attendance-date" 
              value={attendanceDate} 
              onChange={(e) => setAttendanceDate(e.target.value)} 
              className="date-input"
            />
          </div>
          <div className="attendance-actions">
            <button onClick={openCameraModal} className="capture-button">
            <FaCamera/> Capture Attendance Image
            </button>
            {attendanceImage && (
              <div className="captured-image-preview">
                <img src={attendanceImage} alt="Captured Attendance" />
              </div>
            )}
            <button onClick={markAttendance} className="submit-button">
              Mark Attendance
            </button>
          </div>
        </div>
      )}

      {/* View Attendance Section */}
      {activeSection === 'viewAttendance' && (
        <div className="card view-attendance">
          <h2>View Attendance</h2>
          <div className="attendance-filter">
            <input 
              type="date" 
              value={attendanceDate} 
              onChange={(e) => setAttendanceDate(e.target.value)} 
              className="date-input"
            />
            <button onClick={fetchAttendance} className="fetch-button">
              Fetch Attendance
            </button>
          </div>
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map((record, index) => (
                <tr key={index}>
                  <td>{record.subject_name}</td>
                  <td>
                    <span className={`status-badge ${record.status === "present" ? "present" : "absent"}`}>
                      {record.status === "present" ? "P" : "A"}
                    </span>
                  </td>
                  <td>{record.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Camera Modal for Attendance Capture */}
      {showCameraModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Capture Image</h3>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="webcam-view"
              videoConstraints={{
                facingMode: "user"
              }}
            />
            <div className="modal-actions">
              <button onClick={captureAttendanceImage} className="capture-button">Capture</button>
              <button onClick={closeCameraModal} className="cancel-button">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
