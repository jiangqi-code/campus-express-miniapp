<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBackPress, onShow } from '@dcloudio/uni-app'
import { ITEM_TYPES } from '@/config'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import type { LocationPoint } from '@/types/models'
import { formatMoney, toAbsoluteFileUrl } from '@/utils/format'
import { uploadImage, http } from '@/utils/request'
import { haversineDistance } from '@/utils/location'
import AppTabBar from '@/components/AppTabBar.vue'

const authStore = useAuthStore()
const messageStore = useMessageStore()
const unreadCount = computed(() => messageStore.unreadCount)
const coupons = ref<any[]>([])
const selectedCouponId = ref('')

const form = reactive({
  pickup: null as LocationPoint | null,
  delivery: null as LocationPoint | null,
  itemType: ITEM_TYPES[0],
  urgency: '普通',
  tip: 0,
  remark: '',
})

const imageList = ref<string[]>([])
type UploadState = { id: string; url: string; progress: number; status: 'uploading' | 'success' | 'failed'; error?: string; filePath?: string; fileObj?: File }
const uploadStates = ref<UploadState[]>([])
const submitting = ref(false)
const loadingCount = ref(0)
const allowLeave = ref(false)
const distanceMeters = computed(() => {
  if (!form.pickup || !form.delivery) return 0
  return Math.round(haversineDistance(form.pickup, form.delivery))
})
const distanceFee = computed(() => Math.max(0, Math.ceil(distanceMeters.value / 1000) * 1.5))
const feePreview = computed(() => {
  const base = 3
  const urgent = form.urgency === '加急' ? 4 : 0
  return base + urgent + distanceFee.value
})
const tipValue = computed(() => Number(form.tip || 0))
const availableCoupons = computed(() => coupons.value.filter((item) => Number(item.coupon?.min_order_amount || 0) <= feePreview.value))
const discountFor = (item: any) => {
  const coupon = item.coupon
  const raw = coupon.type === 'CASH' ? Number(coupon.value) : feePreview.value * Number(coupon.value) / 100
  const capped = coupon.type === 'DISCOUNT' && Number(coupon.max_discount) > 0 ? Math.min(raw, Number(coupon.max_discount)) : raw
  return Math.min(feePreview.value, Math.round(capped * 100) / 100)
}
const couponDiscount = computed(() => {
  const item = availableCoupons.value.find((entry) => entry.id === selectedCouponId.value)
  return item ? discountFor(item) : 0
})
const payableTotal = computed(() => Math.max(0, feePreview.value + tipValue.value - couponDiscount.value))
const couponOptions = computed(() => ['不使用优惠券', ...availableCoupons.value.map((item) => `${item.coupon.name}（省 ¥${discountFor(item).toFixed(2)}）`)])
const couponIndex = computed(() => Math.max(0, availableCoupons.value.findIndex((item) => item.id === selectedCouponId.value) + 1))
async function loadCoupons() {
  try {
    const result = await http.get<any>('/coupons/available', { orderAmount: feePreview.value })
    coupons.value = result?.data ?? result ?? []
    selectedCouponId.value = availableCoupons.value.slice().sort((a, b) => discountFor(b) - discountFor(a))[0]?.id || ''
  } catch { coupons.value = [] }
}
function selectCoupon(event: any) {
  const index = Number(event.detail.value)
  selectedCouponId.value = index > 0 ? availableCoupons.value[index - 1]?.id || '' : ''
}
const hasUnsavedChanges = computed(() => Boolean(
  form.pickup || form.delivery || form.remark.trim() || tipValue.value > 0 || imageList.value.length || uploadStates.value.length,
))
const mapLatitude = computed(() => form.pickup?.latitude || form.delivery?.latitude || 23.1065)
const mapLongitude = computed(() => form.pickup?.longitude || form.delivery?.longitude || 113.3304)
const mapMarkers = computed(() => [
  ...(form.pickup ? [{ id: 1, latitude: form.pickup.latitude, longitude: form.pickup.longitude, title: '取件点', label: { content: '取', color: '#ffffff', bgColor: '#10b981', padding: 5, borderRadius: 12 } }] : []),
  ...(form.delivery ? [{ id: 2, latitude: form.delivery.latitude, longitude: form.delivery.longitude, title: '送达点', label: { content: '送', color: '#ffffff', bgColor: '#ef4444', padding: 5, borderRadius: 12 } }] : []),
])
const mapPolyline = computed(() => form.pickup && form.delivery ? [{ points: [form.pickup, form.delivery], color: '#3b82f6', width: 4, dottedLine: true }] : [])

function safeShowLoading(title = '加载中...') {
  if (loadingCount.value === 0) {
    uni.showLoading({ title, mask: true })
  }
  loadingCount.value++
}

function safeHideLoading() {
  loadingCount.value = Math.max(0, loadingCount.value - 1)
  if (loadingCount.value === 0) {
    try {
      uni.hideLoading()
    } catch (e) {
    }
  }
}

function forceHideLoading() {
  if (loadingCount.value > 0) {
    loadingCount.value = 0
    try {
      uni.hideLoading()
    } catch (e) {
    }
  }
}

async function uploadOne(item: UploadState) {
  item.status = 'uploading'
  item.progress = 12
  item.error = ''
  const progressTimer = setInterval(() => { item.progress = Math.min(88, item.progress + 12) }, 220)
  try {
    const url = await uploadImage(item.filePath || '', 'image', item.fileObj)
    item.url = url
    item.progress = 100
    item.status = 'success'
    imageList.value = uploadStates.value.filter((entry) => entry.status === 'success').map((entry) => entry.url).slice(0, 3)
  } catch (error: any) {
    item.status = 'failed'
    item.error = error.message || '上传失败'
    uni.showToast({ title: item.error, icon: 'none' })
  } finally {
    clearInterval(progressTimer)
  }
}

async function processFiles(files: File[]) {
  const remaining = Math.max(0, 3 - uploadStates.value.length)
  const items = files.slice(0, remaining).map((file) => ({ id: `${Date.now()}-${Math.random()}`, url: URL.createObjectURL(file), progress: 0, status: 'uploading' as const, fileObj: file }))
  uploadStates.value.push(...items)
  await Promise.all(items.map(uploadOne))
}

async function processPaths(paths: string[], rawFiles: any[]) {
  const remaining = Math.max(0, 3 - uploadStates.value.length)
  const items = paths.slice(0, remaining).map((path, index) => ({ id: `${Date.now()}-${index}`, url: path, progress: 0, status: 'uploading' as const, filePath: path, fileObj: rawFiles[index] }))
  uploadStates.value.push(...items)
  await Promise.all(items.map(uploadOne))
}

function retryUpload(item: UploadState) { if (item.status === 'failed') void uploadOne(item) }

async function ensureLogin() {
  await authStore.bootstrap()
  if (!authStore.isLogin) {
    uni.redirectTo({ url: '/pages/auth/index' })
    return false
  }
  return true
}

async function pickLocation(type: 'pickup' | 'delivery') {
  if (!(await ensureLogin())) return
  uni.chooseLocation({
    success: (res) => {
      const point = {
        address: res.address || res.name || '已选位置',
        latitude: res.latitude,
        longitude: res.longitude,
        name: res.name,
      }
      if (type === 'pickup') form.pickup = point
      else form.delivery = point
    },
    fail: () => {
      uni.showToast({ title: '选点已取消', icon: 'none' })
    },
  })
}

function chooseImages() {
  if (uploadStates.value.length >= 3) {
    uni.showToast({ title: '最多上传 3 张图片', icon: 'none' })
    return
  }
  const isH5 = typeof window !== 'undefined'
  if (isH5 && typeof document !== 'undefined') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.style.display = 'none'
    let handled = false
    const cleanup = () => {
      if (!handled) {
        handled = true
        try {
          document.body.removeChild(input)
        } catch (e) {
        }
      }
    }
    input.addEventListener('change', (e) => {
      try {
        const target = e.target as HTMLInputElement
        if (target && target.files && target.files.length > 0) {
            const remaining = 3 - uploadStates.value.length
          const files = Array.from(target.files).slice(0, Math.max(0, remaining))
          if (files.length > 0) {
            processFiles(files)
          }
        }
      } finally {
        cleanup()
      }
    })
    input.addEventListener('cancel', cleanup)
    input.addEventListener('error', cleanup)
    setTimeout(cleanup, 60000)
    try {
      document.body.appendChild(input)
    } catch (e) {
    }
    try {
      input.click()
    } catch (e) {
      cleanup()
      uni.showToast({ title: '无法打开文件选择器', icon: 'none' })
    }
    return
  }
  uni.chooseImage({
    count: 3 - uploadStates.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      try {
        const files = res.tempFilePaths || (res.tempFiles && res.tempFiles.map((f: any) => f.path)) || []
        const rawFiles = res.tempFiles || []
        if (files.length === 0) {
          uni.showToast({ title: '未选择图片', icon: 'none' })
          return
        }
        await processPaths(files, rawFiles)
      } catch (error: any) {
        uni.showToast({ title: error.message || '图片上传失败', icon: 'none' })
      }
    },
    fail: (err) => {
      if (err && err.errMsg && err.errMsg.toLowerCase().indexOf('cancel') === -1) {
        uni.showToast({ title: err.errMsg || '选择图片失败', icon: 'none' })
      }
    },
  })
}

function previewImage(url: string) {
  uni.previewImage({
    urls: uploadStates.value.filter((item) => item.status === 'success').map((item) => toAbsoluteFileUrl(item.url)),
    current: toAbsoluteFileUrl(url),
  })
}

function removeImage(index: number) {
  const item = uploadStates.value[index]
  uploadStates.value.splice(index, 1)
  if (item?.url) imageList.value = imageList.value.filter((url) => url !== item.url)
}

function swapLocations() {
  const pickup = form.pickup
  form.pickup = form.delivery
  form.delivery = pickup
}

function locationsAreSame() {
  if (!form.pickup || !form.delivery) return false
  return haversineDistance(form.pickup, form.delivery) < 5 || form.pickup.address.trim() === form.delivery.address.trim()
}

async function submitTask() {
  if (!(await ensureLogin())) return
  if (!form.pickup || !form.delivery) {
    uni.showToast({ title: '请先完成地图选点', icon: 'none' })
    return
  }
  if (!form.itemType) {
    uni.showToast({ title: '请选择物品类型', icon: 'none' })
    return
  }
  if (locationsAreSame()) {
    uni.showToast({ title: '取件点和送达点不能相同', icon: 'none' })
    return
  }
  if (!Number.isFinite(tipValue.value) || tipValue.value < 0 || tipValue.value > 100) {
    uni.showToast({ title: '小费范围为 0-100 元', icon: 'none' })
    return
  }
  if (uploadStates.value.some((item) => item.status === 'uploading')) {
    uni.showToast({ title: '图片仍在上传，请稍后', icon: 'none' })
    return
  }
  if (imageList.value.length === 0) {
    uni.showToast({ title: '请至少上传 1 张图片', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await http.post('/task/publish', {
      pickup_address: form.pickup.address,
      delivery_address: form.delivery.address,
      pickup_lat: form.pickup.latitude,
      pickup_lng: form.pickup.longitude,
      delivery_lat: form.delivery.latitude,
      delivery_lng: form.delivery.longitude,
      type: form.itemType,
      task_type: form.itemType,
      urgency: form.urgency === '加急' ? 1 : 0,
      fee_total: feePreview.value,
      tip: Number(form.tip || 0),
      remark: form.remark.trim(),
      images: imageList.value,
      images_json: JSON.stringify(imageList.value),
      user_coupon_id: selectedCouponId.value || null,
    })
    uni.showToast({ title: '发布成功', icon: 'success' })
    allowLeave.value = true
    setTimeout(() => {
      uni.redirectTo({ url: '/pages/order/published' })
    }, 400)
  } catch (error: any) {
    uni.showToast({ title: error.message || '发布失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onBackPress(() => {
  if (allowLeave.value || !hasUnsavedChanges.value || submitting.value) return false
  uni.showModal({
    title: '放弃未保存内容？',
    content: '离开后，当前填写的任务信息将不会保存。',
    confirmText: '放弃离开',
    confirmColor: '#ef4444',
    success: (result) => {
      if (result.confirm) {
        allowLeave.value = true
        uni.navigateBack()
      }
    },
  })
  return true
})

function beforeUnload(event: BeforeUnloadEvent) {
  if (!allowLeave.value && hasUnsavedChanges.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onMounted(() => { if (typeof window !== 'undefined') window.addEventListener('beforeunload', beforeUnload) })
onShow(loadCoupons)
onBeforeUnmount(() => { if (typeof window !== 'undefined') window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <view class="page-shell publish-page">
    <view class="card">
      <view class="section-title">发布任务</view>
      <view class="section-desc">支持地图选点、1-3 张图片上传、物品类型、时效和小费配置</view>

      <view class="form-section">
        <view class="form-section-title">取送位置</view>
      <view class="field-label">取件地址</view>
      <view class="picker-like" @tap="pickLocation('pickup')">
        {{ form.pickup?.address || '点击使用 uni.chooseLocation 选择取件点' }}
      </view>

      <view class="field-label">送达地址</view>
      <view class="picker-like" @tap="pickLocation('delivery')">
        {{ form.delivery?.address || '点击使用 uni.chooseLocation 选择送达点' }}
      </view>

        <button class="swap-button" :disabled="!form.pickup && !form.delivery" @tap="swapLocations">⇅ 互换取送点</button>
        <map
          class="location-map"
          :latitude="mapLatitude"
          :longitude="mapLongitude"
          :markers="mapMarkers"
          :polyline="mapPolyline"
          :scale="14"
          show-location
        />
        <view class="map-summary">
          <text>路线距离：{{ distanceMeters > 0 ? `${(distanceMeters / 1000).toFixed(2)} km` : '选点后计算' }}</text>
          <text v-if="locationsAreSame()" class="danger">取件点和送达点不能相同</text>
        </view>
      </view>

      <view class="form-section">
        <view class="form-section-title">任务信息</view>
      <view class="field-label">物品类型</view>
      <picker :value="ITEM_TYPES.indexOf(form.itemType)" :range="ITEM_TYPES" @change="form.itemType = ITEM_TYPES[$event.detail.value]">
        <view class="picker-like">{{ form.itemType }}</view>
      </picker>

      <view class="field-label">时效</view>
      <view class="grid-2">
        <view class="picker-like" :class="{ active: form.urgency === '普通' }" @tap="form.urgency = '普通'">普通</view>
        <view class="picker-like" :class="{ active: form.urgency === '加急' }" @tap="form.urgency = '加急'">加急</view>
      </view>

      <view class="field-label">小费</view>
      <input v-model="form.tip" class="input" type="digit" placeholder="可选，0-100 元" />
      <view class="field-hint">小费范围 0-100 元，将全部支付给跑腿员</view>

      <view class="field-label">备注</view>
      <textarea v-model="form.remark" class="textarea" maxlength="200" placeholder="如：易碎、请尽快联系我" />
      </view>

      <view class="form-section">
        <view class="form-section-title">任务图片</view>
      <view class="field-label">上传图片（1-3张）</view>
      <view class="thumb-list">
        <view class="upload-box" @tap="chooseImages">+</view>
        <view v-for="(item, index) in uploadStates" :key="item.id" class="image-wrapper">
          <image class="thumb-image" :src="toAbsoluteFileUrl(item.url)" mode="aspectFill" @tap="item.status === 'success' && previewImage(item.url)" />
          <view v-if="item.status === 'uploading'" class="upload-overlay">
            <view class="upload-progress"><view class="upload-progress-bar" :style="{ width: `${item.progress}%` }" /></view>
            <text>{{ item.progress }}%</text>
          </view>
          <view v-else-if="item.status === 'failed'" class="upload-overlay failed" @tap="retryUpload(item)">
            <text>上传失败</text><text>点击重试</text>
          </view>
          <view class="delete-dot" @tap.stop="removeImage(index)">x</view>
        </view>
      </view>
      </view>

      <view class="fee-card form-section">
        <view class="form-section-title">费用预估</view>
        <view class="pricing-explanation">基础费 ¥3 + 距离费 ¥1.5/km（按整公里计）{{ form.urgency === '加急' ? ' + 加急费 ¥4' : '' }}</view>
        <view class="row-between">
          <text class="muted">配送费预估（{{ distanceMeters > 0 ? `${(distanceMeters / 1000).toFixed(2)}km` : '待选点' }}）</text>
          <text class="primary">{{ formatMoney(feePreview) }}</text>
        </view>
        <view class="row-between fee-total">
          <text class="muted">优惠券</text>
          <picker :value="couponIndex" :range="couponOptions" @change="selectCoupon"><text class="coupon-picker">{{ couponOptions[couponIndex] }}</text></picker>
        </view>
        <view v-if="couponDiscount > 0" class="row-between fee-total coupon-saving"><text>优惠减免</text><text>- {{ formatMoney(couponDiscount) }}</text></view>
        <view class="row-between fee-total">
          <text class="muted">总额（含小费）</text>
          <text class="success">{{ formatMoney(payableTotal) }}</text>
        </view>
      </view>

      <view class="btn-primary submit-btn" :class="{ disabled: submitting || uploadStates.some(item => item.status === 'uploading') }" @tap="submitTask">
        {{ submitting ? '提交中...' : '确认发布任务' }}
      </view>
    </view>
    <!-- #ifdef H5 -->
    <AppTabBar current="publish" :unread-message-count="unreadCount" />
    <!-- #endif -->
  </view>
</template>

<style lang="scss" scoped>
.form-section {
  margin-top: 24rpx;
  padding: 24rpx;
  border: 2rpx solid #e5e6eb;
  border-radius: 20rpx;
  background: #ffffff;
}

.form-section-title { color: #1d2129; font-size: 30rpx; font-weight: 700; }
.swap-button { width: 240rpx; height: 68rpx; margin: 20rpx auto; border-radius: 999rpx; background: #edf8e9; color: #389e0d; font-size: 24rpx; }
.location-map { width: 100%; height: 360rpx; overflow: hidden; border-radius: 18rpx; }
.map-summary { display: flex; flex-direction: column; gap: 6rpx; margin-top: 12rpx; color: #86909c; font-size: 22rpx; }
.field-hint { margin-top: 8rpx; color: #86909c; font-size: 22rpx; }
.pricing-explanation { margin: 14rpx 0 18rpx; padding: 14rpx 16rpx; border-radius: 12rpx; background: #f1faed; color: #4e5969; font-size: 22rpx; line-height: 1.5; }
.active {
  border-color: #52c41a;
  color: #389e0d;
  background: #f1faed;
}

.upload-box {
  width: 180rpx;
  height: 180rpx;
  border-radius: 20rpx;
  background: #f1faed;
  border: 2rpx dashed #95de64;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #389e0d;
  font-size: 56rpx;
  flex-shrink: 0;
}

.image-wrapper {
  position: relative;
  flex-shrink: 0;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  border-radius: 20rpx;
  background: rgba(15, 23, 42, 0.62);
  color: #ffffff;
  font-size: 22rpx;
}
.upload-overlay.failed { background: rgba(245, 63, 63, 0.78); }
.upload-progress { width: 120rpx; height: 8rpx; overflow: hidden; border-radius: 999rpx; background: rgba(255, 255, 255, 0.35); }
.upload-progress-bar { height: 100%; border-radius: inherit; background: #ffffff; transition: width 180ms ease; }

.delete-dot {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.7);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
}

.fee-card {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #f9fafb;
}

.fee-total {
  margin-top: 18rpx;
}
.coupon-picker { color: #389e0d; font-size: 24rpx; }
.coupon-saving { color: #389e0d; }

.submit-btn {
  margin-top: 28rpx;
}

.field-label:not(:first-child) {
  margin-top: 24rpx;
}

@media screen and (max-width: 375px) {
  .page-shell { padding-right: 16rpx; padding-left: 16rpx; }
  .form-section { padding: 20rpx; }
}

/* Grouped publishing flow */
.publish-page{background:#f6f9f3}.form-card,.location-card,.upload-card{border:0;border-radius:40rpx;box-shadow:0 4rpx 24rpx rgba(36,69,51,.06)}.form-section{margin-bottom:24rpx;padding:28rpx;background:#fff;border:2rpx solid #e4eee0;border-radius:32rpx}.field-label{color:#293630;font-size:30rpx}.input,.textarea,.picker-like{border-color:#e4eee0;background:#fbfdf9}.input:focus,.textarea:focus{border-color:#52c41a}.location-map{height:380rpx!important;border:8rpx solid #fff;border-radius:32rpx!important;box-shadow:0 4rpx 20rpx rgba(36,69,51,.09)}.map-summary{padding:20rpx 24rpx;color:#6f7d73!important;background:#f1faed;border-radius:20rpx}.submit-btn{background:#52c41a;box-shadow:0 12rpx 28rpx rgba(82,196,26,.26)}
</style>
