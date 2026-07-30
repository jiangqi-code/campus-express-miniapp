<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, formatMoney, getStatusText } from '@/utils/format'
import { http } from '@/utils/request'

const authStore = useAuthStore()
const orderId = ref('')
const order = ref<any>(null)
const loading = ref(false)
const errorMessage = ref('')

const task = computed(() => order.value?.task ?? {})
const amount = computed(() => order.value?.final_price ?? order.value?.amount ?? task.value?.fee_total ?? 0)
const statusSteps = ['已接单', '已取件', '配送中', '已完成']
const statusIndex = computed(() => {
  const status = String(order.value?.status || '').toUpperCase()
  if (['COMPLETED', 'DONE', 'FINISHED'].includes(status)) return 3
  if (['DELIVERING', 'IN_DELIVERY'].includes(status)) return 2
  if (['PICKED_UP', 'PICKUP'].includes(status)) return 1
  return 0
})
const pickupPhoto = computed(() => order.value?.pickup_photo_url || order.value?.pickupPhotoUrl || '')
const deliveryPhoto = computed(() => order.value?.delivery_photo_url || order.value?.deliveryPhotoUrl || '')
const runner = computed(() => order.value?.runner || order.value?.taker || task.value?.runner || {})
const pickupPoint = computed(() => ({
  latitude: Number(order.value?.pickup_latitude ?? task.value?.pickup_latitude ?? 0),
  longitude: Number(order.value?.pickup_longitude ?? task.value?.pickup_longitude ?? 0),
}))
const deliveryPoint = computed(() => ({
  latitude: Number(order.value?.delivery_latitude ?? task.value?.delivery_latitude ?? 0),
  longitude: Number(order.value?.delivery_longitude ?? task.value?.delivery_longitude ?? 0),
}))
const hasMap = computed(() => pickupPoint.value.latitude && pickupPoint.value.longitude && deliveryPoint.value.latitude && deliveryPoint.value.longitude)
const mapMarkers = computed(() => hasMap.value ? [
  { id: 1, ...pickupPoint.value, title: '取件点', width: 28, height: 28 },
  { id: 2, ...deliveryPoint.value, title: '送达点', width: 28, height: 28 },
] : [])
const mapPolyline = computed(() => hasMap.value ? [{ points: [pickupPoint.value, deliveryPoint.value], color: '#2563eb', width: 5 }] : [])

async function loadOrder() {
  if (!orderId.value) {
    errorMessage.value = '缺少订单编号'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const result = await http.get<any>(`/order/${encodeURIComponent(orderId.value)}`)
    order.value = result?.data ?? result
  } catch (error: any) {
    errorMessage.value = error?.message || '订单详情加载失败'
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openTask() {
  const taskId = order.value?.task_id ?? task.value?.id
  if (!taskId) return
  uni.navigateTo({ url: `/pages/task/detail?id=${encodeURIComponent(taskId)}` })
}

function openChat() {
  const publisherId = String(task.value?.publisher_id ?? order.value?.publisher_id ?? '')
  const takerId = String(order.value?.taker_id ?? order.value?.runner_id ?? runner.value?.id ?? '')
  const myId = String(authStore.profile?.id ?? '')
  const toUserId = myId === publisherId ? takerId : publisherId
  uni.navigateTo({ url: `/pages/order/chat?orderId=${encodeURIComponent(orderId.value)}&toUserId=${encodeURIComponent(toUserId)}` })
}

onLoad(async (query) => {
  orderId.value = String(query?.id ?? query?.orderId ?? '')
  await authStore.bootstrap()
  if (!authStore.isLogin) {
    uni.redirectTo({ url: '/pages/auth/index' })
    return
  }
  loadOrder()
})

onPullDownRefresh(loadOrder)
</script>

<template>
  <view class="page-shell">
    <view v-if="loading && !order" class="empty-box">订单加载中...</view>

    <view v-else-if="errorMessage && !order" class="empty-box">
      <view class="empty-title">加载失败</view>
      <view class="empty-desc">{{ errorMessage }}</view>
      <view class="btn-primary retry-button" @tap="loadOrder">重新加载</view>
    </view>

    <template v-else-if="order">
      <view class="card">
        <view class="row-between">
          <view>
            <view class="section-title">订单 #{{ order.id || orderId }}</view>
            <view class="section-desc">{{ formatDateTime(order.created_at) }}</view>
          </view>
          <view class="badge badge-primary">{{ getStatusText(order.status || 'PENDING') }}</view>
        </view>

        <view class="detail-row">
          <text class="muted">取件地址</text>
          <text class="detail-value">{{ order.pickup_address || task.pickup_address || '-' }}</text>
        </view>
        <view class="detail-row">
          <text class="muted">送达地址</text>
          <text class="detail-value">{{ order.delivery_address || task.delivery_address || '-' }}</text>
        </view>
        <view class="detail-row">
          <text class="muted">订单金额</text>
          <text class="detail-value primary">{{ formatMoney(amount) }}</text>
        </view>
      </view>

      <view class="card detail-section">
        <view class="section-title">订单进度</view>
        <view class="status-timeline">
          <view v-for="(label, index) in statusSteps" :key="label" class="timeline-step" :class="{ active: index <= statusIndex }">
            <view class="timeline-dot">{{ index + 1 }}</view>
            <text>{{ label }}</text>
          </view>
        </view>
      </view>

      <view class="card detail-section">
        <view class="section-title">配送地图</view>
        <map v-if="hasMap" class="order-map" :latitude="pickupPoint.latitude" :longitude="pickupPoint.longitude" :markers="mapMarkers" :polyline="mapPolyline" />
        <view v-else class="map-empty">暂无可用坐标</view>
      </view>

      <view class="card detail-section">
        <view class="section-title">配送凭证</view>
        <view v-if="pickupPhoto || deliveryPhoto" class="photo-grid">
          <view v-if="pickupPhoto"><image class="proof-photo" :src="pickupPhoto" mode="aspectFill" /><text class="muted">取件照片</text></view>
          <view v-if="deliveryPhoto"><image class="proof-photo" :src="deliveryPhoto" mode="aspectFill" /><text class="muted">送达照片</text></view>
        </view>
        <view v-else class="muted">暂无配送照片</view>
      </view>

      <view class="card detail-section">
        <view class="section-title">跑腿员信息</view>
        <view class="detail-row"><text class="muted">昵称</text><text>{{ runner.nickname || runner.name || '暂未接单' }}</text></view>
        <view class="detail-row"><text class="muted">信用分</text><text>{{ runner.credit_score ?? runner.creditScore ?? '-' }}</text></view>
        <view class="btn-primary chat-button" @tap="openChat">进入订单聊天</view>
      </view>

      <view class="btn-secondary task-button" @tap="openTask">查看关联任务</view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #eef0f3;
}

.detail-row:last-child {
  border-bottom: 0;
}

.detail-value {
  max-width: 68%;
  text-align: right;
}

.retry-button,
.task-button {
  margin-top: 24rpx;
}

.detail-section { margin-top: 24rpx; }
.status-timeline { display: flex; justify-content: space-between; margin-top: 28rpx; }
.timeline-step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10rpx; color: #9ca3af; font-size: 22rpx; }
.timeline-dot { width: 42rpx; height: 42rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e5e7eb; }
.timeline-step.active { color: #2563eb; font-weight: 600; }
.timeline-step.active .timeline-dot { background: #2563eb; color: #fff; }
.order-map { width: 100%; height: 360rpx; margin-top: 20rpx; border-radius: 16rpx; }
.map-empty { margin-top: 20rpx; padding: 80rpx 0; text-align: center; color: #9ca3af; background: #f9fafb; border-radius: 16rpx; }
.photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; margin-top: 20rpx; }
.proof-photo { width: 100%; height: 220rpx; border-radius: 14rpx; display: block; margin-bottom: 8rpx; }
.chat-button { margin-top: 24rpx; }
</style>
