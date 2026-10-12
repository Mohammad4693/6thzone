import axios from 'axios';

// VITE_API_BASE: full backend origin for the BROWSER (e.g.
// https://seraj-api.onrender.com). Empty in dev — the Vite dev-server proxy
// forwards /api to the backend. (VITE_API_URL is the dev-proxy target inside
// the container and must never reach browser code.)
const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

// Wake-up handling: the Render free web service sleeps after 15 idle minutes.
// While the backend is waking (network errors / 502 / 504 / timeout), the UI
// shows "سامانه در حال آماده‌سازی است" and retries automatically — the user
// never sees an error page.
type WakeListener = (waking: boolean) => void;
let wakeListener: WakeListener | null = null;
export function setWakeListener(fn: WakeListener | null) {
  wakeListener = fn;
}

export const client = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 90000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('seraj_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const WAKE_MAX_RETRIES = 15;
const WAKE_RETRY_DELAY_MS = 4000;

client.interceptors.response.use(
  (response) => {
    wakeListener?.(false);
    return response;
  },
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    // A waking server produces network-level failures or gateway errors.
    // 503 is NOT included: the app itself uses 503 for "AI not configured".
    const waking =
      !error.response || status === 502 || status === 504 || error.code === 'ECONNABORTED';

    if (waking) {
      const count = ((config as any).__serajWakeCount || 0) + 1;
      (config as any).__serajWakeCount = count;
      if (count <= WAKE_MAX_RETRIES) {
        wakeListener?.(true);
        await new Promise((r) => setTimeout(r, WAKE_RETRY_DELAY_MS));
        return client.request(config);
      }
    }

    wakeListener?.(false);

    if (status === 401) {
      localStorage.removeItem('seraj_token');
      localStorage.removeItem('seraj_user');
      const path = window.location.pathname;
      if (path !== '/' && path !== '/login' && !path.startsWith('/m/')) {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
