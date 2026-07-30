export function setStorage<T>(key: string, value: T) {
  return new Promise<void>((resolve, reject) => {
    uni.setStorage({
      key,
      data: value,
      success: () => resolve(),
      fail: reject,
    })
  })
}

export function getStorage<T>(key: string, fallback: T) {
  return new Promise<T>((resolve) => {
    uni.getStorage({
      key,
      success: (res) => resolve((res.data as T) ?? fallback),
      fail: () => resolve(fallback),
    })
  })
}

export function removeStorage(key: string) {
  return new Promise<void>((resolve) => {
    uni.removeStorage({
      key,
      complete: () => resolve(),
    })
  })
}
