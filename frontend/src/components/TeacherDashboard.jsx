import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  registerStudentAPI, 
  markAttendanceAPI, 
  fetchTeacherSubjectsAPI,
  fetchAttendanceViewAPI, // For viewing attendance data
  markBatchAttendanceAPI,
  markBatchFacialAttendanceAPI,
  markAllStudentAbsentAPI,
  toggleAttendanceStatusAPI,
  checkAttendanceStatusAPI
} from '../services/api';
import { FaUserPlus,FaClipboardList,FaEye,FaCheckCircle,FaCamera, FaUserGraduate } from "react-icons/fa";

import '../styles/TeacherDashboard.css';

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('view');
  const teacherId = localStorage.getItem('userId') || 'T001';
  const [attendanceEnabled, setAttendanceEnabled] = useState(null);
  const [show, setShow] = useState(false); // at first not show attendace enable btn


  // ------------------
  // Register Student Tab
  // ------------------
  const [studentData, setStudentData] = useState({
    name: '',
    age: '',
    dob: '',
    course: '',
    class_year: '',
    division: ''
  });

  const handleStudentRegistration = async () => {
    if (!studentData.name || !studentData.age || !studentData.dob || !studentData.course || !studentData.class_year || !studentData.division) {
      toast.error("Please fill in all student details");
      return;
    }
    try {
      const data = await registerStudentAPI(studentData);
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Student registered successfully");
        setStudentData({ name: '', age: '', dob: '', course: '', class_year: '', division: '' });
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  // ------------------
  // Live Facial Attendance State & Functions
  // ------------------
  // Filter state for facial attendance (similar to view attendance filter)
  const [facialFilters, setFacialFilters] = useState({
    course: 'BSC IT',
    class_year: '',
    division: '',
    subject_id: '',
    date: new Date().toISOString().slice(0, 10)
  });

  // New state for controlling the modal popup
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Camera and capturing states
  const [capturedImages, setCapturedImages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [sendingBatch, setSendingBatch] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureIntervalRef = useRef(null);

  // Start camera and begin capturing frames every 1.5 seconds
  const startCamera = async () => {    
    await markAllStudentAbsent();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setLogs(prev => [...prev, "Camera started."]);
      captureIntervalRef.current = setInterval(captureImage, 1500);
    } catch (error) {
      toast.error("Unable to access camera");
    }
  };

  // Stop the camera and clear the capture interval
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    setLogs(prev => [...prev, "Camera stopped."]);
  };

  // Toggle modal: when opening, start the camera; when closing, stop it
  const toggleModal = () => {
    if (isModalOpen) {
      stopCamera();
      setIsModalOpen(false);
    } else {
      // Ensure subject (and other necessary filters) are selected before starting capturing
      if (!facialFilters.course || !facialFilters.class_year || !facialFilters.subject_id) {
        toast.error("Please set Course, Class Year, and Subject before starting.");
        return;
      }
      startCamera();
      setIsModalOpen(true);
    }
  };

  // Capture a frame from the video feed and store as a base64 image
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg');
    setCapturedImages(prev => [...prev, imageBase64]);
  };


  const markAllStudentAbsent = async () => {
    if (!viewFilters.subject_id) {
      toast.error("Please select a subject");
      return;
    }
    const payload = {
      subject_id: viewFilters.subject_id,
      date: viewFilters.date,
      teacher_id: teacherId
    };
    try {
      const response = await markAllStudentAbsentAPI(payload);
      if (response.error) {
        toast.error(response.error);
      }
    } catch (error) {
      toast.error("Network error");
    }
  }

  // Send a batch of 7 images to the backend for attendance marking
  const sendBatchImages = async () => {
    if (sendingBatch || capturedImages.length < 7) return;
    setSendingBatch(true);
    const batch = capturedImages.slice(0, 7);
    const payload = {
      images: batch,
      subject_id: facialFilters.subject_id,
      date: facialFilters.date,
      teacher_id: teacherId
    };
    try {
      const response = await markBatchFacialAttendanceAPI(payload);
      const msg = response.message || "Batch processed";
      toast.success(msg);
      setLogs(prev => [...prev, msg]);
      // Remove the processed images from the array
      setCapturedImages(prev => prev.slice(7));
    } catch (error) {
      toast.error("Error sending batch.");
      setLogs(prev => [...prev, "Error sending batch."]);
    } finally {
      setSendingBatch(false);
    }
  };

  // Monitor captured images and send batch when there are at least 7 images
  useEffect(() => {
    if (!sendingBatch && capturedImages.length >= 7) {
      sendBatchImages();
    }
  }, [capturedImages, sendingBatch]);

  // ------------------
  // View Attendance Tab (unchanged)
  // ------------------
  const [viewFilters, setViewFilters] = useState({
    course: 'BSC IT',
    class_year: '',
    division: '',
    subject_id: '',
    date: new Date().toISOString().slice(0, 10)
  });
  const [studentList, setStudentList] = useState([]);
  
  // State for teacher's subjects (used for both view and facial attendance filters)
  const [teacherSubjects, setTeacherSubjects] = useState([]);

  // Fetch teacher's subjects on component mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const data = await fetchTeacherSubjectsAPI(teacherId);
        if (data.error) {
          toast.error(data.error);
        } else {
          setTeacherSubjects(data.subjects);
          localStorage.setItem('teacherSubjects', JSON.stringify(data.subjects));
        }
      } catch (error) {
        toast.error("Network error");
      }
    };
    fetchSubjects();
  }, [teacherId]);

  // Filter teacher's subjects based on the facial filter selections (for subject dropdown)
  const filteredFacialSubjects = teacherSubjects.filter(subject => {
    return (
      (!facialFilters.course || subject.course === facialFilters.course) &&
      (!facialFilters.class_year || subject.class_year === facialFilters.class_year)
    );
  });

  // Filter for view attendance remains unchanged
  const filteredSubjects = teacherSubjects.filter(subject => {
    return (
      (!viewFilters.course || subject.course === viewFilters.course) &&
      (!viewFilters.class_year || subject.class_year === viewFilters.class_year)
    );
  });

  const handleFetchAttendance = async () => {
    if (!viewFilters.course || !viewFilters.class_year || !viewFilters.division || !viewFilters.subject_id) {
      toast.error("Please select Course, Class Year, Division, and Subject");
      return;
    }
    try {
      const data = await fetchAttendanceViewAPI(viewFilters);
      if (data.error) {
        toast.error(data.error);
      } else {
        setStudentList(data.students);
        toast.success("Attendance fetched successfully");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  const handleStatusToggle = (index) => {
    const updatedStudents = [...studentList];
    updatedStudents[index].status = updatedStudents[index].status === 'present' ? 'absent' : 'present';
    setStudentList(updatedStudents);
  };

  const handleSubmitBatchAttendance = async () => {
    if (!viewFilters.subject_id) {
      toast.error("Please select a subject");
      return;
    }
    const payload = {
      subject_id: viewFilters.subject_id,
      date: viewFilters.date,
      marked_by: teacherId,
      attendances: studentList.map(student => ({
        student_id: student.student_id,
        status: student.status
      }))
    };
    try {
      const response = await markBatchAttendanceAPI(payload);
      if (response.error) {
        toast.error(response.error);
      } else {
        toast.success(response.message || "Batch attendance marked successfully");
        setStudentList([]);
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

// Handler to check the attendance enabled status for the selected subject
const handleCheckAttendanceStatus = async () => {
  if (!viewFilters.subject_id) {
    toast.error("Please select a subject to check status");
    return;
  }
  try {
    // You must add checkAttendanceStatusAPI in your services/api.js accordingly
    const response = await checkAttendanceStatusAPI({ subject_id: viewFilters.subject_id });
    setAttendanceEnabled(response.enabled);
    setShow(true);
    toast.success(`Attendance is ${response.enabled ? "enabled" : "disabled"}`);
  } catch (error) {
    toast.error("Error checking attendance status");
  }
};

// Handler to toggle the attendance enabled status
const handleToggleAttendanceStatus = async () => {
  if (!viewFilters.subject_id) {
    toast.error("Please select a subject to toggle status");
    return;
  }
  try {
    const newStatus = !attendanceEnabled;
    // You must add toggleAttendanceStatusAPI in your services/api.js accordingly
    const response = await toggleAttendanceStatusAPI({ subject_id: viewFilters.subject_id, enabled: newStatus });
    setAttendanceEnabled(newStatus);
    toast.success(`Attendance ${newStatus ? "enabled" : "disabled"}`);
  } catch (error) {
    toast.error("Error toggling attendance status");
  }
};


  return (
    <div className="teacher-dashboard">
      <h1>Teacher Dashboard</h1>
      <div className="tab-buttons">
        <button onClick={() => setActiveTab('view')} className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}>
        <FaClipboardList/> Attendance
        </button>
        <button onClick={() => setActiveTab('attendance')} className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}>
        <FaCamera /> Live Facial Attendance
        </button>
        <button onClick={() => setActiveTab('register')} className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}>
        <FaUserPlus /> Register Student
        </button>
      </div>

      {activeTab === 'register' && (
        <div className="card">
          <h2>Register a New Student</h2>
          <div className="form-grid">
            <input type="text" placeholder="Name" value={studentData.name} onChange={(e) => setStudentData({ ...studentData, name: e.target.value })} className="input-field" />
            <input type="number" placeholder="Age" value={studentData.age} onChange={(e) => setStudentData({ ...studentData, age: e.target.value })} className="input-field" />
            <input type="date" placeholder="DOB" value={studentData.dob} onChange={(e) => setStudentData({ ...studentData, dob: e.target.value })} className="input-field" />
            <input type="text" placeholder="Course (e.g., BSC IT)" value={studentData.course} onChange={(e) => setStudentData({ ...studentData, course: e.target.value })} className="input-field" />
            <input type="text" placeholder="Class Year (FY, SY, TY)" value={studentData.class_year} onChange={(e) => setStudentData({ ...studentData, class_year: e.target.value })} className="input-field" />
            <input type="text" placeholder="Division (A, B, C, D)" value={studentData.division} onChange={(e) => setStudentData({ ...studentData, division: e.target.value })} className="input-field" />
          </div>
          <button onClick={handleStudentRegistration} className="submit-button">Register Student</button>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="card">
          <h2>Live Facial Attendance</h2>
          {/* Facial Attendance Filter Form */}
          <div className="form-grid">
            <input 
              type="text" 
              placeholder="Course" 
              value={facialFilters.course} 
              onChange={(e) => setFacialFilters({ ...facialFilters, course: e.target.value })}
              className="input-field" 
            />
            <select 
              value={facialFilters.class_year} 
              onChange={(e) => setFacialFilters({ ...facialFilters, class_year: e.target.value })}
              className="input-field"
            >
              <option value="">Select Class Year</option>
              <option value="FY">FY</option>
              <option value="SY">SY</option>
              <option value="TY">TY</option>
            </select>
            <select 
              value={facialFilters.division} 
              onChange={(e) => setFacialFilters({ ...facialFilters, division: e.target.value })}
              className="input-field"
            >
              <option value="">Select Division</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
            {/* Subject dropdown populated from teacher's subjects */}
            <select 
              value={facialFilters.subject_id} 
              onChange={(e) => setFacialFilters({ ...facialFilters, subject_id: e.target.value })}
              className="input-field"
            >
              <option value="">Select Subject</option>
              {filteredFacialSubjects.map(subject => (
                <option key={subject.subject_id} value={subject.subject_id}>
                  {subject.name} ({subject.subject_id})
                </option>
              ))}
            </select>
            <input 
              type="date" 
              value={facialFilters.date} 
              onChange={(e) => setFacialFilters({ ...facialFilters, date: e.target.value })}
              className="input-field" 
            />
          </div>
          <button onClick={toggleModal} className="submit-button">
            Start Facial Attendance
          </button>

          {/* Modal Popup for Camera Capture */}
          {isModalOpen && (
            <div className="modal-overlay modal-container">
              <div className="modal modal-content">
                <h3>Camera Capture</h3>
                <video ref={videoRef} autoPlay muted className="video-feed" />
                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <button onClick={toggleModal} className="submit-button">Stop Capturing</button>
                <div className="modal-logs-container">
                  {logs.slice(-3).map((log, index) => (
                    <p key={index} className="modal-log">{log}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Logs displayed in the facial attendance section (all logs) */}
          <div className="facial-logs-container">
            {logs.map((log, index) => (
              <p key={index} className="facial-log">{log}</p>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'view' && (
        <div className="card attendance_section">
          <h2>Attendance</h2>
          <div className="form-grid">
            <input 
              type="text" 
              placeholder="Course" 
              value={viewFilters.course} 
              onChange={(e) => setViewFilters({ ...viewFilters, course: e.target.value })} 
              className="input-field" 
            />
            <select 
              value={viewFilters.class_year} 
              onChange={(e) => setViewFilters({ ...viewFilters, class_year: e.target.value })}
              className="input-field"
            >
              <option value="">Select Class Year</option>
              <option value="FY">FY</option>
              <option value="SY">SY</option>
              <option value="TY">TY</option>
            </select>
            <select 
              value={viewFilters.division} 
              onChange={(e) => setViewFilters({ ...viewFilters, division: e.target.value })} 
              className="input-field"
            >
              <option value="">Select Division</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
            {/* Subject dropdown populated from teacher's subjects */}
            <select 
              value={viewFilters.subject_id} 
              onChange={(e) => setViewFilters({ ...viewFilters, subject_id: e.target.value })} 
              className="input-field"
            >
              <option value="">Select Subject</option>
              {filteredSubjects.map(subject => (
                <option key={subject.subject_id} value={subject.subject_id}>
                  {subject.name} ({subject.subject_id})
                </option>
              ))}
            </select>
            <input 
              type="date" 
              value={viewFilters.date} 
              onChange={(e) => setViewFilters({ ...viewFilters, date: e.target.value })} 
              className="input-field" 
            />

          </div>
            <button onClick={handleFetchAttendance} className="submit-button">
              Fetch Attendance
            </button>
            <div className="status-buttons" style={{ display: 'inline-block', marginLeft: '10px' }}>
            <button onClick={handleCheckAttendanceStatus} className="btn-bg2">
                Check Status
            </button>
            {show && (<button onClick={handleToggleAttendanceStatus} className="submit-button" style={{ backgroundColor: attendanceEnabled ? 'red' : 'green' }}>
                {attendanceEnabled ? "Disable Attendance" : "Enable Attendance"}
            </button>)}
            </div>
          {studentList.length > 0 && (
            <div className="attendance-table">
              <table>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentList.map((student, index) => (
                    <tr key={student.student_id}>
                      <td>{student.student_id}</td>
                      <td>{student.name}</td>
                      <td>
                        <button 
                          onClick={() => handleStatusToggle(index)}
                          className={`toggle-button ${student.status}`}
                        >
                          {student.status === 'present' ? 'Present' : 'Absent'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={handleSubmitBatchAttendance} className="submit-button">
                Submit Attendance
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
