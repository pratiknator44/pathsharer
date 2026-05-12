import { API_URL } from './api';

/** Strip /api/v1 to get the raw server origin for Socket.IO */
function resolveSocketUrl(): string {
  try {
    const url = new URL(API_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'http://localhost:5000';
  }
}

export const SOCKET_URL = resolveSocketUrl();
