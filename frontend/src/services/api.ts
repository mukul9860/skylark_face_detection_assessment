import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const startStream = async (
  cameraId: string,
  rtspUrl: string,
  faceDetectionEnabled: boolean
) => {
  return apiClient.post("/worker/start-stream", {
    cameraId,
    rtspUrl,
    faceDetectionEnabled,
  });
};

export const stopStream = async (cameraId: string) => {
  return apiClient.post("/worker/stop-stream", { cameraId });
};

export default apiClient;
