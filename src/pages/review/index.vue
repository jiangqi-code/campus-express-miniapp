<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { REVIEW_TAGS } from '@/config'
import { toAbsoluteFileUrl } from '@/utils/format'
import { http, uploadImage } from '@/utils/request'
import { confirmAction, scrollToFirstError } from '@/utils/experience'

const orderId = ref('')
const orderSummary = ref<any>(null)
const submitting = ref(false)
const successVisible = ref(false)
const imageList = ref<string[]>([])
const form = reactive({ rating: 0, tags: [] as string[], content: '', anonymous: false })

async function loadOrderSummary() {
  if (!orderId.value) return
  try {
    const result: any = await http.get(`/order/${encodeURIComponent(orderId.value)}`)
    orderSummary.value = result?.data ?? result
  } catch { orderSummary.value = null }
}

function toggleTag(tag: string) {
  form.tags = form.tags.includes(tag) ? form.tags.filter(item => item !== tag) : [...form.tags, tag]
}

function chooseImages() {
  if (imageList.value.length >= 3) return uni.showToast({ title: '最多上传 3 张图片', icon: 'none' })
  uni.chooseImage({
    count: 3 - imageList.value.length,
    success: async res => {
      try {
        const uploaded = await Promise.all(res.tempFilePaths.map(filePath => uploadImage(filePath)))
        imageList.value = [...imageList.value, ...uploaded].slice(0, 3)
      } catch (error: any) { uni.showToast({ title: error.message || '上传失败', icon: 'none' }) }
    },
  })
}

async function removeImage(index: number) {
  if (await confirmAction({ title: '删除图片', content: '确定删除这张评价图片吗？', confirmText: '删除', danger: true })) imageList.value = imageList.value.filter((_, itemIndex) => itemIndex !== index)
}

async function submitReview() {
  if (!orderId.value) return uni.showToast({ title: '缺少订单号', icon: 'none' })
  if (form.rating < 1 || form.content.trim().length < 5) { scrollToFirstError(); return }
  if (submitting.value) return
  submitting.value = true
  try {
    await http.post(`/order/${encodeURIComponent(orderId.value)}/review`, {
      rating: form.rating, tags: form.tags, content: form.content.trim(), images: imageList.value, anonymous: form.anonymous,
    })
    successVisible.value = true
  } catch (error: any) {
    uni.showToast({ title: error.message || '评价失败', icon: 'none' })
  } finally { submitting.value = false }
}

onLoad(query => {
  orderId.value = String(query?.orderId ?? query?.id ?? '')
  loadOrderSummary()
})
</script>

<template>
  <view class="page-shell">
    <view class="card">
      <view class="section-title">订单评价</view>
      <view class="section-desc">支持评分、文字、图片和匿名评价</view>
      <view class="order-summary">
        <view class="row-between"><text class="muted">正在评价</text><text>订单 #{{ orderId }}</text></view>
        <view class="summary-route">{{ orderSummary?.pickup_address || orderSummary?.task?.pickup_address || '-' }} → {{ orderSummary?.delivery_address || orderSummary?.task?.delivery_address || '-' }}</view>
        <view class="row-between"><text class="muted">订单金额</text><text class="primary">¥{{ orderSummary?.final_price ?? orderSummary?.fee_total ?? orderSummary?.task?.fee_total ?? '0.00' }}</text></view>
      </view>

      <view class="field-label">评分（必选）</view>
      <view class="star-row"><view v-for="star in 5" :key="star" class="star-item" :class="{ active: star <= form.rating }" @tap="form.rating = star">★</view></view>
      <view v-if="form.rating === 0" class="field-error">请选择评分后再提交</view>

      <view class="field-label">评价标签</view>
      <view class="tag-list"><view v-for="tag in REVIEW_TAGS" :key="tag" class="tag-item" :class="{ active: form.tags.includes(tag) }" @tap="toggleTag(tag)">{{ tag }}</view></view>

      <view class="field-label">文字评价（至少5字）</view>
      <textarea v-model="form.content" class="textarea" maxlength="200" placeholder="至少输入5个字，说说这次跑腿体验" />
      <view v-if="form.content.trim().length < 5" class="field-error">文字评价至少需要5个字</view>
      <view class="content-count" :class="{ invalid: form.content.trim().length < 5 }">{{ form.content.trim().length }}/200</view>

      <view class="field-label">图片</view>
      <view class="thumb-list">
        <view v-if="imageList.length < 3" class="upload-box" @tap="chooseImages">+</view>
        <view v-for="(item, index) in imageList" :key="item" class="thumb-item"><image class="thumb-image" :src="toAbsoluteFileUrl(item)" mode="aspectFill" /><view class="remove-image" @tap.stop="removeImage(index)">×</view></view>
      </view>

      <view class="anonymous-row" @tap="form.anonymous = !form.anonymous"><view class="checkbox" :class="{ checked: form.anonymous }">{{ form.anonymous ? '✓' : '' }}</view><view><view>匿名评价</view><view class="muted anonymous-desc">匿名后对方不会看到你的昵称</view></view></view>
      <view class="btn-primary submit-btn" :class="{ disabled: submitting }" @tap="submitReview">{{ submitting ? '提交中...' : '提交评价' }}</view>
    </view>

    <view v-if="successVisible" class="success-mask"><view class="success-card"><view class="success-icon">✓</view><view class="section-title">评价提交成功</view><view class="section-desc">感谢你的反馈，评价已同步到评价列表</view><view class="btn-primary success-button" @tap="uni.redirectTo({ url: '/pages/review/list' })">查看评价列表</view></view></view>
  </view>
</template>

<style lang="scss" scoped>
.order-summary { margin-top: 24rpx; padding: 22rpx; border-radius: 16rpx; background: #f8fafc; font-size: 26rpx; }
.summary-route { margin: 16rpx 0; color: #1f2937; line-height: 1.5; }
.star-row { display: flex; gap: 20rpx; }
.star-item { font-size: 56rpx; color: #d1d5db; &.active { color: #f59e0b; } }
.tag-list { display: flex; flex-wrap: wrap; gap: 16rpx; }
.tag-item { padding: 14rpx 24rpx; border-radius: 999rpx; background: #f3f4f6; color: #4b5563; &.active { background: #dbeafe; color: #2563eb; } }
.upload-box { width: 180rpx; height: 180rpx; border-radius: 20rpx; background: #eff6ff; border: 2rpx dashed #93c5fd; display: flex; align-items: center; justify-content: center; color: #2563eb; font-size: 56rpx; flex-shrink: 0; }
.thumb-item { position: relative; }
.remove-image { position: absolute; top: -12rpx; right: -12rpx; width: 40rpx; height: 40rpx; border-radius: 50%; background: #ef4444; color: #fff; display: flex; align-items: center; justify-content: center; }
.field-label:not(:first-child), .submit-btn { margin-top: 24rpx; }
.field-error, .content-count.invalid { color: #ef4444; }
.field-error, .content-count { margin-top: 8rpx; font-size: 22rpx; }
.content-count { text-align: right; color: #9ca3af; }
.anonymous-row { display: flex; align-items: center; gap: 16rpx; margin-top: 28rpx; }
.checkbox { width: 38rpx; height: 38rpx; border: 2rpx solid #cbd5e1; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; }
.checkbox.checked { background: #2563eb; border-color: #2563eb; color: #fff; }
.anonymous-desc { font-size: 22rpx; margin-top: 4rpx; }
.disabled { opacity: .65; pointer-events: none; }
.success-mask { position: fixed; inset: 0; z-index: 100; background: rgba(15, 23, 42, .48); display: flex; align-items: center; justify-content: center; padding: 48rpx; }
.success-card { width: 100%; padding: 48rpx 36rpx; background: #fff; border-radius: 24rpx; text-align: center; }
.success-icon { width: 88rpx; height: 88rpx; margin: 0 auto 24rpx; border-radius: 50%; background: #22c55e; color: #fff; font-size: 56rpx; display: flex; align-items: center; justify-content: center; }
.success-button { margin-top: 32rpx; }
</style>
