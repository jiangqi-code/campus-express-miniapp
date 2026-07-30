<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import type { OrderItem } from '@/types/models'
import { formatDateTime, formatMoney, getStatusText, getStatusType, toAbsoluteFileUrl } from '@/utils/format'
import { http, uploadImage } from '@/utils/request'
import { getStorage } from '@/utils/storage'

interface ExtendedOrderItem extends OrderItem {
  _progress?: number
  _etaMinutes?: number
  _lastMessage?: string
  _finalPrice?: number
  _isReviewed?: boolean
}

const loading = ref(false)
const orders = ref<ExtendedOrderItem[]>([])
let deliveringTimer: ReturnType<typeof setInterval> | null = null

const normalizeStatus = (status: unknown): string => {
  const s = String(status ?? '').toUpperCase()
  const map: Record<string, string> = {
    PICKING_UP: 'PICKED_UP',
    PICKUP: 'PICKED_UP',
    IN_DELIVERY: 'DELIVERING',
    DELIVERED: 'COMPLETED',
    DONE: 'COMPLETED',
    FINISHED: 'COMPLETED',
    CANCELED: 'CANCELLED',
  }
  return map[s] || s
}

const getFinalPrice = (item: any): number => {
  const raw = item.final_price ?? item.price ?? item.fee_total ?? item.amount ?? item.task?.final_price ?? item.task?.fee_total ?? 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

const loadLastMessage = async (orderId: string): Promise<string> => {
  try {
    const key = `ce:order_chat:${orderId}`
    const data: any = await getStorage(key, null)
    if (!data) return '暂无'
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data)
        const arr = Array.isArray(parsed) ? parsed : parsed?.messages || parsed?.list || []
        if (arr.length > 0) {
          const last = arr[arr.length - 1]
          const content = last?.content || last?.text || last?.message || ''
          return String(content || '暂无')
        }
      } catch {
        return data.slice(0, 50) || '暂无'
      }
    }
    if (Array.isArray(data)) {
      if (data.length === 0) return '暂无'
      const last = data[data.length - 1]
      return String(last?.content || last?.text || last?.message || '暂无')
    }
    if (data && typeof data === 'object') {
      const arr = data.messages || data.list || []
      if (arr.length > 0) {
        const last = arr[arr.length - 1]
        return String(last?.content || last?.text || last?.message || '暂无')
      }
      return String(data.lastMessage || data.content || data.text || '暂无')
    }
    return '暂无'
  } catch {
    return '暂无'
  }
}

const calcRunnerProgress = (item: ExtendedOrderItem): number => {
  const status = normalizeStatus(item.status)
  if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(status)) return 100
  if (['ACCEPTED', 'ASSIGNED', 'PENDING'].includes(status)) return 5
  if (status === 'PICKED_UP') return 35
  if (status === 'DELIVERING') {
    const stored = Number(item._progress)
    if (Number.isFinite(stored) && stored > 0) return Math.min(99, stored)
    return 60
  }
  return 10
}

const calcEtaMinutes = (item: ExtendedOrderItem): number => {
  const status = normalizeStatus(item.status)
  if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(status)) return 0
  const progress = calcRunnerProgress(item)
  const baseTotal = 40
  const remainingPct = Math.max(0, 100 - progress)
  return Math.max(1, Math.round((remainingPct / 100) * baseTotal))
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const result = await http.get<any>('/order/list', { type: 'taken', page: 1, pageSize: 100 })
    const list =
      result?.data?.list ?? result?.data?.rows ?? result?.data?.items ?? result?.data?.orders ??
      result?.list ?? result?.rows ?? result?.items ?? result?.orders ??
      (Array.isArray(result?.data) ? result?.data : [])
    const rawList = Array.isArray(list) ? list : []
    const normalized: ExtendedOrderItem[] = []
    for (const item of rawList) {
      const orderId = String(item.id ?? item.order_id ?? item.orderId ?? '')
      const mapped: ExtendedOrderItem = {
        ...item,
        id: orderId,
        order_id: String(item.order_id ?? item.orderId ?? item.id ?? ''),
        task_id: String(item.task_id ?? item.taskId ?? item.task?.id ?? ''),
        pickup_address: item.pickup_address ?? item.task?.pickup_address ?? '',
        delivery_address: item.delivery_address ?? item.task?.delivery_address ?? '',
        status: normalizeStatus(item.status ?? item.task?.status),
        _finalPrice: getFinalPrice(item),
        _isReviewed: !!(item.reviewed || item.is_reviewed || item.task?.reviewed || item.task?.is_reviewed),
        _progress: Number(item.delivery_progress ?? item.progress ?? item._progress ?? 0) || undefined,
      }
      mapped._progress = calcRunnerProgress(mapped)
      mapped._etaMinutes = calcEtaMinutes(mapped)
      mapped._lastMessage = await loadLastMessage(orderId || mapped.task_id || '')
      normalized.push(mapped)
    }
    orders.value = normalized
  } catch (error: any) {
    uni.showToast({ title: error.message || '订单加载失败', icon: 'none' })
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

const refreshDeliveringProgress = () => {
  let changed = false
  orders.value = orders.value.map((item) => {
    const status = normalizeStatus(item.status)
    if (status !== 'DELIVERING') return item
    const current = Number(item._progress) ?? calcRunnerProgress(item)
    const increment = Math.random() * 4 + 1
    const next = Math.min(99, current + increment)
    if (Math.abs(next - current) > 0.01) changed = true
    const updated: ExtendedOrderItem = {
      ...item,
      _progress: next,
      _etaMinutes: Math.max(1, Math.round(((100 - next) / 100) * 40)),
    }
    return updated
  })
  if (changed) {
    // trigger reactivity by creating a new array reference above; no-op for clarity
  }
}

const startDeliveringTimer = () => {
  if (deliveringTimer) return
  deliveringTimer = setInterval(refreshDeliveringProgress, 10000)
}

const stopDeliveringTimer = () => {
  if (deliveringTimer) {
    clearInterval(deliveringTimer)
    deliveringTimer = null
  }
}

const chooseAndUploadPhoto = (callback: (url: string) => Promise<void>) => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      try {
        const url = await uploadImage(res.tempFilePaths[0])
        await callback(url)
      } catch (error: any) {
        uni.showToast({ title: error.message || '上传失败', icon: 'none' })
      }
    },
  })
}

const runnerNextAction = (item: ExtendedOrderItem): { label: string; type: 'pickup' | 'deliver' | 'complete' | 'none'; disabled: boolean } => {
  const status = normalizeStatus(item.status)
  const progress = Number(item._progress) ?? 0
  if (['ACCEPTED', 'ASSIGNED'].includes(status)) {
    return { label: '取件', type: 'pickup', disabled: false }
  }
  if (['PICKED_UP'].includes(status)) {
    return { label: '开始配送', type: 'deliver', disabled: false }
  }
  if (status === 'DELIVERING' && progress >= 1) {
    return { label: '标记已送达', type: 'complete', disabled: false }
  }
  return { label: status === 'COMPLETED' ? '已完成' : '处理中', type: 'none', disabled: true }
}

const pickupOrder = (orderId: string) => {
  chooseAndUploadPhoto(async (url) => {
    await http.put(`/order/pickup/${encodeURIComponent(orderId)}`, { pickup_photo_url: url })
    uni.showToast({ title: '已取件', icon: 'success' })
    fetchOrders()
  })
}

const startDelivery = async (orderId: string) => {
  try {
    await http.put(`/order/deliver/${encodeURIComponent(orderId)}`)
    uni.showToast({ title: '开始配送', icon: 'success' })
    fetchOrders()
  } catch (error: any) {
    uni.showToast({ title: error.message || '操作失败', icon: 'none' })
  }
}

const completeOrder = (orderId: string) => {
  chooseAndUploadPhoto(async (url) => {
    await http.put(`/order/${encodeURIComponent(orderId)}/delivery-photo`, { delivery_photo_url: url })
    await http.put(`/order/complete/${encodeURIComponent(orderId)}`)
    uni.showToast({ title: '已上传照片并完成订单', icon: 'success' })
    fetchOrders()
  })
}

const handleRunnerAction = (item: ExtendedOrderItem) => {
  const action = runnerNextAction(item)
  const id = item.order_id || item.id
  if (!id || action.type === 'none') return
  if (action.type === 'pickup') pickupOrder(id)
  else if (action.type === 'deliver') startDelivery(id)
  else if (action.type === 'complete') completeOrder(id)
}

const openTaskDetail = (taskId: string) => {
  uni.navigateTo({ url: `/pages/task/detail?id=${taskId}` })
}

const openChat = (item: ExtendedOrderItem) => {
  const id = item.task_id || item.id
  if (!id) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/task/detail?id=${id}&chat=true` })
}

const progressDotStyle = (progress: number) => {
  const clamped = Math.max(0, Math.min(100, Number(progress) || 0))
  if (clamped < 35) {
    const pct = clamped / 35
    return { left: `${4 + pct * 38}%`, stage: 'pickup' }
  }
  if (clamped < 100) {
    const pct = (clamped - 35) / 65
    return { left: `${42 + pct * 54}%`, stage: 'deliver' }
  }
  return { left: '96%', stage: 'done' }
}

onPullDownRefresh(() => {
  fetchOrders()
})

onShow(() => {
  fetchOrders()
  startDeliveringTimer()
})

onMounted(() => {
  fetchOrders()
  startDeliveringTimer()
})

onUnmounted(() => {
  stopDeliveringTimer()
})
</script>

<template>
  <view class="page-shell">
    <view class="card">
      <view class="row-between">
        <view>
          <view class="section-title">我的订单-接单</view>
          <view class="section-desc">跑腿员可更新状态、上传取件/送达照片</view>
        </view>
        <view class="btn-secondary mini-btn" @tap="fetchOrders">刷新</view>
      </view>
    </view>

    <view v-if="loading && orders.length === 0" class="empty-box">加载中...</view>
    <view v-else-if="orders.length === 0" class="empty-box">暂无已接单订单</view>

    <view v-else class="order-list">
      <view v-for="item in orders" :key="item.id" class="card order-card">
        <view class="row-between align-start">
          <view :class="['badge', `badge-${getStatusType(item.status || '')}`]">
            {{ getStatusText(item.status || 'PENDING') }}
          </view>
          <view class="muted small-text">{{ formatDateTime(item.created_at) }}</view>
        </view>

        <view class="address-box">
          <view class="address-row">
            <view class="dot pickup-dot"></view>
            <view class="address-main">
              <view class="addr-label">取件</view>
              <view class="addr-text">{{ item.pickup_address || '-' }}</view>
            </view>
          </view>
          <view class="address-connector">
            <view class="connector-line"></view>
          </view>
          <view class="address-row">
            <view class="dot delivery-dot"></view>
            <view class="address-main">
              <view class="addr-label">送达</view>
              <view class="addr-text">{{ item.delivery_address || '-' }}</view>
            </view>
          </view>
        </view>

        <view class="row-between earning-row">
          <text class="muted">收益</text>
          <text class="success price-text">{{ formatMoney(item._finalPrice ?? 0) }}</text>
        </view>

        <view class="mini-route-box">
          <view class="route-header">
            <view class="route-title">配送进度</view>
            <view class="route-eta">
              <text v-if="(item._etaMinutes ?? 0) > 0">剩余约 {{ item._etaMinutes }} 分钟</text>
              <text v-else class="muted">已完成</text>
            </view>
          </view>
          <view class="route-track">
            <view class="track-node track-start"></view>
            <view class="track-node track-mid"></view>
            <view class="track-node track-end"></view>
            <view class="progress-bg"></view>
            <view class="progress-fill" :style="{ width: `${Math.max(0, Math.min(100, Number(item._progress) || 0))}%` }"></view>
            <view
              class="runner-dot"
              :style="{ left: progressDotStyle(item._progress ?? 0).left }"
            >
              <view class="runner-pulse"></view>
              <view class="runner-core"></view>
            </view>
          </view>
          <view class="progress-percent">
            <text>{{ Math.round(Math.max(0, Math.min(100, Number(item._progress) || 0))) }}%</text>
          </view>
        </view>

        <view class="message-preview">
          <view class="msg-icon">💬</view>
          <view class="msg-text muted">{{ item._lastMessage || '暂无' }}</view>
        </view>

        <view v-if="item.pickup_photo_url || item.delivery_photo_url" class="thumb-list photo-list">
          <image
            v-if="item.pickup_photo_url"
            class="thumb-image"
            :src="toAbsoluteFileUrl(item.pickup_photo_url)"
            mode="aspectFill"
          />
          <image
            v-if="item.delivery_photo_url"
            class="thumb-image"
            :src="toAbsoluteFileUrl(item.delivery_photo_url)"
            mode="aspectFill"
          />
        </view>

        <view class="grid-2 action-grid">
          <view class="btn-ghost action-btn" @tap="openTaskDetail(item.task_id || item.id)">详情</view>
          <view class="btn-secondary action-btn" @tap="openChat(item)">消息</view>
          <view
            v-if="runnerNextAction(item).type !== 'none'"
            class="btn-primary action-btn span-2"
            @tap="handleRunnerAction(item)"
          >
            {{ runnerNextAction(item).label }}
          </view>
          <view
            v-else-if="item._isReviewed"
            class="btn-ghost action-btn span-2 disabled-btn"
          >
            已评价
          </view>
          <view
            v-else-if="normalizeStatus(item.status) === 'COMPLETED' && !item._isReviewed"
            class="btn-secondary action-btn span-2"
            @tap="openTaskDetail(item.task_id || item.id)"
          >
            去评价
          </view>
          <view v-else class="btn-ghost action-btn span-2 disabled-btn">
            等待处理
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.mini-btn {
  width: 140rpx;
  height: 68rpx;
  font-size: 24rpx;
}

.small-text {
  font-size: 22rpx;
}

.align-start {
  align-items: flex-start;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 24rpx;
}

.order-card {
  position: relative;
}

.address-box {
  margin-top: 24rpx;
  background: #f9fafb;
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
}

.address-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  margin-top: 8rpx;
  flex-shrink: 0;
  box-shadow: 0 0 0 4rpx rgba(255, 255, 255, 0.9);
}

.pickup-dot {
  background: #16a34a;
}

.delivery-dot {
  background: #ef4444;
}

.address-connector {
  padding-left: 9rpx;
  height: 28rpx;
  display: flex;
  align-items: center;
}

.connector-line {
  width: 2rpx;
  height: 100%;
  background: linear-gradient(180deg, rgba(22, 163, 74, 0.4), rgba(239, 68, 68, 0.4));
}

.address-main {
  flex: 1;
  min-width: 0;
}

.addr-label {
  font-size: 22rpx;
  color: #9ca3af;
  margin-bottom: 4rpx;
}

.addr-text {
  font-size: 28rpx;
  color: #111827;
  line-height: 1.5;
  word-break: break-all;
}

.earning-row {
  margin-top: 20rpx;
}

.price-text {
  font-size: 36rpx;
  font-weight: 700;
}

.mini-route-box {
  margin-top: 24rpx;
  background: linear-gradient(135deg, #eff6ff, #f0fdf4);
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
}

.route-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.route-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
}

.route-eta {
  font-size: 24rpx;
  color: #2563eb;
  font-weight: 500;
}

.route-track {
  position: relative;
  height: 20rpx;
  margin: 24rpx 8rpx 16rpx;
}

.track-node {
  position: absolute;
  top: 50%;
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  transform: translateY(-50%);
  z-index: 2;
}

.track-start {
  left: 0;
  background: #22c55e;
  box-shadow: 0 0 0 4rpx rgba(34, 197, 94, 0.2);
}

.track-mid {
  left: 42%;
  background: #3b82f6;
  box-shadow: 0 0 0 4rpx rgba(59, 130, 246, 0.2);
}

.track-end {
  right: 0;
  background: #ef4444;
  box-shadow: 0 0 0 4rpx rgba(239, 68, 68, 0.2);
}

.progress-bg {
  position: absolute;
  left: 10rpx;
  right: 10rpx;
  top: 50%;
  height: 8rpx;
  transform: translateY(-50%);
  background: #d1d5db;
  border-radius: 999rpx;
  z-index: 1;
}

.progress-fill {
  position: absolute;
  left: 10rpx;
  top: 50%;
  height: 8rpx;
  transform: translateY(-50%);
  background: linear-gradient(90deg, #22c55e, #3b82f6, #ef4444);
  border-radius: 999rpx;
  z-index: 1;
  transition: width 0.8s ease-out;
  min-width: 0;
  max-width: calc(100% - 20rpx);
}

.runner-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 36rpx;
  height: 36rpx;
  z-index: 5;
  transition: left 0.8s ease-out;
}

.runner-pulse {
  position: absolute;
  inset: -8rpx;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.3);
  animation: pulseAnim 1.6s ease-out infinite;
}

.runner-core {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: 4rpx solid #fff;
  box-shadow: 0 4rpx 12rpx rgba(37, 99, 235, 0.4);
}

@keyframes pulseAnim {
  0% {
    transform: scale(0.7);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

.progress-percent {
  text-align: right;
  font-size: 22rpx;
  color: #6b7280;
  font-weight: 600;
}

.message-preview {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  background: #fafafa;
  border-radius: 16rpx;
}

.msg-icon {
  font-size: 28rpx;
  flex-shrink: 0;
}

.msg-text {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-list {
  margin-top: 20rpx;
}

.action-grid {
  margin-top: 24rpx;
}

.span-2 {
  grid-column: span 2;
}

.action-btn {
  height: 72rpx;
  font-size: 26rpx;
}

.disabled-btn {
  opacity: 0.55;
  pointer-events: none;
}
</style>
