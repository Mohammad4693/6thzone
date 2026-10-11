import axios from 'axios';

const API_URL = '/api';

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Attach token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('seraj_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('seraj_token');
      localStorage.removeItem('seraj_user');
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
