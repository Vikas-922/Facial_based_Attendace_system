// src/services/api.js
export async function loginAPI(credentials) {
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return response.json();
  }
  
  export async function registerStudentAPI(studentData) {
    const response = await fetch('http://localhost:5000/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    return response.json();
  }
  
  // Mark attendance for an individual student
  export async function markAttendanceAPI(attendanceData) {
    const response = await fetch('http://localhost:5000/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceData),
    });
    return response.json();
  }

  // Mark attendance for an individual student
  export async function markAllStudentAbsentAPI(Data) {
    const response = await fetch('http://localhost:5000/api/mark_absent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Data),
    });
    return response.json();
  }


// Fetch students based on filters (course, class_year, division)
export async function fetchStudentsAPI(filters) {
  const queryString = new URLSearchParams(filters).toString();
  try {
    const response = await fetch(`http://localhost:5000/api/students?${queryString}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return await response.json();
  } catch (error) {
    return { error: error.message || 'Network error' };
  }
}

// Mark attendance in batch (for multiple students at once)
export async function markBatchAttendanceAPI(attendanceBatch) {
  try {
    const response = await fetch('http://localhost:5000/api/attendance/mark_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceBatch)
    });
    return await response.json();
  } catch (error) {
    return { error: error.message || 'Network error' };
  }
}


// Mark attendance in batch (for multiple students at once)
export async function markBatchFacialAttendanceAPI(attendanceBatch) {
  try {
    const response = await fetch('http://localhost:5000/api/attendance/batch_facial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceBatch)
    });
    return await response.json();
  } catch (error) {
    return { error: error.message || 'Network error' };
  }
}

// Fetch subjects assigned to the logged-in teacher
export async function fetchTeacherSubjectsAPI(teacherId) {
  try {
    // This assumes that your backend supports a query parameter `teacherId` to fetch subjects
    const response = await fetch(`http://localhost:5000/api/teachers/subjects?teacherId=${teacherId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return await response.json();
  } catch (error) {
    return { error: error.message || 'Network error' };
  }
}

export async function fetchAttendanceViewAPI(filters) {
  const queryString = new URLSearchParams(filters).toString();
  try {
    const response = await fetch(`http://localhost:5000/api/attendance/view?${queryString}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return await response.json();
  } catch (error) {
    return { error: error.message || 'Network error' };
  }
}


// Check Attendance Status API
export const checkAttendanceStatusAPI = async ({ subject_id }) => {
  try {
    const response = await fetch(`http://localhost:5000/api/attendance/status?subject_id=${subject_id}`);
    return await response.json();
  } catch (error) {
    return { error: "Network error" };
  }
};

// Toggle Attendance Status API (uses the /api/attendance/enable endpoint)
export const toggleAttendanceStatusAPI = async ({ subject_id, enabled }) => {
  try {
    const response = await fetch(`http://localhost:5000/api/attendance/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id, enabled }),
    });
    return await response.json();
  } catch (error) {
    return { error: "Network error" };
  }
};


