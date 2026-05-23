import { getToken, removeToken } from './auth'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

async function request(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const options = { method, headers }
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE_URL}${path}`, options)

  // On 401, clear auth and redirect to login
  if (res.status === 401) {
    removeToken()
    localStorage.removeItem('staffos_user')
    window.location.reload()
    throw new Error('Phiên đăng nhập hết hạn')
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await res.json()
    : null

  if (!data) {
    throw new Error(`API không trả JSON (${res.status})`)
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `Lỗi ${res.status}`)
  }

  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
}
