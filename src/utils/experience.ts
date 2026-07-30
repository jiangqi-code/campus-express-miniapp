export function installExperienceInterceptors() {
  uni.addInterceptor('showToast', {
    invoke(options: UniApp.ShowToastOptions) {
      options.duration ??= 2200
      options.mask ??= false
      if (!options.icon) options.icon = 'none'
    },
  })
  uni.addInterceptor('showLoading', {
    invoke(options: UniApp.ShowLoadingOptions) {
      options.title ||= '加载中…'
      options.mask = true
    },
  })
  uni.addInterceptor('showModal', {
    invoke(options: UniApp.ShowModalOptions) {
      options.confirmText ||= '确认'
      options.cancelText ||= '取消'
      options.confirmColor ||= '#2563eb'
      options.cancelColor ||= '#6b7280'
    },
  })
}

export async function confirmAction(options: { title: string; content: string; confirmText?: string; danger?: boolean }) {
  const result = await uni.showModal({
    title: options.title,
    content: options.content,
    confirmText: options.confirmText || '确认',
    cancelText: '取消',
    confirmColor: options.danger ? '#dc2626' : '#2563eb',
    cancelColor: '#6b7280',
  })
  return result.confirm
}

export function scrollToFirstError(selector = '.field-error, .form-error, .error') {
  setTimeout(() => {
    uni.createSelectorQuery().select(selector).boundingClientRect((rect: any) => {
      if (!rect) return
      uni.pageScrollTo({ scrollTop: Math.max(0, Number(rect.top || 0) - 120), duration: 250 })
    }).exec()
  }, 0)
}
