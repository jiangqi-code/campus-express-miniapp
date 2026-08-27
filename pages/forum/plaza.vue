<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/AppTabBar.vue'
import { useAuthStore } from '@/stores/auth'
import type { ForumCategory, ForumPost } from '@/types/models'
import { toAbsoluteFileUrl } from '@/utils/format'
import { http } from '@/utils/request'

type PlazaMode = 'all' | 'mine' | 'favorites'

const authStore = useAuthStore()
const categories = ref<ForumCategory[]>([])
const posts = ref<ForumPost[]>([])
const activeCategoryId = ref<number | null>(null)
const mode = ref<PlazaMode>('all')
const sort = ref<'latest' | 'hot'>('latest')
const loading = ref(false)
const loadingMore = ref(false)
const errorMessage = ref('')
const page = ref(1)
const pageSize = 10
const total = ref(0)

const title = computed(() => {
  if (mode.value === 'mine') return '我的发布'
  if (mode.value === 'favorites') return '我的收藏'
  return '校园信息广场'
})

const subtitle = computed(() => {
  if (mode.value === 'mine') return '审核状态和处理结果会显示在这里'
  if (mode.value === 'favorites') return '把有用的信息先收进这里'
  return '失物招领、二手交易、拼车和校园通知都在这里'
})

const hasMore = computed(() => posts.value.length < total.value)

function unwrap(result: any) {
  return result?.data ?? result ?? {}
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days} 天前` : new Date(value).toLocaleDateString('zh-CN')
}

function displayName(post: ForumPost) {
  return post.author?.nickname || '校园同学'
}

function statusLabel(status: ForumPost['status']) {
  const map: Record<ForumPost['status'], string> = {
    PENDING: '审核中',
    APPROVED: '已通过',
    REJECTED: '未通过',
    HIDDEN: '已隐藏',
  }
  return map[status] || status
}

async function fetchCategories() {
  const data = unwrap(await http.get<any>('/forum/categories'))
  categories.value = Array.isArray(data.list) ? data.list : []
}

async function fetchPosts(reset = true) {
  if (loading.value || loadingMore.value) return
  if (reset) loading.value = true
  else loadingMore.value = true
  errorMessage.value = ''
  const targetPage = reset ? 1 : page.value + 1

  try {
    let data: any
    if (mode.value === 'favorites') {
      data = unwrap(await http.get('/forum/favorites', { page: targetPage, page_size: pageSize }))
    } else {
      data = unwrap(await http.get('/forum/posts', {
        page: targetPage,
        page_size: pageSize,
        category_id: activeCategoryId.value || undefined,
        sort: sort.value,
        mine: mode.value === 'mine' ? 1 : undefined,
      }))
    }
    const list = Array.isArray(data.list) ? data.list : []
    posts.value = reset ? list : [...posts.value, ...list]
    page.value = Number(data.page || targetPage)
    total.value = Number(data.total || posts.value.length)
  } catch (error: any) {
    errorMessage.value = error?.message || '信息加载失败，请稍后重试'
  } finally {
    loading.value = false
    loadingMore.value = false
    uni.stopPullDownRefresh()
  }
}

async function loadPage() {
  await authStore.bootstrap()
  await Promise.all([fetchCategories(), fetchPosts(true)])
}

function selectCategory(categoryId: number | null) {
  if (mode.value === 'favorites' || activeCategoryId.value === categoryId) return
  activeCategoryId.value = categoryId
  void fetchPosts(true)
}

function selectMode(next: PlazaMode) {
  if (mode.value === next) return
  mode.value = next
  activeCategoryId.value = null
  void fetchPosts(true)
}

function openPost(post: ForumPost) {
  uni.navigateTo({ url: `/pages/forum/detail?id=${post.id}` })
}

function goPublish() {
  uni.navigateTo({ url: '/pages/forum/publish' })
}

onLoad(async (options) => {
  const initialMode = String(options?.mode || '')
  if (initialMode === 'mine' || initialMode === 'favorites') mode.value = initialMode
  await loadPage()
})

onShow(() => {
  if (posts.value.length) void fetchPosts(true)
})

onPullDownRefresh(() => {
  void loadPage()
})

onReachBottom(() => {
  if (hasMore.value && !loading.value) void fetchPosts(false)
})
</script>

<template>
  <view class="page-shell forum-plaza">
    <view class="plaza-hero">
      <view class="hero-copy">
        <text class="eyebrow">CAMPUS SQUARE</text>
        <view class="hero-title">{{ title }}</view>
        <view class="hero-subtitle">{{ subtitle }}</view>
      </view>
      <view class="publish-trigger" @tap="goPublish">
        <text class="publish-plus">＋</text>
        <text>发布</text>
      </view>
    </view>

    <view class="mode-switch" role="tablist">
      <view class="mode-item" :class="{ active: mode === 'all' }" @tap="selectMode('all')">全部信息</view>
      <view class="mode-item" :class="{ active: mode === 'mine' }" @tap="selectMode('mine')">我的发布</view>
      <view class="mode-item" :class="{ active: mode === 'favorites' }" @tap="selectMode('favorites')">我的收藏</view>
    </view>

    <view v-if="mode !== 'favorites'" class="filter-panel">
      <scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
        <view class="category-row">
          <view class="category-chip" :class="{ active: activeCategoryId === null }" @tap="selectCategory(null)">全部</view>
          <view
            v-for="category in categories"
            :key="category.id"
            class="category-chip"
            :class="{ active: activeCategoryId === category.id }"
            @tap="selectCategory(category.id)"
          >
            <text v-if="category.icon" class="category-icon">{{ category.icon }}</text>{{ category.name }}
          </view>
        </view>
      </scroll-view>
      <view class="sort-row">
        <text class="sort-label">排序</text>
        <view class="sort-option" :class="{ active: sort === 'latest' }" @tap="sort = 'latest'; fetchPosts(true)">最新</view>
        <view class="sort-option" :class="{ active: sort === 'hot' }" @tap="sort = 'hot'; fetchPosts(true)">热度</view>
      </view>
    </view>

    <view v-if="errorMessage" class="state-card error-state">
      <view class="state-title">加载失败</view>
      <view class="state-text">{{ errorMessage }}</view>
      <view class="retry-button" @tap="fetchPosts(true)">重新加载</view>
    </view>

    <view v-else-if="loading && posts.length === 0" class="skeleton-list">
      <view v-for="item in 3" :key="item" class="skeleton-card">
        <view class="skeleton-line skeleton-short" />
        <view class="skeleton-line" />
        <view class="skeleton-line skeleton-medium" />
      </view>
    </view>

    <view v-else-if="posts.length === 0" class="state-card empty-state">
      <view class="empty-symbol">◎</view>
      <view class="state-title">这里还没有信息</view>
      <view class="state-text">发布第一条校园信息，让更多同学看到。</view>
      <view v-if="mode === 'all'" class="primary-action" @tap="goPublish">去发布</view>
    </view>

    <view v-else class="post-list">
      <view v-for="post in posts" :key="post.id" class="post-card" @tap="openPost(post)">
        <view class="post-topline">
          <view class="category-badge">
            <text v-if="post.category?.icon">{{ post.category.icon }}</text>
            {{ post.category?.name || '校园信息' }}
          </view>
          <view v-if="mode === 'mine'" class="status-badge" :class="`status-${post.status.toLowerCase()}`">{{ statusLabel(post.status) }}</view>
          <text v-else-if="post.is_pinned" class="pin-label">置顶</text>
        </view>
        <view class="post-title">{{ post.title }}</view>
        <view class="post-content">{{ post.content }}</view>
        <view v-if="post.images?.length" class="image-strip">
          <image v-for="image in post.images.slice(0, 3)" :key="image" class="post-image" :src="toAbsoluteFileUrl(image)" mode="aspectFill" />
          <view v-if="post.images.length > 3" class="image-more">+{{ post.images.length - 3 }}</view>
        </view>
        <view v-if="post.location_name" class="location-line">⌖ {{ post.location_name }}</view>
        <view v-if="mode === 'mine' && post.status === 'REJECTED' && post.audit_note" class="audit-note">审核说明：{{ post.audit_note }}</view>
        <view class="post-footer">
          <view class="author-line">
            <image v-if="post.author?.avatar" class="avatar" :src="toAbsoluteFileUrl(post.author.avatar)" mode="aspectFill" />
            <view v-else class="avatar avatar-placeholder">{{ displayName(post).slice(0, 1) }}</view>
            <text>{{ displayName(post) }}</text>
            <text class="time-text">{{ formatRelativeTime(post.created_at) }}</text>
          </view>
          <view class="engagement-line">
            <text>♡ {{ post.like_count || 0 }}</text>
            <text>◌ {{ post.comment_count || 0 }}</text>
          </view>
        </view>
      </view>
      <view class="load-more">{{ loadingMore ? '正在加载…' : hasMore ? '上拉加载更多' : '已经到底了' }}</view>
    </view>

    <AppTabBar current="plaza" />
  </view>
</template>

<style lang="scss" scoped>
.forum-plaza { padding-top: 20rpx; }
.plaza-hero { display: flex; align-items: flex-start; justify-content: space-between; margin: 0 4rpx 22rpx; padding: 28rpx; border-radius: 28rpx; background: #11345a; color: #fff; box-shadow: 0 18rpx 42rpx rgba(17, 52, 90, .18); }
.hero-copy { min-width: 0; }.eyebrow { display: block; color: #93c5fd; font-size: 20rpx; font-weight: 800; letter-spacing: .12em; }.hero-title { margin-top: 12rpx; font-size: 42rpx; font-weight: 800; letter-spacing: -.04em; }.hero-subtitle { margin-top: 10rpx; color: #c7dcf3; font-size: 24rpx; line-height: 1.5; }
.publish-trigger { display: flex; width: 112rpx; height: 112rpx; flex: 0 0 112rpx; flex-direction: column; align-items: center; justify-content: center; gap: 2rpx; border: 2rpx solid rgba(255,255,255,.28); border-radius: 22rpx; background: #1d65b1; color: #fff; font-size: 22rpx; font-weight: 700; }.publish-trigger:active { transform: scale(.96); }.publish-plus { font-size: 40rpx; line-height: 1; }
.mode-switch { display: flex; gap: 6rpx; margin-bottom: 20rpx; border-bottom: 2rpx solid #e6edf6; }.mode-item { position: relative; padding: 17rpx 18rpx; color: #62748a; font-size: 25rpx; font-weight: 650; }.mode-item.active { color: #165dff; }.mode-item.active::after { position: absolute; right: 18rpx; bottom: -2rpx; left: 18rpx; height: 5rpx; border-radius: 999rpx; background: #165dff; content: ''; }
.filter-panel { margin-bottom: 22rpx; padding: 20rpx 0 0; border-top: 2rpx solid #edf1f6; }.category-scroll { width: 100%; white-space: nowrap; }.category-row { display: inline-flex; gap: 12rpx; padding: 0 0 4rpx; }.category-chip { display: inline-flex; align-items: center; gap: 6rpx; min-height: 56rpx; border: 2rpx solid #dfe7f1; border-radius: 999rpx; padding: 0 20rpx; background: #fff; color: #50647b; font-size: 23rpx; font-weight: 600; }.category-chip.active { border-color: #165dff; background: #edf4ff; color: #165dff; }.category-icon { font-size: 24rpx; }.sort-row { display: flex; align-items: center; gap: 20rpx; margin-top: 18rpx; }.sort-label { color: #8b9bb0; font-size: 23rpx; }.sort-option { color: #687b91; font-size: 24rpx; }.sort-option.active { color: #165dff; font-weight: 750; }
.post-list { display: flex; flex-direction: column; gap: 18rpx; }.post-card { overflow: hidden; border: 2rpx solid #e4ebf3; border-radius: 24rpx; padding: 24rpx; background: #fff; box-shadow: 0 8rpx 22rpx rgba(15, 40, 70, .045); }.post-card:active { border-color: #9cc1ff; background: #fbfdff; }.post-topline, .post-footer, .author-line, .engagement-line { display: flex; align-items: center; }.post-topline { justify-content: space-between; gap: 12rpx; }.category-badge { display: inline-flex; align-items: center; gap: 5rpx; border-radius: 9rpx; padding: 7rpx 12rpx; background: #eff5fc; color: #2f608f; font-size: 21rpx; font-weight: 700; }.pin-label { color: #a5671b; font-size: 22rpx; font-weight: 700; }.status-badge { border-radius: 999rpx; padding: 6rpx 12rpx; font-size: 21rpx; font-weight: 700; }.status-pending { background: #fff4d9; color: #a56500; }.status-approved { background: #e6f6ec; color: #187443; }.status-rejected, .status-hidden { background: #fce8e8; color: #b83c3c; }
.post-title { margin-top: 16rpx; color: #17283c; font-size: 32rpx; font-weight: 750; line-height: 1.35; }.post-content { display: -webkit-box; margin-top: 10rpx; overflow: hidden; color: #596b80; font-size: 26rpx; line-height: 1.6; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.image-strip { display: flex; gap: 10rpx; margin-top: 18rpx; }.post-image, .image-more { width: 156rpx; height: 156rpx; border-radius: 14rpx; }.post-image { background: #edf1f5; }.image-more { display: flex; align-items: center; justify-content: center; background: #253d58; color: #fff; font-size: 26rpx; font-weight: 700; }.location-line { margin-top: 16rpx; color: #64809e; font-size: 23rpx; }.audit-note { margin-top: 16rpx; border-left: 5rpx solid #e39b34; padding: 8rpx 12rpx; background: #fffbf2; color: #8d631d; font-size: 23rpx; line-height: 1.45; }.post-footer { justify-content: space-between; gap: 10rpx; margin-top: 22rpx; padding-top: 18rpx; border-top: 2rpx solid #edf1f5; }.author-line { min-width: 0; gap: 9rpx; color: #51667b; font-size: 22rpx; }.avatar { width: 34rpx; height: 34rpx; flex: 0 0 34rpx; border-radius: 50%; background: #e4ebf2; }.avatar-placeholder { display: flex; align-items: center; justify-content: center; background: #dbeafe; color: #215ba8; font-size: 19rpx; font-weight: 750; }.time-text { overflow: hidden; color: #9aa8b8; text-overflow: ellipsis; white-space: nowrap; }.engagement-line { flex: 0 0 auto; gap: 16rpx; color: #708297; font-size: 22rpx; }.load-more { padding: 20rpx 0 6rpx; color: #93a1b0; font-size: 23rpx; text-align: center; }
.state-card { padding: 74rpx 32rpx; border: 2rpx dashed #dbe4ef; border-radius: 24rpx; background: #fff; text-align: center; }.error-state { border-style: solid; border-color: #f4c7c7; background: #fff8f8; }.empty-symbol { margin-bottom: 18rpx; color: #84a7d0; font-size: 76rpx; }.state-title { color: #23364d; font-size: 30rpx; font-weight: 750; }.state-text { margin-top: 10rpx; color: #7a8c9e; font-size: 24rpx; line-height: 1.55; }.primary-action, .retry-button { display: inline-flex; align-items: center; justify-content: center; min-height: 66rpx; margin-top: 26rpx; border-radius: 15rpx; padding: 0 32rpx; background: #165dff; color: #fff; font-size: 25rpx; font-weight: 700; }.retry-button { background: #c13f3f; }
.skeleton-list { display: grid; gap: 18rpx; }.skeleton-card { padding: 26rpx; border-radius: 24rpx; background: #fff; }.skeleton-line { height: 24rpx; margin-top: 16rpx; border-radius: 999rpx; background: linear-gradient(90deg, #eef2f6 25%, #f8fafc 50%, #eef2f6 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }.skeleton-short { width: 28%; margin-top: 0; }.skeleton-medium { width: 62%; } @keyframes shimmer { to { background-position: -200% 0; } }
</style>
