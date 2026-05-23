import {
  clearAuth,
  getRefreshToken,
  getToken,
  setRefreshToken,
  setToken,
  setUser,
} from './auth'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : null

  if (!res.ok || !data?.token) {
    if (data?.code === 'ACCOUNT_INACTIVE') {
      clearAuth()
      window.location.reload()
      throw new Error(data.message || data.error || 'Tài khoản đã bị tạm khóa')
    }
    return false
  }

  setToken(data.token)
  if (data.refreshToken) setRefreshToken(data.refreshToken)
  if (data.user) setUser(data.user)
  return true
}

async function request(method, path, body, retry = true) {
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

  if (res.status === 401) {
    if (retry && path !== '/auth/refresh' && await refreshAccessToken()) {
      return request(method, path, body, false)
    }
    clearAuth()
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

  if (res.status === 403 && data.code === 'ACCOUNT_INACTIVE') {
    clearAuth()
    window.location.reload()
    throw new Error(data.message || data.error || 'Tài khoản đã bị tạm khóa')
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
