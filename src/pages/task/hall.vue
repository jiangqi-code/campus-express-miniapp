<template>
  <view class="page-shell">
    <view class="card search-card">
      <view class="search-row">
        <view class="input search-input">
          <image class="ui-icon search-icon" :src="taskHallIcons.search" mode="aspectFit" />
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索地址、备注..."
            confirm-type="search"
            @confirm="applyKeywordNow"
          />
          <text v-if="keyword" class="clear-btn" @tap="clearKeyword">×</text>
        </view>
        <view class="locate-btn" @tap="refreshLocation" :class="{ 'locate-loading': locating }">
          <image class="ui-icon locate-icon" :src="taskHallIcons.location" mode="aspectFit" />
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

      <view class="filter-groups">
        <view class="filter-group">
          <text class="filter-title">时效</text>
          <view class="filter-options">
            <view v-for="option in urgencyOptions" :key="option.value" class="filter-chip" :class="{ active: urgencyFilter === option.value }" @tap="selectFilter('urgency', option.value)">{{ option.label }}</view>
          </view>
        </view>
        <view class="filter-group">
          <text class="filter-title">价格</text>
          <view class="filter-options">
            <view v-for="option in priceOptions" :key="option.value" class="filter-chip" :class="{ active: priceFilter === option.value }" @tap="selectFilter('price', option.value)">{{ option.label }}</view>
          </view>
        </view>
        <view class="filter-group">
          <text class="filter-title">距离</text>
          <view class="filter-options">
            <view v-for="option in distanceOptions" :key="option.value" class="filter-chip" :class="{ active: distanceFilter === option.value }" @tap="selectFilter('distance', option.value)">{{ option.label }}</view>
          </view>
        </view>
      </view>

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
      <image class="error-icon" :src="taskHallIcons.warning" mode="aspectFit" />
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

    <view v-else-if="!errorMsg" class="task-list">
      <view v-if="processedTasks.length === 0" class="card empty-card">
        <view class="empty-box">
          <image class="empty-illustration" :src="taskHallIcons.empty" mode="aspectFit" />
          <text class="empty-title">{{ loading ? '正在寻找任务' : '暂时没有匹配的任务' }}</text>
          <text class="empty-text">调整筛选条件，或发布一个新的跑腿需求</text>
          <view class="empty-actions">
            <button class="btn-secondary empty-action" @tap="resetHallFilters">重置筛选</button>
            <button class="btn-primary empty-action" @tap="goPublish">发布任务</button>
          </view>
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
              <image class="badge-icon" :src="taskHallIcons.clock" mode="aspectFit" />
              {{ formatCountdown(getRemainingSeconds(task)) }}
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
              <image class="meta-icon" :src="taskHallIcons.distance" mode="aspectFit" />
              <text class="meta-text">{{ formatDistance(task.distance) }}</text>
            </view>
            <view class="meta-item">
              <image class="meta-icon" :src="taskHallIcons.bicycle" mode="aspectFit" />
              <text class="meta-text">约{{ estimateETA(task.distance) }}</text>
            </view>
            <view class="meta-item">
              <image class="meta-icon" :src="taskHallIcons.clock" mode="aspectFit" />
              <text class="meta-text">{{ formatRelativeTime(task.created_at) }}</text>
            </view>
          </view>
        </view>

        <view v-if="task.remark" class="remark-section">
          <image class="remark-icon" :src="taskHallIcons.note" mode="aspectFit" />
          <text class="remark-text">{{ task.remark }}</text>
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

      <view v-if="processedTasks.length > 0" class="load-more-state">
        <text v-if="loading">正在加载更多…</text>
        <text v-else-if="hasMore">上拉加载更多</text>
        <text v-else>已加载全部 {{ processedTasks.length }} 条任务</text>
      </view>

      <view class="list-bottom-space"></view>
    </view>

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
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
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
const taskHallIcons = {
  search: '/task-hall-icons/search.svg',
  location: '/task-hall-icons/location.svg',
  warning: '/task-hall-icons/warning.svg',
  empty: '/task-hall-icons/empty.svg',
  clock: '/task-hall-icons/clock.svg',
  distance: '/task-hall-icons/distance.svg',
  bicycle: '/task-hall-icons/bicycle.svg',
  note: '/task-hall-icons/note.svg',
} as const

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
const urgencyFilter = ref<'all' | 'urgent' | 'normal'>('all')
const priceFilter = ref<'all' | 'under10' | '10to20' | 'over20'>('all')
const distanceFilter = ref<'all' | 'under1' | '1to3' | 'over3'>('all')
let searchTimer: ReturnType<typeof setTimeout> | undefined

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

const urgencyOptions = [
  { label: '全部', value: 'all' as const },
  { label: '10分钟内', value: 'urgent' as const },
  { label: '较宽松', value: 'normal' as const },
]
const priceOptions = [
  { label: '全部', value: 'all' as const },
  { label: '¥10内', value: 'under10' as const },
  { label: '¥10-20', value: '10to20' as const },
  { label: '¥20+', value: 'over20' as const },
]
const distanceOptions = [
  { label: '全部', value: 'all' as const },
  { label: '1km内', value: 'under1' as const },
  { label: '1-3km', value: '1to3' as const },
  { label: '3km+', value: 'over3' as const },
]

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasMore = computed(() => page.value < totalPages.value)

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

  list = list.filter((item) => {
    const remaining = Number(item._remainingSeconds ?? 0)
    const price = Number(item.fee_total ?? 0) + Number(item.tip ?? 0)
    const distanceKm = Number(item.distance ?? 0) / 1000
    if (urgencyFilter.value === 'urgent' && remaining > 600) return false
    if (urgencyFilter.value === 'normal' && remaining <= 600) return false
    if (priceFilter.value === 'under10' && price >= 10) return false
    if (priceFilter.value === '10to20' && (price < 10 || price > 20)) return false
    if (priceFilter.value === 'over20' && price < 20) return false
    if (distanceFilter.value === 'under1' && distanceKm >= 1) return false
    if (distanceFilter.value === '1to3' && (distanceKm < 1 || distanceKm > 3)) return false
    if (distanceFilter.value === 'over3' && distanceKm < 3) return false
    return true
  })

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

    if (targetPage === 1) {
      tasks.value = list as TaskItem[]
    } else {
      const merged = [...tasks.value, ...(list as TaskItem[])]
      tasks.value = Array.from(new Map(merged.map((item) => [String(item.id), item])).values())
    }
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
      fetchTasks(1)
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
      fetchTasks(1)
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

const applyKeywordNow = () => {
  if (searchTimer) clearTimeout(searchTimer)
  fetchTasks(1)
}

watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchTasks(1), 500)
})

const selectFilter = (type: 'urgency' | 'price' | 'distance', value: string) => {
  if (type === 'urgency') urgencyFilter.value = value as typeof urgencyFilter.value
  if (type === 'price') priceFilter.value = value as typeof priceFilter.value
  if (type === 'distance') distanceFilter.value = value as typeof distanceFilter.value
}

const resetHallFilters = () => {
  keyword.value = ''
  itemType.value = '全部'
  urgencyFilter.value = 'all'
  priceFilter.value = 'all'
  distanceFilter.value = 'all'
  sortType.value = 'distance'
  sortOrder.value = 'asc'
  fetchTasks(1)
}

const handlePullDownRefresh = async () => {
  refreshing.value = true
  await Promise.all([
    initLocation().catch(() => {}),
    fetchTasks(1),
  ])
  refreshing.value = false
  uni.stopPullDownRefresh()
}

onPullDownRefresh(() => {
  handlePullDownRefresh()
})

onReachBottom(() => {
  if (hasMore.value && !loading.value) fetchTasks(page.value + 1)
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
  if (searchTimer) clearTimeout(searchTimer)
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
    width: 30rpx;
    height: 30rpx;
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
    width: 38rpx;
    height: 38rpx;
  }
}

.filter-groups {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-bottom: 20rpx;
}

.filter-group { display: flex; align-items: center; gap: 16rpx; }
.filter-title { width: 64rpx; flex-shrink: 0; color: #86909c; font-size: 22rpx; }
.filter-options { display: flex; min-width: 0; flex: 1; gap: 8rpx; overflow-x: auto; }
.filter-chip {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border: 2rpx solid transparent;
  border-radius: 999rpx;
  background: #f5f6f7;
  color: #4e5969;
  font-size: 22rpx;
}
.filter-chip.active { border-color: #bed3ff; background: #eef3ff; color: #3b82f6; font-weight: 600; }

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
    width: 52rpx;
    height: 52rpx;
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
  min-height: 40vh;
}

.empty-card {
  margin-bottom: 24rpx;
}

.empty-illustration { width: 320rpx; height: 240rpx; }
.empty-title { color: #1d2129; font-size: 30rpx; font-weight: 700; }

.empty-text {
  font-size: 24rpx;
  color: #86909c;
}
.empty-actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
.empty-action { width: 200rpx; height: 72rpx; font-size: 24rpx; }

.task-card {
  margin-bottom: 24rpx;
  border-color: #eef0f3;
}

.task-header {
  margin-bottom: 16rpx;
}

.task-price {
  font-size: 40rpx;
  font-weight: 700;
  color: #dc2626;
}

.badge-icon { width: 22rpx; height: 22rpx; margin-right: 4rpx; }

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
    width: 24rpx;
    height: 24rpx;
  }

  .meta-text {
    font-size: 24rpx;
    color: #6b7280;
  }
}

.remark-section {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-bottom: 16rpx;
  padding: 16rpx 20rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  border-left: 6rpx solid #3b82f6;
}

.remark-icon { width: 26rpx; height: 26rpx; margin-top: 5rpx; flex-shrink: 0; }

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

.load-more-state { padding: 28rpx 0; color: #86909c; font-size: 24rpx; text-align: center; }

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
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
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
  color: #3b82f6;
  font-size: 22rpx;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.95);
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

/* Commercial task hall hierarchy */
.search-card{border-radius:40rpx;background:linear-gradient(145deg,#fff,#f9fbff);box-shadow:0 6rpx 28rpx rgba(59,130,246,.08)}.type-tag.active,.filter-chip.active{color:#fff;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-color:transparent;box-shadow:0 6rpx 16rpx rgba(99,102,241,.2)}.task-card{border:0;border-radius:32rpx;box-shadow:0 4rpx 24rpx rgba(0,0,0,.06)}.task-card:active{transform:scale(.992)}.task-price,.price{color:#f59e0b!important;font-size:48rpx!important;font-weight:700}.accept-btn,.grab-btn{background:linear-gradient(135deg,#f59e0b,#f97316)!important;box-shadow:0 10rpx 22rpx rgba(245,158,11,.25)!important}.remark-box{background:#f8fafc;border-left:6rpx solid #8b5cf6}.list-footer{color:#6b7280}
</style>
