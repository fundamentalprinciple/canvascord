import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

export async function checkBackendHealth() {
  const response = await api.get("/health");
  return response.data;
}
