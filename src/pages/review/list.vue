<template>
  <view class="review-list-page">
    <view class="tab-header">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ active: activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <view class="tab-underline"></view>
      </view>
    </view>

    <view class="filter-bar">
      <view class="filter-label">评分筛选：</view>
      <view class="filter-buttons">
        <view
          v-for="opt in ratingOptions"
          :key="opt.value"
          class="filter-btn"
          :class="{ active: selectedRating === opt.value }"
          @tap="selectRating(opt.value)"
        >
          {{ opt.label }}
        </view>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="review-scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      lower-threshold="120"
      @scrolltolower="loadMore"
    >
      <view v-if="error" class="error-wrap card">
        <text class="error-icon">!</text>
        <text class="error-text">{{ error }}</text>
        <button class="btn-primary retry-btn" @tap="fetchList">重新加载</button>
      </view>

      <view v-else-if="loading && list.length === 0" class="loading-wrap">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="list.length === 0" class="empty-box">
        <text class="empty-icon">○</text>
        <text class="empty-text">
          {{ activeTab === 'received' ? '暂未收到评价' : '暂未发出评价' }}
        </text>
      </view>

      <view v-else class="review-list">
        <view
          v-for="item in list"
          :key="item.id"
          class="review-card card"
        >
          <view class="card-top row-between">
            <view class="star-row">
              <text
                v-for="i in 5"
                :key="i"
                class="star"
                :class="{ filled: i <= item.rating }"
              >★</text>
            </view>
            <text class="review-time muted">{{ formatDateTime(item.createdAt) }}</text>
          </view>

          <view class="reviewer-row">
            <text class="reviewer-label muted">
              {{ activeTab === 'received' ? '评价人' : '被评价人' }}
            </text>
            <text class="reviewer-name">
              {{ activeTab === 'received' ? item.reviewerNickname : item.revieweeNickname }}
            </text>
          </view>

          <view class="content-row">
            <text v-if="item.content" class="content-text">{{ item.content }}</text>
            <text v-else class="content-text empty-content muted">用户未填写文字评价</text>
          </view>

          <view v-if="item.tags && item.tags.length > 0" class="tags-row">
            <view
              v-for="(tag, idx) in displayTags(item.tags)"
              :key="idx"
              class="tag-chip"
            >
              {{ tag }}
            </view>
            <view v-if="item.tags.length > 6" class="tag-chip tag-more">
              +{{ item.tags.length - 6 }}
            </view>
          </view>

          <view v-if="item.images && item.images.length > 0" class="images-row">
            <image
              v-for="(img, idx) in item.images"
              :key="idx"
              class="review-image"
              :src="toAbsoluteFileUrl(img)"
              mode="aspectFill"
              @tap="previewImages(item.images, idx)"
            />
          </view>

          <view v-if="item.orderId" class="order-row" @tap="goToOrder(item.orderId)">
            <text class="order-label muted">关联订单：</text>
            <text class="order-id primary">{{ item.orderId }}</text>
            <text class="arrow">›</text>
          </view>
        </view>

        <view v-if="list.length > 0" class="list-footer">{{ loading ? '加载中…' : page < totalPages ? '上拉加载更多' : '已加载全部评价' }}</view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { formatDateTime, toAbsoluteFileUrl } from '@/utils/format'
import { http } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'

interface ReviewItem {
  id: string | number
  rating: number
  tags: string[]
  content: string
  images: string[]
  orderId: string | number
  reviewerNickname: string
  revieweeNickname: string
  createdAt: string
  [key: string]: any
}

const authStore = useAuthStore()

const tabs = [
  { label: '收到的评价', value: 'received' },
  { label: '发出的评价', value: 'given' },
] as const

type TabValue = typeof tabs[number]['value']

const ratingOptions = [
  { label: '全部', value: null as number | null },
  { label: '5 星', value: 5 },
  { label: '4 星', value: 4 },
  { label: '3 星', value: 3 },
  { label: '2 星', value: 2 },
  { label: '1 星', value: 1 },
]

const activeTab = ref<TabValue>('received')
const selectedRating = ref<number | null>(null)
const list = ref<ReviewItem[]>([])
const page = ref(1)
const pageSize = 10
const total = ref(0)
const loading = ref(false)
const refreshing = ref(false)
const error = ref<string | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const displayTags = (tags: string[]) => tags.slice(0, 6)

const switchTab = (tab: TabValue) => {
  if (activeTab.value === tab) return
  activeTab.value = tab
  page.value = 1
  error.value = null
  fetchList()
}

const selectRating = (rating: number | null) => {
  if (selectedRating.value === rating) return
  selectedRating.value = rating
  page.value = 1
  error.value = null
  fetchList()
}

const fetchList = async (append = false) => {
  loading.value = true
  error.value = null
  try {
    const url = activeTab.value === 'received' ? '/reviews/received' : '/reviews/given'
    const params: Record<string, any> = {
      page: page.value,
      pageSize,
    }
    if (selectedRating.value !== null) {
      params.rating = selectedRating.value
    }
    const res: any = await http.get(url, params)
    const data = res?.data ?? res
    const items = data?.items ?? data?.list ?? []
    const nextItems = Array.isArray(items) ? items : []
    list.value = append ? [...list.value, ...nextItems.filter((next: ReviewItem) => !list.value.some((item) => item.id === next.id))] : nextItems
    total.value = Number(data?.total ?? list.value.length) || 0
  } catch (e: any) {
    error.value = e?.message || '加载失败，请重试'
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const onRefresh = () => {
  refreshing.value = true
  page.value = 1
  error.value = null
  fetchList()
}

const loadMore = () => {
  if (loading.value || page.value >= totalPages.value) return
  page.value++
  fetchList(true)
}

const previewImages = (images: string[], current: number) => {
  const urls = images.map((img) => toAbsoluteFileUrl(img))
  uni.previewImage({
    urls,
    current: urls[current] || urls[0],
  })
}

const goToOrder = (orderId: string | number) => {
  uni.navigateTo({
    url: `/pages/order/detail?orderId=${orderId}`,
  })
}

onMounted(() => {
  if (!authStore.isLogin) {
    authStore.bootstrap()
  }
  fetchList()
})
</script>

<style lang="scss" scoped>
.review-list-page {
  min-height: 100vh;
  background: #f6f7fb;
}

.tab-header {
  display: flex;
  background: #fff;
  padding: 0 12rpx;
  border-bottom: 1rpx solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28rpx 0 20rpx;
  position: relative;

  .tab-text {
    font-size: 30rpx;
    color: #6b7280;
    transition: all 0.2s ease;
  }

  .tab-underline {
    width: 0;
    height: 6rpx;
    border-radius: 3rpx;
    background: #2563eb;
    margin-top: 12rpx;
    transition: width 0.2s ease;
  }

  &.active {
    .tab-text {
      color: #111827;
      font-weight: 700;
    }

    .tab-underline {
      width: 64rpx;
    }
  }
}

.filter-bar {
  background: #fff;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.filter-label {
  font-size: 26rpx;
  color: #374151;
  flex-shrink: 0;
}

.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  flex: 1;
}

.filter-btn {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  font-size: 24rpx;
  color: #4b5563;
  transition: all 0.2s ease;

  &.active {
    background: #dbeafe;
    color: #2563eb;
    font-weight: 600;
  }
}

.review-scroll {
  height: calc(100vh - 200rpx);
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;

  .loading-text {
    font-size: 28rpx;
    color: #9ca3af;
  }
}

.empty-box {
  padding: 120rpx 24rpx;
  text-align: center;
  color: #6b7280;

  .empty-icon {
    font-size: 120rpx;
    display: block;
    margin-bottom: 24rpx;
  }

  .empty-text {
    font-size: 28rpx;
    color: #9ca3af;
  }
}

.error-wrap {
  margin: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 24rpx;

  .error-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
  }

  .error-text {
    font-size: 28rpx;
    color: #ef4444;
    margin-bottom: 32rpx;
    text-align: center;
  }

  .retry-btn {
    width: 240rpx;
  }
}

.review-list {
  padding: 24rpx;
}

.review-card {
  margin-bottom: 24rpx;
  border: 1rpx solid #e5e7eb;
}

.card-top {
  margin-bottom: 20rpx;
}

.star-row {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.star {
  font-size: 32rpx;
  color: #d1d5db;

  &.filled {
    color: #f59e0b;
  }
}

.review-time {
  font-size: 24rpx;
  flex-shrink: 0;
}

.reviewer-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.reviewer-label {
  font-size: 26rpx;
}

.reviewer-name {
  font-size: 28rpx;
  color: #111827;
  font-weight: 600;
}

.content-row {
  margin-bottom: 16rpx;
}

.content-text {
  font-size: 28rpx;
  color: #111827;
  line-height: 1.6;

  &.empty-content {
    font-style: italic;
  }
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.tag-chip {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: #dbeafe;
  color: #2563eb;
  font-size: 22rpx;
  font-weight: 500;

  &.tag-more {
    background: #f3f4f6;
    color: #6b7280;
  }
}

.images-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.review-image {
  width: 100%;
  height: 200rpx;
  border-radius: 16rpx;
  background: #f3f4f6;
}

.order-row {
  display: flex;
  align-items: center;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
  gap: 8rpx;
}

.order-label {
  font-size: 26rpx;
  flex-shrink: 0;
}

.order-id {
  font-size: 26rpx;
  flex: 1;
  font-weight: 500;
}

.arrow {
  font-size: 36rpx;
  color: #9ca3af;
  line-height: 1;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.page-btn {
  width: 160rpx;
  height: 64rpx;
  font-size: 26rpx;

  &[disabled] {
    opacity: 0.5;
  }
}

.page-info {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: #6b7280;
}
</style>
