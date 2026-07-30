import { API_BASE_URL, STORAGE_KEYS } from '@/config'
import { getStorage } from '@/utils/storage'

export interface RequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, any> | string | ArrayBuffer
  auth?: boolean
  header?: Record<string, string>
}

function normalizeErrorMessage(payload: any, fallback: string) {
  return (
    payload?.message ||
    payload?.msg ||
    payload?.error ||
    payload?.data?.message ||
    payload?.data?.msg ||
    payload?.data?.error ||
    fallback
  )
}

function getStatusFriendlyMessage(statusCode: number, data: any): string | null {
  if (statusCode === 429) {
    const baseMsg = '请求过于频繁，请稍后再试'
    const detail = normalizeErrorMessage(data, '')
    return detail ? `${baseMsg}：${detail}` : baseMsg
  }
  if (statusCode === 401) {
    return '登录已过期，请重新登录'
  }
  if (statusCode === 403) {
    return '没有权限进行此操作'
  }
  if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    return '服务器开小差了，请稍后重试'
  }
  return null
}

const IMAGE_URL_CANDIDATE_KEYS = [
  'urls',
  'url', 'path', 'src', 'location', 'uri', 'link', 'href',
  'fileUrl', 'file_url', 'filePath', 'file_path', 'fileName', 'file_name',
  'imageUrl', 'image_url', 'imgUrl', 'img_url', 'avatarUrl', 'avatar_url',
  'photoUrl', 'photo_url', 'pictureUrl', 'picture_url', 'thumbUrl', 'thumb_url',
  'attachment', 'key', 'objectKey', 'object_key', 'storageKey', 'storage_key',
  'relativePath', 'relative_path', 'absolutePath', 'absolute_path',
  'cdnUrl', 'cdn_url', 'downloadUrl', 'download_url', 'previewUrl', 'preview_url',
  'accessUrl', 'access_url', 'publicUrl', 'public_url',
]

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|ico)(\?|#|$)/i
const PATH_PREFIX_RE = /^(\/uploads\/|\/upload\/|\/static\/|\/images\/|\/files\/|\/media\/|\/storage\/|http[s]?:\/\/)/i

function looksLikeImagePath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const s = value.trim()
  if (!s) return false
  if (PATH_PREFIX_RE.test(s)) return true
  if (IMAGE_EXT_RE.test(s)) return true
  if (/^[a-zA-Z0-9_\-\/]+\.[a-zA-Z]{2,5}$/.test(s)) return true
  return false
}

function extractImageUrl(root: any): string | null {
  if (looksLikeImagePath(root)) return root.trim()

  if (Array.isArray(root)) {
    for (const item of root) {
      const found = extractImageUrl(item)
      if (found) return found
    }
    return null
  }

  if (root && typeof root === 'object') {
    for (const key of IMAGE_URL_CANDIDATE_KEYS) {
      if (key in root) {
        const val = root[key]
        if (looksLikeImagePath(val)) return (val as string).trim()
        if (Array.isArray(val)) {
          const found = extractImageUrl(val)
          if (found) return found
        }
        if (val && typeof val === 'object') {
          const found = extractImageUrl(val)
          if (found) return found
        }
      }
    }
    const ownKeys = Object.keys(root)
    for (const key of ownKeys) {
      if (IMAGE_URL_CANDIDATE_KEYS.includes(key)) continue
      const val = root[key]
      if (looksLikeImagePath(val)) return (val as string).trim()
    }
    for (const key of ownKeys) {
      const val = root[key]
      if (val && typeof val === 'object') {
        const found = extractImageUrl(val)
        if (found) return found
      }
    }
  }

  return null
}

const COMMON_UPLOAD_PREFIXES = [
  '/uploads/',
  '/upload/',
  '/static/',
  '/files/',
  '/media/',
  '/images/',
  '/storage/',
]

function collectAllStrings(root: any, out: string[] = []): string[] {
  if (typeof root === 'string') {
    if (root.trim()) out.push(root.trim())
  } else if (Array.isArray(root)) {
    root.forEach((v) => collectAllStrings(v, out))
  } else if (root && typeof root === 'object') {
    Object.values(root).forEach((v) => collectAllStrings(v, out))
  }
  return out
}

function tryResolveBareFileName(raw: any): string | null {
  const all = collectAllStrings(raw, [])
  for (const s of all) {
    if (looksLikeImagePath(s)) continue
    const m = s.match(/^([a-zA-Z0-9_\-]+(?:\.[a-zA-Z0-9_\-]+)*\.(jpg|jpeg|png|gif|webp|bmp|svg))(\?|#|$)/i)
    if (m) {
      const fileName = m[1]
      for (const prefix of COMMON_UPLOAD_PREFIXES) {
        return `${prefix}${fileName}`
      }
    }
    const m2 = s.match(/^[a-f0-9]{8,}(?:\.[a-zA-Z]{2,5})?$/i)
    if (m2 && /\.[a-zA-Z]{2,5}$/.test(s)) {
      for (const prefix of COMMON_UPLOAD_PREFIXES) {
        return `${prefix}${s}`
      }
    }
  }
  return null
}

function resolveUploadResult(rawData: any): string {
  const devMode = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
  if (devMode) {
    try {
      // eslint-disable-next-line no-console
      console.log('[uploadImage] raw response:', JSON.stringify(rawData, null, 2))
    } catch (_e) { /* ignore */ }
  }

  let payload = rawData
  if (payload && typeof payload === 'object') {
    payload = payload.data ?? payload
    payload = payload?.data ?? payload
    payload = payload?.result ?? payload
  }

  const direct = extractImageUrl(payload)
  if (direct) return direct

  const rawFallback = extractImageUrl(rawData)
  if (rawFallback) return rawFallback

  const bareGuess = tryResolveBareFileName(payload) || tryResolveBareFileName(rawData)
  if (bareGuess) return bareGuess

  let hint = ''
  try {
    hint = typeof rawData === 'string'
      ? rawData.slice(0, 300)
      : JSON.stringify(rawData).slice(0, 300)
  } catch (_e) { /* ignore */ }
  throw new Error(`上传成功但未返回图片地址，请检查接口返回结构。原始数据: ${hint || '无法识别'}`)
}

export async function request<T = any>(config: RequestConfig): Promise<T> {
  const token = config.auth === false ? '' : await getStorage<string>(STORAGE_KEYS.token, '')
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.header || {}),
  }

  if (token) {
    header.Authorization = /^Bearer\s/i.test(token) ? token : `Bearer ${token}`
  }

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${config.url}`,
      method: config.method || 'GET',
      data: config.data,
      header,
      timeout: 15000,
      success: (res) => {
        const statusCode = res.statusCode || 0
        const data = res.data as any
        if (statusCode < 200 || statusCode >= 300) {
          const friendly = getStatusFriendlyMessage(statusCode, data)
          const fallback = friendly || `请求失败(${statusCode})`
          reject(new Error(normalizeErrorMessage(data, fallback)))
          return
        }
        if (data && typeof data === 'object' && data.success === false) {
          reject(new Error(normalizeErrorMessage(data, '请求失败')))
          return
        }
        resolve(data as T)
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败')),
    })
  })
}

export async function uploadImage(filePath: string, name = 'image', fileObj?: any) {
  const token = await getStorage<string>(STORAGE_KEYS.token, '')
  const isH5 = typeof window !== 'undefined'

  return new Promise<string>((resolve, reject) => {
    if (isH5) {
      const doUploadWithBlob = (blob: Blob, filename: string) => {
        const formData = new FormData()
        formData.append(name, blob, filename)
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${API_BASE_URL}/upload/image`)
        if (token) {
          xhr.setRequestHeader('Authorization', /^Bearer\s/i.test(token) ? token : `Bearer ${token}`)
        }
        xhr.onload = () => {
          try {
            const status = xhr.status
            const responseText = xhr.responseText || ''
            let data: any = responseText
            try {
              data = responseText ? JSON.parse(responseText) : {}
            } catch (_parseErr) {
              if (!responseText) data = {}
            }
            if (status < 200 || status >= 300) {
              reject(new Error(normalizeErrorMessage(data, `上传失败(${status})`)))
              return
            }
            if (data && typeof data === 'object' && data.success === false) {
              reject(new Error(normalizeErrorMessage(data, '上传失败')))
              return
            }
            resolve(resolveUploadResult(data))
          } catch (error) {
            reject(error)
          }
        }
        xhr.onerror = () => reject(new Error('网络错误，上传失败'))
        xhr.send(formData)
      }

      if (fileObj && (fileObj instanceof File || fileObj instanceof Blob)) {
        doUploadWithBlob(fileObj, fileObj.name || 'image.jpg')
        return
      }

      if (typeof filePath === 'string' && filePath.indexOf('blob:') === 0) {
        fetch(filePath)
          .then((res) => res.blob())
          .then((blob) => doUploadWithBlob(blob, 'image.jpg'))
          .catch((err) => reject(err))
        return
      }
    }

    uni.uploadFile({
      url: `${API_BASE_URL}/upload/image`,
      filePath,
      name,
      header: token
        ? {
          Authorization: /^Bearer\s/i.test(token) ? token : `Bearer ${token}`,
        }
        : undefined,
      success: (res) => {
        try {
          const statusCode = res.statusCode || 0
          const responseData = res.data || ''
          let data: any = responseData
          try {
            data = typeof responseData === 'string' && responseData
              ? JSON.parse(responseData)
              : (responseData || {})
          } catch (_parseErr) {
            if (!responseData) data = {}
          }
          if (statusCode < 200 || statusCode >= 300) {
            const friendly = getStatusFriendlyMessage(statusCode, data)
            const fallback = friendly || `上传失败(${statusCode})`
            reject(new Error(normalizeErrorMessage(data, fallback)))
            return
          }
          if (data && typeof data === 'object' && data.success === false) {
            reject(new Error(normalizeErrorMessage(data, '上传失败')))
            return
          }
          resolve(resolveUploadResult(data))
        } catch (error) {
          reject(error)
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '上传失败')),
    })
  })
}

export const http = {
  get: <T = any>(url: string, data?: Record<string, any>, auth = true) => request<T>({ url, data, auth }),
  post: <T = any>(url: string, data?: Record<string, any>, auth = true) =>
    request<T>({ url, method: 'POST', data, auth }),
  put: <T = any>(url: string, data?: Record<string, any>, auth = true) =>
    request<T>({ url, method: 'PUT', data, auth }),
  delete: <T = any>(url: string, data?: Record<string, any>, auth = true) =>
    request<T>({ url, method: 'DELETE', data, auth }),
}
