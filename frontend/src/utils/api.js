/**
 * API configuration helper.
 * If VITE_API_URL is configured (e.g. on Vercel), requests will target the Railway backend directly.
 * In local development without VITE_API_URL, requests default to '' which uses Vite's local dev proxy.
 */
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
}
