<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import type { TaskItem } from '@/types/models'
import { formatDateTime, formatMoney, getStatusText, getStatusType, parseImageList, toAbsoluteFileUrl } from '@/utils/format'
import { http } from '@/utils/request'

const authStore = useAuthStore()
const loading = ref(false)
const accepting = ref(false)
const cancelling = ref(false)
const task = ref<TaskItem | null>(null)
const taskId = ref('')
const errorMsg = ref('')

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
  return points
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

const hasOrder = computed(() => {
  return Boolean(task.value?.order_id)
})

const totalAmount = computed(() => {
  const fee = Number(task.value?.fee_total || 0)
  const tip = Number(task.value?.tip || 0)
  return formatMoney(fee + tip)
})

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
  if (!task.value?.order_id) return
  uni.navigateTo({ url: `/pages/order/detail?id=${encodeURIComponent(task.value.order_id)}` })
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
          scale="14"
          :show-location="false"
          :enable-3D="false"
          :enable-zoom="true"
          :enable-scroll="true"
          :enable-rotate="false"
        />
        <view class="map-legend">
          <view class="legend-item">
            <view class="legend-dot pickup"></view>
            <text class="muted">取件点</text>
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
            </view>
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
                <text class="muted">{{ task.runner?.phone || task.runner?.mobile || '联系方式保密' }}</text>
              </view>
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
        <view v-if="hasOrder" class="btn-secondary" @tap="goOrderDetail">查看订单</view>
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
</style>
