import type { LocationPoint } from '@/types/models'

export function haversineDistance(
  a?: Pick<LocationPoint, 'latitude' | 'longitude'> | null,
  b?: Pick<LocationPoint, 'latitude' | 'longitude'> | null,
) {
  if (!a || !b) return 0
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadius = 6371000
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const c1 = Math.sin(dLat / 2) ** 2
  const c2 = Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  const distance = 2 * earthRadius * Math.asin(Math.sqrt(c1 + c2))
  return Number.isFinite(distance) ? Math.round(distance) : 0
}

export function getCurrentLocation() {
  return new Promise<UniApp.GetLocationSuccess>((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      success: resolve,
      fail: reject,
    })
  })
}
