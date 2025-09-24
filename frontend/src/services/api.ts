import axios from 'axios';

const apiClient = axios.create();
let isConfigured = false;

const configureApiClient = async () => {
  if (isConfigured) return;
  try {
    const response = await fetch('/config.json');
    const config = await response.json();
    apiClient.defaults.baseURL = config.VITE_API_BASE_URL;
    isConfigured = true; // Set flag to true
    console.log('API client configured with baseURL:', config.VITE_API_BASE_URL);
  } catch (error) {
    console.error('Failed to load app configuration:', error);
  }
};

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export const isApiClientConfigured = () => isConfigured;

export const startStream = async (cameraId: number | string) => {
  return apiClient.post(`/cameras/${cameraId}/start`);
};

export const stopStream = async (cameraId: number | string) => {
  return apiClient.post(`/cameras/${cameraId}/stop`);
};
  
export { apiClient, configureApiClient };