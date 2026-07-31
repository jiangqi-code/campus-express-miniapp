<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import type { TaskItem } from '@/types/models'
import { formatDateTime, formatMoney, getStatusText, getStatusType, parseImageList, toAbsoluteFileUrl } from '@/utils/format'
import { http } from '@/utils/request'
import { haversineDistance } from '@/utils/location'

const authStore = useAuthStore()
const loading = ref(false)
const accepting = ref(false)
const cancelling = ref(false)
const task = ref<TaskItem | null>(null)
const taskId = ref('')
const errorMsg = ref('')
const routeDistanceMeters = ref(0)
const routeDurationSeconds = ref(0)
const runnerPosition = ref<{ latitude: number; longitude: number } | null>(null)
let runnerLocationTimer: ReturnType<typeof setInterval> | undefined
let simulationProgress = 0

const markers = computed(() => {
  const current = task.value
  if (!current) return []
  const points = []
  if (current.pickup_lat && current.pickup_lng) {
    points.push({
      id: 1,
      latitude: Number(current.pickup_lat),
      longitude: Number(current.pickup_lng),
      title: '取件点',
      width: 28,
      height: 28,
      callout: {
        content: '取件点',
        display: 'BYCLICK',
        padding: 8,
        borderRadius: 4,
        bgColor: '#2563eb',
        color: '#ffffff',
      },
    })
  }
  if (current.delivery_lat && current.delivery_lng) {
    points.push({
      id: 2,
      latitude: Number(current.delivery_lat),
      longitude: Number(current.delivery_lng),
      title: '送达点',
      width: 28,
      height: 28,
      callout: {
        content: '送达点',
        display: 'BYCLICK',
        padding: 8,
        borderRadius: 4,
        bgColor: '#16a34a',
        color: '#ffffff',
      },
    })
  }
  if (runnerPosition.value) {
    points.push({
      id: 3,
      latitude: runnerPosition.value.latitude,
      longitude: runnerPosition.value.longitude,
      title: '跑腿员（模拟位置）',
      width: 30,
      height: 30,
      callout: { content: '跑腿员 · 模拟位置', display: 'ALWAYS', padding: 8, borderRadius: 12, bgColor: '#f59e0b', color: '#ffffff' },
    })
  }
  return points
})

const routePolyline = computed(() => {
  const current = task.value
  if (!current?.pickup_lat || !current.pickup_lng || !current.delivery_lat || !current.delivery_lng) return []
  return [{
    points: [
      { latitude: Number(current.pickup_lat), longitude: Number(current.pickup_lng) },
      { latitude: Number(current.delivery_lat), longitude: Number(current.delivery_lng) },
    ],
    color: '#3b82f6',
    width: 5,
    arrowLine: true,
  }]
})

const mapCenter = computed(() => {
  const current = task.value
  if (!current) return { lat: 39.909, lng: 116.397 }
  const lat = Number(current.pickup_lat || current.delivery_lat || 39.909)
  const lng = Number(current.pickup_lng || current.delivery_lng || 116.397)
  return { lat, lng }
})

const imageList = computed(() => {
  const current = task.value
  if (!current) return []
  return parseImageList(current.images?.length ? current.images : current.item_image || []).map((item) =>
    toAbsoluteFileUrl(item),
  )
})

const statusBadgeClass = computed(() => {
  const type = getStatusType(task.value?.status || 'PENDING')
  const map: Record<string, string> = {
    success: 'badge-success',
    warning: 'badge-warning',
    primary: 'badge-primary',
    info: 'badge-default',
    danger: 'badge-danger',
    default: 'badge-default',
  }
  return map[type] || 'badge-default'
})

const isPublisher = computed(() => {
  const current = task.value
  const profileId = authStore.profile?.id
  if (!current || !profileId) return false
  const pubId = current.publisher?.id || current.publisher?.userId || current.publisher?.user_id
  return String(pubId) === String(profileId)
})

const isPendingStatus = computed(() => {
  const status = (task.value?.status || '').toUpperCase()
  return status === 'PENDING'
})

const canCancel = computed(() => {
  return isPublisher.value && isPendingStatus.value
})

const canAccept = computed(() => {
  return authStore.role === 'runner' && isPendingStatus.value && !isPublisher.value
})

const resolvedOrderId = computed(() => String(
  task.value?.order_id ?? (task.value as any)?.orderId ?? (task.value as any)?.order?.id ?? (task.value as any)?.order?.order_id ?? '',
).trim())
const hasOrder = computed(() => Boolean(resolvedOrderId.value))
const hasRelatedOrder = computed(() => hasOrder.value || !['', 'PENDING', 'CANCELLED', 'CANCELED'].includes(String(task.value?.status || '').toUpperCase()))
const runnerId = computed(() => String(task.value?.runner?.id ?? task.value?.runner?.user_id ?? task.value?.runner?.userId ?? '').trim())
const isCurrentRunner = computed(() => Boolean(runnerId.value && String(authStore.profile?.id || '') === runnerId.value))
const canRevealContacts = computed(() => hasOrder.value && (isPublisher.value || isCurrentRunner.value || authStore.role === 'admin'))

function privacyPhone(raw: unknown) {
  const phone = String(raw ?? '').replace(/\s/g, '')
  if (!phone) return '未提供联系方式'
  if (!hasOrder.value) return '接单后可见'
  if (!canRevealContacts.value) return '仅交易双方可见'
  return /^1\d{10}$/.test(phone) ? phone : phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2')
}

const totalAmount = computed(() => {
  const fee = Number(task.value?.fee_total || 0)
  const tip = Number(task.value?.tip || 0)
  return formatMoney(fee + tip)
})

const routeDistanceText = computed(() => routeDistanceMeters.value > 0
  ? routeDistanceMeters.value < 1000 ? `${routeDistanceMeters.value} m` : `${(routeDistanceMeters.value / 1000).toFixed(2)} km`
  : '待计算')
const routeDurationText = computed(() => routeDurationSeconds.value > 0 ? `约 ${Math.ceil(routeDurationSeconds.value / 60)} 分钟` : '待计算')

async function loadRouteMetrics() {
  const current = task.value
  if (!current?.pickup_lat || !current.pickup_lng || !current.delivery_lat || !current.delivery_lng) return
  const pickup = { latitude: Number(current.pickup_lat), longitude: Number(current.pickup_lng), address: '' }
  const delivery = { latitude: Number(current.delivery_lat), longitude: Number(current.delivery_lng), address: '' }
  const fallbackDistance = Math.round(haversineDistance(pickup, delivery))
  routeDistanceMeters.value = fallbackDistance
  routeDurationSeconds.value = Math.max(60, Math.round(fallbackDistance / 4.2))
  try {
    const result = await http.post<any>('/map/distance', {
      origin_lat: pickup.latitude,
      origin_lng: pickup.longitude,
      destination_lat: delivery.latitude,
      destination_lng: delivery.longitude,
    })
    const data = result?.data ?? result
    routeDistanceMeters.value = Number(data?.distance_meters || fallbackDistance)
    routeDurationSeconds.value = Number(data?.duration_seconds || routeDurationSeconds.value)
  } catch {}
}

function startRunnerLocationSimulation() {
  if (runnerLocationTimer) clearInterval(runnerLocationTimer)
  const current = task.value
  if (!current?.runner || !current.pickup_lat || !current.pickup_lng || !current.delivery_lat || !current.delivery_lng) return
  const explicitLat = Number((current.runner as any)?.latitude ?? (current.runner as any)?.lat)
  const explicitLng = Number((current.runner as any)?.longitude ?? (current.runner as any)?.lng)
  simulationProgress = 0.15
  runnerPosition.value = Number.isFinite(explicitLat) && Number.isFinite(explicitLng)
    ? { latitude: explicitLat, longitude: explicitLng }
    : { latitude: Number(current.pickup_lat), longitude: Number(current.pickup_lng) }
  runnerLocationTimer = setInterval(() => {
    if (!task.value) return
    simulationProgress = Math.min(0.92, simulationProgress + 0.025)
    runnerPosition.value = {
      latitude: Number(task.value.pickup_lat) + (Number(task.value.delivery_lat) - Number(task.value.pickup_lat)) * simulationProgress,
      longitude: Number(task.value.pickup_lng) + (Number(task.value.delivery_lng) - Number(task.value.pickup_lng)) * simulationProgress,
    }
  }, 5000)
}

const fetchDetail = async () => {
  if (!taskId.value) {
    errorMsg.value = '任务ID不存在'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await http.get<any>(`/task/detail/${encodeURIComponent(taskId.value)}`)
    const data = result?.data ?? result
    task.value = data
    await loadRouteMetrics()
    startRunnerLocationSimulation()
  } catch (error: any) {
    errorMsg.value = error.message || '任务详情加载失败'
    uni.showToast({ title: errorMsg.value, icon: 'none' })
  } finally {
    loading.value = false
  }
}

const acceptTask = async () => {
  if (authStore.role !== 'runner') {
    uni.showToast({ title: '切换为跑腿员后可接单', icon: 'none' })
    return
  }
  if (!isPendingStatus.value) {
    uni.showToast({ title: '该任务已被接单或已取消', icon: 'none' })
    return
  }
  if (!task.value?.id) return
  accepting.value = true
  try {
    await http.post(`/order/accept/${encodeURIComponent(task.value.id)}`)
    uni.showToast({ title: '接单成功', icon: 'success' })
    fetchDetail()
  } catch (error: any) {
    uni.showToast({ title: error.message || '接单失败', icon: 'none' })
  } finally {
    accepting.value = false
  }
}

const cancelTask = () => {
  if (!canCancel.value) {
    uni.showToast({ title: '当前状态无法取消', icon: 'none' })
    return
  }
  uni.showModal({
    title: '取消任务',
    content: '确定取消该任务吗？取消后不可恢复。',
    confirmText: '确定取消',
    confirmColor: '#dc2626',
    success: async (res) => {
      if (!res.confirm) return
      if (!task.value?.id) return
      cancelling.value = true
      try {
        await http.delete(`/task/${encodeURIComponent(task.value.id)}/cancel`)
        uni.showToast({ title: '取消成功', icon: 'success' })
        fetchDetail()
      } catch (error: any) {
        uni.showToast({ title: error.message || '取消失败', icon: 'none' })
      } finally {
        cancelling.value = false
      }
    },
  })
}

const previewImages = (current: string) => {
  if (imageList.value.length === 0) return
  uni.previewImage({
    urls: imageList.value,
    current,
  })
}

const goBack = () => {
  uni.navigateBack()
}

const goOrderDetail = () => {
  if (resolvedOrderId.value) {
    uni.navigateTo({ url: `/pages/order/detail?id=${encodeURIComponent(resolvedOrderId.value)}` })
    return
  }
  authStore.role === 'runner' ? goTakenOrders() : goPublishedOrders()
}

const openNavigation = () => {
  if (!task.value?.delivery_lat || !task.value.delivery_lng) {
    uni.showToast({ title: '送达点坐标不可用', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: Number(task.value.delivery_lat),
    longitude: Number(task.value.delivery_lng),
    name: '任务送达点',
    address: task.value.delivery_address || '',
    scale: 16,
  })
}

const goPublishedOrders = () => {
  uni.navigateTo({ url: '/pages/order/published' })
}

const goTakenOrders = () => {
  uni.navigateTo({ url: '/pages/order/taken' })
}

const retryFetch = () => {
  fetchDetail()
}

onLoad(async (query) => {
  taskId.value = String(query?.id ?? '')
  await authStore.bootstrap()
  fetchDetail()
})

onBeforeUnmount(() => { if (runnerLocationTimer) clearInterval(runnerLocationTimer) })
</script>

<template>
  <view class="page-shell">
    <view class="card nav-card">
      <view class="nav-back" @tap="goBack">
        <text class="back-icon">←</text>
        <text>返回</text>
      </view>
    </view>

    <view v-if="loading" class="empty-box">
      <view class="loading-spinner"></view>
      <text>加载中...</text>
    </view>

    <view v-else-if="errorMsg && !task" class="empty-box">
      <text class="empty-title">加载失败</text>
      <text class="empty-desc">{{ errorMsg }}</text>
      <view class="btn-primary retry-btn" @tap="retryFetch">重新加载</view>
    </view>

    <view v-else-if="!task" class="empty-box">
      <text class="empty-title">未找到任务信息</text>
      <text class="empty-desc">该任务可能已被删除或链接无效</text>
      <view class="btn-secondary retry-btn" @tap="goBack">返回上一页</view>
    </view>

    <template v-else>
      <view class="card">
        <view class="row-between gap-12">
          <view class="section-title">任务信息</view>
          <view class="badge" :class="statusBadgeClass">
            {{ getStatusText(task.status || 'PENDING') }}
          </view>
        </view>

        <view class="detail-row">
          <text class="muted">任务编号</text>
          <text class="detail-value">{{ task.id }}</text>
        </view>
        <view class="detail-row">
          <text class="muted">发布时间</text>
          <text class="detail-value">{{ formatDateTime(task.created_at) }}</text>
        </view>
        <view class="detail-row">
          <text class="muted">物品类型</text>
          <text class="detail-value">{{ task.task_type || task.type || '-' }}</text>
        </view>
        <view class="detail-row">
          <text class="muted">配送费</text>
          <text class="detail-value primary">{{ formatMoney(task.fee_total || 0) }}</text>
        </view>
        <view class="detail-row">
          <text class="muted">小费</text>
          <text class="detail-value success">{{ formatMoney(task.tip || 0) }}</text>
        </view>
        <view class="detail-row total-row">
          <text class="muted">合计金额</text>
          <text class="detail-value total-amount">{{ totalAmount }}</text>
        </view>

        <view class="address-card">
          <view class="address-block">
            <view class="address-tag pickup">取</view>
            <view class="address-content">
              <text class="address-text">{{ task.pickup_address || '-' }}</text>
            </view>
          </view>
          <view class="address-divider"></view>
          <view class="address-block">
            <view class="address-tag delivery">送</view>
            <view class="address-content">
              <text class="address-text">{{ task.delivery_address || '-' }}</text>
            </view>
          </view>
          <view v-if="task.remark" class="remark-block">
            <text class="remark-label">备注</text>
            <text class="remark-text">{{ task.remark }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="section-title">任务位置</view>
        <map
          class="detail-map"
          :latitude="mapCenter.lat"
          :longitude="mapCenter.lng"
          :markers="markers"
          :polyline="routePolyline"
          scale="14"
          :show-location="false"
          :enable-3D="false"
          :enable-zoom="true"
          :enable-scroll="true"
          :enable-rotate="false"
        />
        <view class="route-summary">
          <view><text class="route-summary-label">路线距离</text><text class="route-summary-value">{{ routeDistanceText }}</text></view>
          <view><text class="route-summary-label">预计时间</text><text class="route-summary-value">{{ routeDurationText }}</text></view>
          <button class="navigation-button" @tap="openNavigation">打开地图导航</button>
        </view>
        <view class="map-legend">
          <view class="legend-item">
            <view class="legend-dot pickup"></view>
            <text class="muted">取件点</text>
          </view>
          <view v-if="runnerPosition" class="legend-item">
            <view class="legend-dot runner"></view>
            <text class="muted">跑腿员（模拟更新）</text>
          </view>
          <view class="legend-item">
            <view class="legend-dot delivery"></view>
            <text class="muted">送达点</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="section-title">发布者信息</view>
        <view class="user-block">
          <view class="user-avatar">
            {{ (task.publisher?.nickname || task.publisher?.name || 'U').slice(0, 1) }}
          </view>
          <view class="user-info">
            <text class="user-name">{{ task.publisher?.nickname || task.publisher?.name || '匿名用户' }}</text>
            <view class="user-meta">
              <text class="credit-score">信用分 {{ task.publisher?.credit_score || task.publisher?.creditScore || 0 }}</text>
              <text class="identity-tag">发布者</text>
            </view>
            <text class="contact-line">{{ privacyPhone(task.publisher?.phone || task.publisher?.mobile) }}</text>
          </view>
        </view>

        <template v-if="task.runner">
          <view class="divider-line"></view>
          <view class="section-title runner-title">跑腿员信息</view>
          <view class="user-block">
            <view class="user-avatar runner">
              {{ (task.runner?.nickname || task.runner?.name || 'R').slice(0, 1) }}
            </view>
            <view class="user-info">
              <text class="user-name">{{ task.runner?.nickname || task.runner?.name || '跑腿员' }}</text>
              <view class="user-meta">
                <text class="identity-tag runner-tag">已接单跑腿员</text>
                <text class="live-status">位置每 5 秒更新</text>
              </view>
              <text class="contact-line">{{ privacyPhone(task.runner?.phone || task.runner?.mobile) }}</text>
            </view>
          </view>
        </template>
      </view>

      <view v-if="imageList.length" class="card">
        <view class="row-between">
          <view class="section-title">任务图片</view>
          <text class="muted">共 {{ imageList.length }} 张</text>
        </view>
        <view class="thumb-list image-list">
          <image
            v-for="(item, index) in imageList"
            :key="index"
            class="thumb-image"
            :src="item"
            mode="aspectFill"
            @tap="previewImages(item)"
          />
        </view>
      </view>

      <view class="footer-actions" :class="{ single: !canCancel && !hasOrder }">
        <view v-if="canCancel" class="btn-danger" :class="{ disabled: cancelling }" @tap="cancelTask">
          {{ cancelling ? '取消中...' : '取消任务' }}
        </view>
        <view v-if="hasRelatedOrder" class="btn-secondary" @tap="goOrderDetail">查看订单详情</view>
        <view v-if="authStore.role === 'runner' && !canAccept && !hasOrder" class="btn-ghost" @tap="goTakenOrders">
          我的接单
        </view>
        <view v-if="authStore.role === 'user' && !canCancel" class="btn-ghost" @tap="goPublishedOrders">
          我的发布
        </view>
        <view
          v-if="canAccept"
          class="btn-primary"
          :class="{ disabled: accepting }"
          @tap="acceptTask"
        >
          {{ accepting ? '抢单中...' : '立即抢单' }}
        </view>
      </view>

      <view class="safe-bottom"></view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.nav-card {
  padding: 16rpx 24rpx;
  margin-bottom: 20rpx;
}

.nav-back {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #374151;
  font-size: 28rpx;
}

.back-icon {
  font-size: 32rpx;
  font-weight: 600;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  margin: 0 auto 20rpx;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
  margin-bottom: 12rpx;
}

.empty-desc {
  display: block;
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 32rpx;
}

.retry-btn {
  width: 280rpx;
  margin: 0 auto;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18rpx;
  gap: 16rpx;
}

.detail-value {
  max-width: 60%;
  text-align: right;
  word-break: break-all;
  font-size: 28rpx;
  color: #111827;
}

.total-row {
  padding-top: 16rpx;
  margin-top: 24rpx;
  border-top: 2rpx dashed #e5e7eb;
}

.total-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #ef4444;
}

.address-card {
  margin-top: 28rpx;
  padding: 24rpx;
  background: linear-gradient(180deg, #f9fafb 0%, #ffffff 100%);
  border-radius: 20rpx;
  border: 2rpx solid #f3f4f6;
}

.address-block {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.address-tag {
  width: 48rpx;
  height: 48rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
}

.address-tag.pickup {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
}

.address-tag.delivery {
  background: linear-gradient(135deg, #16a34a, #22c55e);
}

.address-content {
  flex: 1;
  min-height: 48rpx;
  display: flex;
  align-items: center;
}

.address-text {
  font-size: 28rpx;
  color: #111827;
  line-height: 1.5;
}

.address-divider {
  height: 24rpx;
  margin-left: 22rpx;
  border-left: 2rpx dashed #d1d5db;
}

.remark-block {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 2rpx dashed #e5e7eb;
}

.remark-label {
  display: inline-block;
  font-size: 24rpx;
  color: #6b7280;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

.remark-text {
  display: block;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.6;
}

.detail-map {
  width: 100%;
  height: 400rpx;
  margin-top: 20rpx;
  border-radius: 20rpx;
  overflow: hidden;
}

.map-legend {
  display: flex;
  gap: 32rpx;
  margin-top: 16rpx;
  padding: 0 8rpx;
}

.route-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: #f5f6f7;
}
.route-summary > view { display: flex; flex-direction: column; gap: 6rpx; }
.route-summary-label { color: #86909c; font-size: 22rpx; }
.route-summary-value { color: #1d2129; font-size: 28rpx; font-weight: 700; }
.navigation-button { grid-column: 1 / -1; height: 72rpx; border-radius: 14rpx; background: #eef3ff; color: #3b82f6; font-size: 26rpx; font-weight: 600; }

.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.legend-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.legend-dot.pickup {
  background: #2563eb;
}

.legend-dot.delivery {
  background: #16a34a;
}
.legend-dot.runner { background: #f59e0b; }

.user-block {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 20rpx;
}

.user-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.user-avatar.runner {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
  color: #15803d;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.user-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.credit-score {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 14rpx;
  background: #fef3c7;
  color: #b45309;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.identity-tag { padding: 4rpx 12rpx; border-radius: 999rpx; background: #eef3ff; color: #3b82f6; font-size: 21rpx; }
.runner-tag { background: #e8ffea; color: #10b981; }
.live-status { color: #f59e0b; font-size: 21rpx; }
.contact-line { color: #4e5969; font-size: 24rpx; }

.divider-line {
  height: 2rpx;
  background: #f3f4f6;
  margin: 28rpx -24rpx;
}

.runner-title {
  margin-top: 0;
}

.image-list {
  margin-top: 20rpx;
}

.footer-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 0;
}

.footer-actions.single {
  grid-template-columns: 1fr;
}

.btn-primary.disabled,
.btn-danger.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}

/* Commercial task detail */
.detail-page{background:#f2f4f8}.hero-card,.detail-card,.runner-card,.timeline-card{border:0;border-radius:40rpx;box-shadow:0 4rpx 24rpx rgba(0,0,0,.06)}.status-card{background:linear-gradient(135deg,#eff6ff,#f5f3ff);border:2rpx solid #dbeafe}.detail-map{border:8rpx solid #fff;border-radius:32rpx!important;box-shadow:0 4rpx 20rpx rgba(15,23,42,.08)}.timeline-item:before,.timeline-dot{background:#3b82f6;box-shadow:0 0 0 8rpx #dbeafe}.runner-avatar{border:4rpx solid #fff;box-shadow:0 6rpx 18rpx rgba(99,102,241,.16)}.price,.amount{color:#f59e0b!important;font-size:48rpx!important}.accept-button,.bottom-primary,.btn-primary{background:linear-gradient(135deg,#f59e0b,#f97316);box-shadow:0 12rpx 28rpx rgba(245,158,11,.24)}
</style>
