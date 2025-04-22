// src/components/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import '../styles/AdminDashboard.css'; // Import CSS file

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('addTeacher');
  const [teacherName, setTeacherName] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');

  const [subjectName, setSubjectName] = useState('');
  const [course, setCourse] = useState('');
  const [classYear, setClassYear] = useState('');

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
  }, []);

  const fetchTeachers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/teachers');
      const data = await response.json();
      if (data.error) toast.error(data.error);
      else setTeachers(data.teachers);
    } catch (error) {
      toast.error("Network error while fetching teachers");
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/subjects');
      const data = await response.json();
      if (data.error) toast.error(data.error);
      else setSubjects(data.subjects);
    } catch (error) {
      toast.error("Network error while fetching subjects");
    }
  };

  const addTeacher = async () => {
    if (!teacherName.trim()) {
      toast.error("Teacher name is required");
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teacherName })
      });
      const data = await response.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success("Teacher added successfully");
        setTeacherName('');
        fetchTeachers();
      }
    } catch (error) {
      toast.error("Network error while adding teacher");
    }
  };

  const removeTeacher = async (teacherId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/teachers/${teacherId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success("Teacher removed successfully");
        fetchTeachers();
      }
    } catch (error) {
      toast.error("Network error while removing teacher");
    }
  };

  // Add Subject
  const addSubject = async () => {
    if (!subjectName.trim() || !course.trim() || !classYear.trim()) {
      toast.error("All fields are required");
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subjectName, course, class_year: classYear })
      });
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Subject added successfully");
        setSubjectName('');
        setCourse('');
        setClassYear('');
        fetchSubjects();
      }
    } catch (error) {
      toast.error("Network error while adding subject");
    }
  };

  const assignSubject = async () => {
    if (!assignTeacherId || !assignSubjectId) {
      toast.error("Both teacher and subject must be selected");
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/subjects/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: assignTeacherId, subject_id: assignSubjectId })
      });
      const data = await response.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success("Subject assigned successfully");
        fetchSubjects();
      }
    } catch (error) {
      toast.error("Network error while assigning subject");
    }
  };

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      <div className="tabs">
        <button onClick={() => setActiveTab('addTeacher')} className={`tab-button ${activeTab === 'addTeacher' ? 'active' : ''}`}>
          Add Teacher
        </button>
        <button onClick={() => setActiveTab('manageTeachers')} className={`tab-button ${activeTab === 'manageTeachers' ? 'active' : ''}`}>
          Manage Teachers
        </button>
        <button onClick={() => setActiveTab('assignSubject')} className={`tab-button ${activeTab === 'assignSubject' ? 'active' : ''}`}>
          Assign Subject
        </button>
        <button onClick={() => setActiveTab('addSubject')} className={`tab-button ${activeTab === 'addSubject' ? 'active' : ''}`}>
          Add Subject
        </button>
      </div>

      {activeTab === 'addTeacher' && (
        <div className="card">
          <h2>Add a New Teacher</h2>
          <div>
            <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Teacher Name" className="input-field" />
          </div>
          <button onClick={addTeacher} className="submit-button">Add Teacher</button>
        </div>
      )}

      {activeTab === 'manageTeachers' && (
        <div className="card">
          <h2>Teachers List</h2>
          {teachers.length === 0 ? (
            <p>No teachers found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Teacher ID</th>
                  <th>Name</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.teacher_id}>
                    <td>{teacher.teacher_id}</td>
                    <td>{teacher.name}</td>
                    <td>
                      <button onClick={() => removeTeacher(teacher.teacher_id)} className="remove-button">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'assignSubject' && (
        <div className="card">
          <h2>Assign Subject to Teacher</h2>
          <div className='input-box'>
            <label>Select Teacher</label>
            <select value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)} className="input-field">
              <option value="">Select a teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.teacher_id} value={teacher.teacher_id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>
          <div className='input-box'>
            <label>Select Subject</label>
            <select value={assignSubjectId} onChange={(e) => setAssignSubjectId(e.target.value)} className="input-field">
              <option value="">Select a subject</option>
              {subjects.map((subject) => (
                <option key={subject.subject_id} value={subject.subject_id}>
                  {subject.name} ({subject.class_year} - {subject.course})
                </option>
              ))}
            </select>
          </div>
          <button onClick={assignSubject} className="submit-button">Assign Subject</button>
        </div>
      )}
      {activeTab === 'addSubject' && (
        <div className="card">
          <h2>Add a New Subject</h2>
          <div>
            <input
              type="text"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="Subject Name"
              className="input-field"
            />
          </div>
          <div>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="Course   Ex. BSC IT"
              className="input-field"
            />
          </div>
          <div>            
            <input
              type="text"
              value={classYear}
              onChange={(e) => setClassYear(e.target.value)}
              placeholder="Class Year   Ex. FY, SY, TY "
              className="input-field"
            />
          </div>
          <button
            onClick={addSubject}
            className="submit-button"
          >
            Add Subject
          </button>
        </div>
      )}
    </div>
  );
}
