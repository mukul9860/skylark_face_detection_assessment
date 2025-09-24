import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

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

export const startStream = async (cameraId: number | string) => {
  return apiClient.post(`/cameras/${cameraId}/start`);
};

export const stopStream = async (cameraId: number | string) => {
  return apiClient.post(`/cameras/${cameraId}/stop`);
};
  
export default apiClient;