import { api } from "./api";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/api/auth/register", {
    username,
    email,
    password,
  });
  return response.data;
}

export async function login(
  identifier: string,
  password: string,
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/api/auth/login", {
    identifier,
    password,
  });
  return response.data;
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  const response = await api.get<{ user: AuthUser }>("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.user;
}
