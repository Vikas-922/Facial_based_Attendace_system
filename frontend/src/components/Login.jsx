// src/components/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginAPI } from '../services/api';
import '../styles/Login.css';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  // const [role, setRole] = useState('teacher'); // teacher, student, admin
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!userId || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      const data = await loginAPI({ user_id: userId, password });
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Login successful!");
        // Store login info if needed (e.g., in localStorage)
        localStorage.setItem('userType', data.user_type);
        localStorage.setItem('userId', userId);
        if (data.user_type === 'teacher') navigate('/teacher');
        else if (data.user_type === 'student') navigate('/student');
        else if (data.user_type === 'admin') navigate('/admin');
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">Login</h2>
        <div className="login-field">
          <label className="login-label">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter your ID"
            className="login-input"
          />
        </div>
        <div className="login-field">
          <label className="login-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="login-input"
          />
        </div>
        <button onClick={handleLogin} className="login-button">
          Login
        </button>
      </div>
    </div>
  );
}
