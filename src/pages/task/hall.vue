<template>
  <view class="page-shell">
    <view class="card search-card">
      <view class="search-row">
        <view class="input search-input">
          <text class="search-icon">🔍</text>
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索地址、备注..."
            confirm-type="search"
            @confirm="fetchTasks(1)"
          />
          <text v-if="keyword" class="clear-btn" @tap="clearKeyword">×</text>
        </view>
        <view class="locate-btn" @tap="refreshLocation" :class="{ 'locate-loading': locating }">
          <text class="locate-icon">📍</text>
        </view>
      </view>

      <scroll-view scroll-x class="type-scroll" :show-scrollbar="false">
        <view class="type-list">
          <view
            v-for="type in itemTypes"
            :key="type"
            class="type-tag"
            :class="{ active: itemType === type }"
            @tap="selectType(type)"
          >
            {{ type }}
          </view>
        </view>
      </scroll-view>

      <view class="sort-row">
        <view
          v-for="sort in sortOptions"
          :key="sort.value"
          class="sort-item"
          :class="{ active: sortType === sort.value }"
          @tap="selectSort(sort.value)"
        >
          <text class="sort-label">{{ sort.label }}</text>
          <text v-if="sortType === sort.value && sort.value !== 'latest'" class="sort-arrow">
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </text>
        </view>
      </view>
    </view>

    <view v-if="errorMsg" class="card error-card">
      <view class="error-icon">⚠️</view>
      <view class="error-content">
        <text class="error-title">加载失败</text>
        <text class="error-msg">{{ errorMsg }}</text>
      </view>
      <view class="btn-primary error-retry" @tap="fetchTasks(1)">重新加载</view>
    </view>

    <view v-if="skeletonLoading" class="skeleton-list">
      <view v-for="i in 3" :key="i" class="card skeleton-card">
        <view class="skeleton-row skeleton-title"></view>
        <view class="skeleton-row skeleton-address"></view>
        <view class="skeleton-row skeleton-address"></view>
        <view class="skeleton-row skeleton-meta"></view>
        <view class="skeleton-row skeleton-btn"></view>
      </view>
    </view>

    <scroll-view
      v-else-if="!errorMsg"
      scroll-y
      class="task-list"
      @scrolltolower="handleScrollToLower"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onPullDownRefresh"
    >
      <view v-if="processedTasks.length === 0" class="card empty-card">
        <view class="empty-box">
          <text class="empty-icon">📦</text>
          <text class="empty-text">{{ loading ? '加载中...' : '暂无任务，稍后再来看看吧' }}</text>
        </view>
      </view>

      <view v-for="task in processedTasks" :key="task.id" class="card task-card">
        <view class="row-between task-header">
          <view class="row gap-12">
            <view class="badge badge-primary">{{ task.task_type || task.type || '跑腿' }}</view>
            <view
              class="badge"
              :class="getCountdownBadgeClass(task)"
              v-if="getRemainingSeconds(task) > 0"
            >
              ⏱ {{ formatCountdown(getRemainingSeconds(task)) }}
            </view>
            <view class="badge badge-danger" v-else>已超时</view>
          </view>
          <text class="task-price">{{ formatMoney(task.fee_total || 0) }}</text>
        </view>

        <view v-if="task.tip && Number(task.tip) > 0" class="tip-row">
          <text class="tip-badge">小费</text>
          <text class="tip-amount">+{{ formatMoney(task.tip) }}</text>
        </view>

        <view class="route-section">
          <view class="route-item">
            <view class="route-dot pickup-dot"></view>
            <view class="route-line"></view>
            <view class="route-dot delivery-dot"></view>
          </view>
          <view class="route-content">
            <view class="address-block">
              <text class="address-label">取件</text>
              <text class="address-text">{{ task.pickup_address || '待填写' }}</text>
            </view>
            <view class="address-block">
              <text class="address-label">送达</text>
              <text class="address-text">{{ task.delivery_address || '待填写' }}</text>
            </view>
          </view>
        </view>

        <view class="task-meta row-between">
          <view class="row gap-16">
            <view class="meta-item">
              <text class="meta-icon">📏</text>
              <text class="meta-text">{{ formatDistance(task.distance) }}</text>
            </view>
            <view class="meta-item">
              <text class="meta-icon">🚴</text>
              <text class="meta-text">约{{ estimateETA(task.distance) }}</text>
            </view>
            <view class="meta-item">
              <text class="meta-icon">🕐</text>
              <text class="meta-text">{{ formatRelativeTime(task.created_at) }}</text>
            </view>
          </view>
        </view>

        <view v-if="task.remark" class="remark-section">
          <text class="remark-text">📝 {{ task.remark }}</text>
        </view>

        <view v-if="task.images && task.images.length > 0" class="thumb-list">
          <image
            v-for="(img, idx) in task.images.slice(0, 4)"
            :key="idx"
            :src="toAbsoluteFileUrl(img)"
            class="thumb-image"
            mode="aspectFill"
          />
        </view>

        <view class="action-row row-between">
          <view class="publisher-info">
            <text class="publisher-name">{{ task.publisher?.nickname || '匿名用户' }}</text>
          </view>
          <view v-if="canAcceptTask(task)">
            <button
              class="btn-primary accept-btn"
              :loading="grabbingTaskId === task.id"
              :disabled="grabbingTaskId !== null"
              @tap="grabTask(task)"
            >
              {{ grabbingTaskId === task.id ? '抢单中...' : '立即抢单' }}
            </button>
          </view>
          <view v-else-if="authStore.role !== 'runner'">
            <button class="btn-secondary accept-btn" disabled>切换跑腿员身份</button>
          </view>
          <view v-else-if="authStore.runnerAuthStatus !== 'APPROVED'">
            <button class="btn-secondary accept-btn" disabled>待认证</button>
          </view>
          <view v-else>
            <button class="btn-ghost accept-btn" disabled>已不可抢</button>
          </view>
        </view>
      </view>

      <view v-if="total > 0" class="pagination-section">
        <view class="row-between pagination-row">
          <button
            class="btn-secondary page-btn"
            :disabled="page <= 1 || loading"
            @tap="fetchTasks(page - 1)"
          >
            上一页
          </button>
          <text class="page-info">第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</text>
          <button
            class="btn-secondary page-btn"
            :disabled="page >= totalPages || loading"
            @tap="fetchTasks(page + 1)"
          >
            下一页
          </button>
        </view>
      </view>

      <view class="list-bottom-space"></view>
    </scroll-view>

    <view class="fab-wrapper" @tap="goPublish">
      <view class="fab-button">
        <text class="fab-icon">+</text>
      </view>
      <view class="fab-label">发布</view>
    </view>

    <AppTabBar current="hall" :unread-message-count="unreadCount" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import AppTabBar from '@/components/AppTabBar.vue'
import type { TaskItem } from '@/types/models'
import { ITEM_TYPES } from '@/config'
import {
  formatDistance,
  formatMoney,
  formatRelativeTime,
  toAbsoluteFileUrl,
} from '@/utils/format'
import { getCurrentLocation, haversineDistance } from '@/utils/location'
import { http } from '@/utils/request'

interface PublicConfig {
  pending_accept_minutes?: number
}

interface TaskWithComputed extends TaskItem {
  distance: number
  _remainingSeconds?: number
}

const authStore = useAuthStore()
const messageStore = useMessageStore()
const unreadCount = computed(() => messageStore.unreadCount)

const goPublish = () => {
  uni.navigateTo({ url: '/pages/task/publish' })
}

const loading = ref(false)
const skeletonLoading = ref(true)
const refreshing = ref(false)
const locating = ref(false)
const errorMsg = ref('')
const grabbingTaskId = ref<string | null>(null)

const keyword = ref('')
const itemType = ref('全部')
const sortType = ref<'latest' | 'reward' | 'distance'>('distance')
const sortOrder = ref<'asc' | 'desc'>('asc')

const currentLocation = ref<{ latitude: number; longitude: number } | null>(null)
const pendingAcceptMinutes = ref(30)

const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const tasks = ref<TaskItem[]>([])

const countdownTimer = ref<ReturnType<typeof setInterval> | null>(null)
const remainingSecondsMap = ref<Map<string, number>>(new Map())

const itemTypes = ['全部', ...ITEM_TYPES]

const sortOptions = [
  { label: '最新', value: 'latest' as const },
  { label: '价格', value: 'reward' as const },
  { label: '距离', value: 'distance' as const },
]

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const processedTasks = computed<TaskWithComputed[]>(() => {
  let list = tasks.value
    .filter((item) => {
      if (itemType.value && itemType.value !== '全部') {
        const type = String(item.task_type ?? item.type ?? '')
        if (type !== itemType.value) return false
      }
      const search = keyword.value.trim().toLowerCase()
      if (!search) return true
      const content = [item.pickup_address, item.delivery_address, item.remark, item.task_type]
        .join(' ')
        .toLowerCase()
      return content.includes(search)
    })
    .map((item) => {
      const pickupLat = Number(item.pickup_lat ?? 0)
      const pickupLng = Number(item.pickup_lng ?? 0)
      const distance = currentLocation.value && pickupLat && pickupLng
        ? haversineDistance(
            { latitude: currentLocation.value.latitude, longitude: currentLocation.value.longitude, address: '' },
            { latitude: pickupLat, longitude: pickupLng, address: '' },
          )
        : Number(item.distance ?? 0)

      const createdAt = item.created_at ? new Date(item.created_at).getTime() : Date.now()
      const expireTime = createdAt + pendingAcceptMinutes.value * 60 * 1000
      const remaining = Math.max(0, Math.floor((expireTime - Date.now()) / 1000))

      return {
        ...item,
        distance,
        _remainingSeconds: remaining,
      } as TaskWithComputed
    })

  if (remainingSecondsMap.value.size > 0) {
    list = list.map((item) => {
      const cached = remainingSecondsMap.value.get(item.id)
      if (cached !== undefined) {
        return { ...item, _remainingSeconds: cached }
      }
      return item
    })
  }

  if (sortType.value === 'latest') {
    list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      return timeB - timeA
    })
  } else if (sortType.value === 'reward') {
    list.sort((a, b) => {
      const priceA = Number(a.fee_total ?? 0) + Number(a.tip ?? 0)
      const priceB = Number(b.fee_total ?? 0) + Number(b.tip ?? 0)
      return sortOrder.value === 'asc' ? priceA - priceB : priceB - priceA
    })
  } else if (sortType.value === 'distance') {
    list.sort((a, b) => {
      const distA = Number(a.distance ?? 0)
      const distB = Number(b.distance ?? 0)
      if (distA === 0) return 1
      if (distB === 0) return -1
      return sortOrder.value === 'asc' ? distA - distB : distB - distA
    })
  }

  return list
})

const fetchPublicConfig = async () => {
  try {
    const result = await http.get<PublicConfig>('/config/public', {}, false)
    const data = (result as any)?.data ?? result
    if (data?.pending_accept_minutes && Number(data.pending_accept_minutes) > 0) {
      pendingAcceptMinutes.value = Number(data.pending_accept_minutes)
    }
  } catch {
    pendingAcceptMinutes.value = 30
  }
}

const initLocation = async () => {
  locating.value = true
  try {
    const loc = await getCurrentLocation()
    currentLocation.value = {
      latitude: loc.latitude,
      longitude: loc.longitude,
    }
  } catch {
    currentLocation.value = null
  } finally {
    locating.value = false
  }
}

const refreshLocation = async () => {
  await initLocation()
  if (currentLocation.value) {
    uni.showToast({ title: '定位成功', icon: 'success' })
  } else {
    uni.showToast({ title: '定位失败，请检查权限', icon: 'none' })
  }
  await fetchTasks(1)
}

const fetchTasks = async (targetPage = 1) => {
  if (loading.value && targetPage !== 1) return
  loading.value = true
  errorMsg.value = ''
  if (targetPage === 1 && tasks.value.length === 0) {
    skeletonLoading.value = true
  }

  try {
    const params: Record<string, any> = {
      page: targetPage,
      page_size: pageSize.value,
      status: 'PENDING',
    }
    if (keyword.value.trim()) {
      params.keyword = keyword.value.trim()
    }
    if (itemType.value && itemType.value !== '全部') {
      params.task_type = itemType.value
    }
    if (currentLocation.value) {
      params.lat = currentLocation.value.latitude
      params.lng = currentLocation.value.longitude
    }
    if (sortType.value) {
      params.sort_by = sortType.value
      params.sort_order = sortOrder.value
    }

    const result = await http.get<any>('/task/list', params)
    const data = (result as any)?.data ?? result
    const list = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : [])
    const totalNum = Number(data?.total ?? data?.count ?? list.length)

    tasks.value = list as TaskItem[]
    total.value = totalNum
    page.value = targetPage

    buildRemainingSecondsMap()
  } catch (err: any) {
    errorMsg.value = err?.message || '加载任务列表失败，请稍后重试'
  } finally {
    loading.value = false
    skeletonLoading.value = false
    refreshing.value = false
  }
}

const buildRemainingSecondsMap = () => {
  const map = new Map<string, number>()
  tasks.value.forEach((item) => {
    const createdAt = item.created_at ? new Date(item.created_at).getTime() : Date.now()
    const expireTime = createdAt + pendingAcceptMinutes.value * 60 * 1000
    const remaining = Math.max(0, Math.floor((expireTime - Date.now()) / 1000))
    map.set(item.id, remaining)
  })
  remainingSecondsMap.value = map
}

const startCountdownTimer = () => {
  if (countdownTimer.value) return
  countdownTimer.value = setInterval(() => {
    let hasExpired = false
    const newMap = new Map<string, number>()
    remainingSecondsMap.value.forEach((val, key) => {
      const next = Math.max(0, val - 1)
      if (next === 0 && val > 0) {
        hasExpired = true
      }
      newMap.set(key, next)
    })
    remainingSecondsMap.value = newMap

    if (hasExpired) {
      fetchTasks(page.value)
    }
  }, 1000)
}

const stopCountdownTimer = () => {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
}

const getRemainingSeconds = (task: TaskWithComputed) => {
  const cached = remainingSecondsMap.value.get(task.id)
  if (cached !== undefined) return cached
  return task._remainingSeconds ?? 0
}

const formatCountdown = (seconds: number) => {
  if (seconds <= 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const getCountdownBadgeClass = (task: TaskWithComputed) => {
  const remaining = getRemainingSeconds(task)
  if (remaining <= 60) return 'badge-danger'
  if (remaining <= 300) return 'badge-warning'
  return 'badge-default'
}

const estimateETA = (distanceMeters: unknown) => {
  const meters = Number(distanceMeters)
  if (!Number.isFinite(meters) || meters <= 0) return '未知'
  const speedMetersPerMin = 250
  const minutes = Math.max(1, Math.round(meters / speedMetersPerMin))
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

const canAcceptTask = (task: TaskWithComputed) => {
  if (!authStore.isLogin) return false
  if (authStore.role !== 'runner') return false
  if (authStore.runnerAuthStatus !== 'APPROVED') return false
  const status = String(task.status ?? '').toUpperCase()
  if (status !== 'PENDING' && status !== '') return false
  if (getRemainingSeconds(task) <= 0) return false
  return true
}

const grabTask = async (task: TaskWithComputed) => {
  if (!canAcceptTask(task)) return
  grabbingTaskId.value = task.id
  try {
    await http.post(`/order/accept/${encodeURIComponent(task.id)}`)
    uni.showToast({ title: '抢单成功！', icon: 'success' })
    setTimeout(() => {
      fetchTasks(page.value)
    }, 800)
  } catch (err: any) {
    uni.showToast({
      title: err?.message || '抢单失败，请稍后重试',
      icon: 'none',
      duration: 2500,
    })
  } finally {
    grabbingTaskId.value = null
  }
}

const selectType = (type: string) => {
  if (itemType.value === type) return
  itemType.value = type
  fetchTasks(1)
}

const selectSort = (sort: 'latest' | 'reward' | 'distance') => {
  if (sortType.value === sort) {
    if (sort !== 'latest') {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    }
  } else {
    sortType.value = sort
    sortOrder.value = sort === 'reward' ? 'desc' : 'asc'
  }
  fetchTasks(1)
}

const clearKeyword = () => {
  keyword.value = ''
  fetchTasks(1)
}

const handleScrollToLower = () => {
  if (page.value < totalPages.value && !loading.value) {
    fetchTasks(page.value + 1)
  }
}

const handlePullDownRefresh = async () => {
  refreshing.value = true
  await Promise.all([
    initLocation().catch(() => {}),
    fetchTasks(1),
  ])
  refreshing.value = false
}

onPullDownRefresh(() => {
  handlePullDownRefresh()
})

onLoad(() => {
  Promise.all([
    fetchPublicConfig(),
    initLocation(),
    authStore.isLogin ? authStore.fetchRunnerAuth().catch(() => {}) : Promise.resolve(),
  ]).finally(() => {
    fetchTasks(1)
    startCountdownTimer()
  })
})

onMounted(() => {
  startCountdownTimer()
})

onBeforeUnmount(() => {
  stopCountdownTimer()
})
</script>

<style lang="scss" scoped>
.search-card {
  margin-bottom: 24rpx;
  position: sticky;
  top: 0;
  z-index: 10;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.search-input {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 24rpx;

  .search-icon {
    font-size: 28rpx;
    flex-shrink: 0;
  }

  input {
    flex: 1;
    font-size: 28rpx;
  }

  .clear-btn {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    background: #e5e7eb;
    color: #6b7280;
    font-size: 28rpx;
    line-height: 40rpx;
    text-align: center;
    flex-shrink: 0;
  }
}

.locate-btn {
  width: 84rpx;
  height: 84rpx;
  border-radius: 18rpx;
  background: #eff6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;

  &:active {
    transform: scale(0.95);
    background: #dbeafe;
  }

  &.locate-loading {
    opacity: 0.5;
  }

  .locate-icon {
    font-size: 36rpx;
  }
}

.type-scroll {
  white-space: nowrap;
  margin-bottom: 20rpx;
}

.type-list {
  display: inline-flex;
  gap: 12rpx;
  padding: 4rpx 0;
}

.type-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 26rpx;
  transition: all 0.2s;
  flex-shrink: 0;

  &.active {
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    color: #ffffff;
    box-shadow: 0 4rpx 12rpx rgba(37, 99, 235, 0.25);
  }

  &:active {
    transform: scale(0.96);
  }
}

.sort-row {
  display: flex;
  gap: 32rpx;
  padding-top: 4rpx;
  border-top: 2rpx solid #f3f4f6;
  padding-top: 20rpx;
}

.sort-item {
  display: flex;
  align-items: center;
  gap: 4rpx;
  color: #6b7280;
  font-size: 26rpx;
  transition: color 0.2s;

  &.active {
    color: #2563eb;
    font-weight: 600;
  }

  .sort-arrow {
    font-size: 22rpx;
  }
}

.error-card {
  margin-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  background: #fef2f2;
  border: 2rpx solid #fecaca;

  .error-icon {
    font-size: 48rpx;
  }

  .error-content {
    text-align: center;

    .error-title {
      display: block;
      font-size: 28rpx;
      font-weight: 600;
      color: #991b1b;
      margin-bottom: 8rpx;
    }

    .error-msg {
      display: block;
      font-size: 24rpx;
      color: #7f1d1d;
    }
  }

  .error-retry {
    width: 240rpx;
    margin-top: 8rpx;
  }
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.skeleton-card {
  overflow: hidden;
}

.skeleton-row {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 12rpx;
  margin-bottom: 16rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton-title {
  height: 36rpx;
  width: 60%;
}

.skeleton-address {
  height: 28rpx;
  width: 85%;
}

.skeleton-meta {
  height: 28rpx;
  width: 70%;
}

.skeleton-btn {
  height: 64rpx;
  width: 180rpx;
  margin-left: auto;
  margin-top: 20rpx;
}

.task-list {
  height: calc(100vh - 420rpx);
}

.empty-card {
  margin-bottom: 24rpx;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #6b7280;
}

.task-card {
  margin-bottom: 24rpx;
}

.task-header {
  margin-bottom: 16rpx;
}

.task-price {
  font-size: 36rpx;
  font-weight: 700;
  color: #dc2626;
}

.tip-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
  padding: 12rpx 16rpx;
  background: #fffbeb;
  border-radius: 12rpx;

  .tip-badge {
    background: #f59e0b;
    color: #ffffff;
    font-size: 20rpx;
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
    font-weight: 600;
  }

  .tip-amount {
    color: #b45309;
    font-size: 26rpx;
    font-weight: 600;
  }
}

.route-section {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
  padding: 20rpx;
  background: #f9fafb;
  border-radius: 16rpx;
}

.route-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24rpx;
  flex-shrink: 0;
  padding-top: 6rpx;
  padding-bottom: 6rpx;
}

.route-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.pickup-dot {
  background: #22c55e;
}

.delivery-dot {
  background: #ef4444;
}

.route-line {
  flex: 1;
  width: 4rpx;
  background: repeating-linear-gradient(
    to bottom,
    #d1d5db 0,
    #d1d5db 6rpx,
    transparent 6rpx,
    transparent 12rpx
  );
  margin: 8rpx 0;
  min-height: 40rpx;
}

.route-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 20rpx;
}

.address-block {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.address-label {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #6b7280;
  padding: 4rpx 10rpx;
  background: #e5e7eb;
  border-radius: 6rpx;
  margin-top: 2rpx;
}

.address-text {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.5;
  word-break: break-all;
}

.task-meta {
  margin-bottom: 16rpx;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6rpx;

  .meta-icon {
    font-size: 24rpx;
  }

  .meta-text {
    font-size: 24rpx;
    color: #6b7280;
  }
}

.remark-section {
  margin-bottom: 16rpx;
  padding: 16rpx 20rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  border-left: 6rpx solid #3b82f6;
}

.remark-text {
  font-size: 24rpx;
  color: #475569;
  line-height: 1.6;
}

.thumb-list {
  margin-bottom: 20rpx;
}

.action-row {
  padding-top: 20rpx;
  border-top: 2rpx solid #f3f4f6;
}

.publisher-info {
  .publisher-name {
    font-size: 24rpx;
    color: #6b7280;
  }
}

.accept-btn {
  width: 200rpx;
  height: 72rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
}

.pagination-section {
  padding: 24rpx 0;
}

.pagination-row {
  gap: 16rpx;
}

.page-btn {
  flex: 1;
  max-width: 200rpx;
  height: 72rpx;
  border-radius: 16rpx;
  font-size: 26rpx;
}

.page-info {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #6b7280;
}

.list-bottom-space {
  height: 40rpx;
}

.page-shell {
  padding-bottom: 140rpx;
}

.fab-wrapper {
  position: fixed;
  right: 32rpx;
  bottom: calc(150rpx + constant(safe-area-inset-bottom));
  bottom: calc(150rpx + env(safe-area-inset-bottom));
  z-index: 998;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.fab-button {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #165dff 0%, #4080ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(22, 93, 255, 0.4), 0 4rpx 12rpx rgba(22, 93, 255, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:active {
    transform: scale(0.92);
    box-shadow: 0 4rpx 16rpx rgba(22, 93, 255, 0.3);
  }
}

.fab-icon {
  color: #ffffff;
  font-size: 64rpx;
  font-weight: 300;
  line-height: 1;
  margin-top: -4rpx;
}

.fab-label {
  color: #165dff;
  font-size: 22rpx;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.95);
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}
</style>
