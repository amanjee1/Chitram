import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ---- Token storage (localStorage) ----
const ACCESS_KEY = 'chitram_access';
const REFRESH_KEY = 'chitram_refresh';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: ({ accessToken, refreshToken }) => {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({ baseURL: API_URL });

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401, try to refresh the token once, then replay the original request.
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const refreshToken = tokenStore.getRefresh();

    const isAuthRoute = original?.url?.includes('/auth/refresh') || original?.url?.includes('/auth/login');

    if (status === 401 && refreshToken && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        // Coalesce concurrent refreshes into a single request.
        refreshing =
          refreshing ||
          axios.post(`${API_URL}/auth/refresh`, { refreshToken }).then((r) => r.data);
        const data = await refreshing;
        refreshing = null;
        tokenStore.set(data);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        refreshing = null;
        tokenStore.clear();
        // Let the AuthContext react to the cleared session.
        window.dispatchEvent(new Event('chitram:logout'));
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

// Normalize backend error messages.
export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';

export default api;
