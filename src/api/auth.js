// src/api/auth.js

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export function saveToken(token) {
  localStorage.setItem("metu-token", token);
}

export function getToken() {
  return localStorage.getItem("metu-token") ?? null;
}

export function clearToken() {
  localStorage.removeItem("metu-token");
  localStorage.removeItem("metu-user");
}


export function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function validateCasTicket(ticket, service) {
  const res = await fetch(`${BASE_URL}/api/auth/cas/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, service }),
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? "CAS doğrulama başarısız.");
  }

  return data; 
}