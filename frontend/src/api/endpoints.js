import api from './client.js';
export { errMsg } from './client.js';

// Thin wrappers around the backend REST API. Each returns response.data.
const data = (p) => p.then((r) => r.data);

export const authApi = {
  register: (body) => data(api.post('/auth/register', body)),
  login: (body) => data(api.post('/auth/login', body)),
  refresh: (refreshToken) => data(api.post('/auth/refresh', { refreshToken })),
  logout: (refreshToken) => data(api.post('/auth/logout', { refreshToken })),
  me: () => data(api.get('/auth/me')),
};

export const userApi = {
  profile: (username) => data(api.get(`/users/${username}`)),
  updateMe: (body) => data(api.put('/users/me', body)),
  dashboard: () => data(api.get('/users/me/dashboard')),
  follow: (id) => data(api.post(`/users/${id}/follow`)),
};

export const workApi = {
  list: (params) => data(api.get('/works', { params })),
  following: (params) => data(api.get('/works/following', { params })),
  get: (id) => data(api.get(`/works/${id}`)),
  create: (formDataOrBody, isMultipart) =>
    data(
      api.post('/works', formDataOrBody, isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)
    ),
  update: (id, body) => data(api.put(`/works/${id}`, body)),
  remove: (id) => data(api.delete(`/works/${id}`)),
  like: (id) => data(api.post(`/works/${id}/like`)),
  save: (id) => data(api.post(`/works/${id}/save`)),
  similar: (id, limit = 8) => data(api.get(`/works/${id}/similar`, { params: { limit } })),
};

export const boardApi = {
  list: (params) => data(api.get('/boards', { params })),
  get: (id) => data(api.get(`/boards/${id}`)),
  create: (body) => data(api.post('/boards', body)),
  update: (id, body) => data(api.put(`/boards/${id}`, body)),
  remove: (id) => data(api.delete(`/boards/${id}`)),
  addWork: (id, workId) => data(api.post(`/boards/${id}/works`, { workId })),
  removeWork: (id, workId) => data(api.delete(`/boards/${id}/works/${workId}`)),
  addCollaborator: (id, username) => data(api.post(`/boards/${id}/collaborators`, { username })),
  removeCollaborator: (id, userId) => data(api.delete(`/boards/${id}/collaborators/${userId}`)),
};

export const commentApi = {
  list: (workId) => data(api.get(`/comments/work/${workId}`)),
  add: (workId, body) => data(api.post(`/comments/work/${workId}`, body)),
  remove: (id) => data(api.delete(`/comments/${id}`)),
};

export const searchApi = {
  search: (params) => data(api.get('/search', { params })),
  categories: () => data(api.get('/search/categories')),
};

export const recommendationApi = {
  feed: (limit = 24) => data(api.get('/recommendations', { params: { limit } })),
};

export const insightApi = {
  overview: () => data(api.get('/insights/overview')),
  trends: (days = 30) => data(api.get('/insights/trends', { params: { days } })),
  work: (id, days = 30) => data(api.get(`/insights/works/${id}`, { params: { days } })),
};

export const aiApi = {
  suggest: (body) => data(api.post('/ai/suggest', body)),
  suggestTags: (body) => data(api.post('/ai/tags', body)),
  polish: (body) => data(api.post('/ai/polish', body)),
};
