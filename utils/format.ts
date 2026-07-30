import { API_HOST, ORDER_STATUS_MAP } from '@/config'

export function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function getFileBaseHost(): string {
  const host = (API_HOST || '').trim()
  if (host) return host.replace(/\/+$/, '')
  return ''
}

export function formatMoney(value: unknown) {
  const amount = Number(value)
  return `¥${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`
}

export function formatDistance(value: unknown) {
  const meters = Number(value)
  if (!Number.isFinite(meters) || meters <= 0) return '未知'
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(2)}km`
}

export function formatDateTime(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

export function formatRelativeTime(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return '-'
  const target = new Date(raw).getTime()
  if (!Number.isFinite(target)) return raw
  const diff = Date.now() - target
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}分钟前`
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}小时前`
  return formatDateTime(value)
}

export function formatMessageTime(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.floor((todayStart.getTime() - targetStart.getTime()) / 86_400_000)

  if (dayDiff === 0) {
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
  if (dayDiff > 0 && dayDiff < 7) {
    const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekMap[date.getDay()]
  }
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const DD = String(date.getDate()).padStart(2, '0')
  return `${MM}/${DD}`
}

export function parseImageList(input: any): string[] {
  if (Array.isArray(input)) return input.map((item) => normalizeText(item)).filter(Boolean)
  if (typeof input === 'string') {
    const raw = normalizeText(input)
    if (!raw) return []
    if (raw.startsWith('[')) {
      try {
        return parseImageList(JSON.parse(raw))
      } catch {
        return raw.split(/[|,]/).map((item) => item.trim()).filter(Boolean)
      }
    }
    return raw.split(/[|,]/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

export function getStatusText(status: unknown) {
  const key = normalizeText(status).toUpperCase()
  return ORDER_STATUS_MAP[key] || (key || '未知状态')
}

export function getStatusType(status: unknown) {
  const key = normalizeText(status).toUpperCase()
  if (['DONE', 'FINISHED'].includes(key)) return 'success'
  if (['COMPLETED'].includes(key)) return 'warning'
  if (['DELIVERING', 'PICKED_UP', 'PICKUP'].includes(key)) return 'primary'
  if (['ACCEPTED', 'ASSIGNED'].includes(key)) return 'info'
  if (['CANCELLED', 'CANCELED'].includes(key)) return 'danger'
  return 'default'
}

export function toAbsoluteFileUrl(url: unknown): string {
  const raw = normalizeText(url)
  if (!raw) return ''

  if (/^data:image\//i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^\/\//.test(raw)) {
    const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:'
    return isHttps ? `https:${raw}` : `http:${raw}`
  }

  const isH5 = typeof window !== 'undefined'
  const baseHost = getFileBaseHost()
  const path = raw.startsWith('/') ? raw : `/${raw}`

  if (isH5) {
    return path
  }

  if (!baseHost) return path
  return `${baseHost}${path}`
}
