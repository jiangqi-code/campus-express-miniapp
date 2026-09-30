<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import AppTabBar from '@/components/AppTabBar.vue'
import { formatDateTime, toAbsoluteFileUrl } from '@/utils/format'
import { http } from '@/utils/request'
import type { RunnerDashboard } from '@/types/models'

const auth = useAuthStore()
const messageStore = useMessageStore()
const loading = ref(false)
const lastLoadedAt = ref(0)
const runnerLoading = ref(false)
const runnerError = ref('')
const runnerDashboard = ref<RunnerDashboard | null>(null)
const unreadCount = computed(() => messageStore.unreadCount)
const initial = computed(() => (auth.profile?.nickname || '同学').slice(0, 1))
const roleText = computed(() => auth.role === 'runner' ? '跑腿员' : auth.role === 'admin' ? '管理员' : '普通用户')
const isRunner = computed(() => auth.role === 'runner')
const runnerInitial = computed(() => (runnerDashboard.value?.runner.nickname || '跑').slice(0, 1))
const menus = computed(() => [
  { label: '个人资料', desc: '头像、昵称、手机号和学号', icon: 'person', url: '/pages/profile/edit' },
  { label: '我的钱包', desc: '余额、充值和资金管理', icon: 'wallet', url: '/pages/wallet/index' },
  { label: '钱包流水', desc: '查看收入和支出记录', icon: 'list', url: '/pages/wallet/logs' },
  { label: '我的优惠券', desc: '领取并查看可用优惠券', icon: 'gift', url: '/pages/coupon/index' },
  ...(isRunner.value
    ? [
      { label: '收益中心', desc: '查看收益、等级与提现记录', icon: 'wallet', url: '/pages/earnings/index' },
      { label: '外卖配送', desc: '接取食堂配送单', icon: 'map', url: '/pages/food/runner' },
    ]
    : [{ label: '跑腿员申请', desc: '提交身份资料并查看审核状态', icon: 'auth', url: '/pages/runner/apply' }]),
  { label: '我发布的订单', desc: '', icon: 'paperplane', url: '/pages/order/published' },
  { label: '我接单的订单', desc: '', icon: 'navigate', url: '/pages/order/taken' },
  { label: '我的外卖订单', desc: '查看点餐配送进度', icon: 'list', url: '/pages/food/orders' },
  { label: '消息中心', desc: '', icon: 'chat', url: '/pages/message/index' },
  { label: '评价列表', desc: '', icon: 'star', url: '/pages/review/list' },
])

const numberOf = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const stringList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => String(item).trim()).filter(Boolean)
  : []

const formatMoney = (value: unknown) => numberOf(value).toFixed(2)

async function loadRunnerDashboard() {
  if (!isRunner.value) {
    runnerDashboard.value = null
    return
  }
  runnerLoading.value = true
  runnerError.value = ''
  try {
    const response = await http.get<any>('/runner/dashboard')
    const root = response?.data?.data ?? response?.data ?? response ?? {}
    const runner = root?.runner ?? {}
    runnerDashboard.value = {
      runner: {
        avatar: String(runner.avatar ?? ''),
        nickname: String(runner.nickname ?? '跑腿员'),
        totalOrders: numberOf(runner.totalOrders ?? runner.total_orders),
        positiveReviewRate: numberOf(runner.positiveReviewRate ?? runner.positive_review_rate),
        reviewCount: numberOf(runner.reviewCount ?? runner.review_count),
        creditScore: numberOf(runner.creditScore ?? runner.credit_score),
        level: String(runner.level ?? '青铜'),
        reviewTags: Array.isArray(runner.reviewTags ?? runner.review_tags)
          ? (runner.reviewTags ?? runner.review_tags).map((tag: any) => ({ name: String(tag?.name ?? '').trim(), count: numberOf(tag?.count) })).filter((tag: { name: string }) => tag.name)
          : [],
        recentReviews: Array.isArray(runner.recentReviews ?? runner.recent_reviews)
          ? (runner.recentReviews ?? runner.recent_reviews).map((review: any) => ({
            id: numberOf(review?.id),
            rating: Math.max(0, Math.min(5, numberOf(review?.rating))),
            tags: stringList(review?.tags),
            content: String(review?.content ?? review?.comment ?? ''),
            createdAt: String(review?.createdAt ?? review?.created_at ?? ''),
          }))
          : [],
      },
      overview: {
        today: {
          orderCount: numberOf(root?.overview?.today?.orderCount ?? root?.overview?.today?.order_count),
          income: numberOf(root?.overview?.today?.income),
        },
        week: {
          orderCount: numberOf(root?.overview?.week?.orderCount ?? root?.overview?.week?.order_count),
          income: numberOf(root?.overview?.week?.income),
        },
      },
    }
  } catch (error: any) {
    runnerDashboard.value = null
    runnerError.value = error?.message || '跑腿数据加载失败'
  } finally {
    runnerLoading.value = false
  }
}

async function loadProfile(force = false) {
  if (loading.value || (!force && Date.now() - lastLoadedAt.value < 1500)) return
  loading.value = true
  try {
    await auth.fetchProfile()
    await loadRunnerDashboard()
    lastLoadedAt.value = Date.now()
  }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
const go = (url: string) => uni.navigateTo({ url })
const logout = async () => { const result = await uni.showModal({ title: '退出登录', content: '退出后将停止接收实时消息，确定继续吗？', confirmText: '退出登录', confirmColor: '#dc2626' }); if (result.confirm) { await auth.logout(); uni.reLaunch({ url: '/pages/auth/index' }) } }
onPullDownRefresh(() => loadProfile(true))
onLoad(async () => { await auth.bootstrap(); if (!auth.isLogin) return uni.reLaunch({ url: '/pages/auth/index' }); await loadProfile(true) })
onShow(() => { if (auth.isLogin) void loadProfile() })
</script>

<template>
  <view class="page-shell profile-page">
    <view v-if="loading" class="empty-box">加载中...</view>
    <template v-else>
      <view class="card profile-core" @tap="go('/pages/profile/edit')">
        <image v-if="auth.profile?.avatar" class="avatar" :src="toAbsoluteFileUrl(auth.profile.avatar)" mode="aspectFill" lazy-load />
        <view v-else class="avatar avatar-placeholder">{{ initial }}</view>
        <view class="core-info"><view class="section-title">{{ auth.profile?.nickname || '同学' }}</view><view class="section-desc">{{ roleText }} · 信用分 {{ auth.profile?.creditScore || 0 }}</view><view class="birthday">{{auth.profile?.birthDate?`生日 ${auth.profile.birthDate.slice(0,10)}`:'补充生日信息 →'}}</view></view>
        <uni-icons type="right" size="20" color="#9ca3af" />
      </view>
      <view v-if="isRunner" class="runner-section">
        <view v-if="runnerLoading" class="card runner-state">正在加载跑腿数据…</view>
        <view v-else-if="runnerDashboard" class="card runner-profile-card">
          <view class="runner-card-head"><view><view class="runner-title">跑腿员资料</view><view class="runner-caption">服务表现与近期评价</view></view><view class="runner-level">{{ runnerDashboard.runner.level }}</view></view>
          <view class="runner-data-grid">
            <view class="runner-data-item"><text>今日接单</text><strong>{{ runnerDashboard.overview.today.orderCount }}<small> 单</small></strong></view>
            <view class="runner-data-item"><text>今日收益</text><strong>¥{{ formatMoney(runnerDashboard.overview.today.income) }}</strong></view>
            <view class="runner-data-item"><text>本周接单</text><strong>{{ runnerDashboard.overview.week.orderCount }}<small> 单</small></strong></view>
            <view class="runner-data-item"><text>本周收益</text><strong>¥{{ formatMoney(runnerDashboard.overview.week.income) }}</strong></view>
          </view>
          <view class="runner-identity"><image v-if="runnerDashboard.runner.avatar" class="runner-avatar" :src="toAbsoluteFileUrl(runnerDashboard.runner.avatar)" mode="aspectFill" lazy-load /><view v-else class="runner-avatar runner-avatar-placeholder">{{ runnerInitial }}</view><view class="runner-name"><text>{{ runnerDashboard.runner.nickname }}</text><view>跑腿服务资料</view></view></view>
          <view class="runner-metric-grid"><view><text>接单总数</text><strong>{{ runnerDashboard.runner.totalOrders }} 单</strong></view><view><text>好评率</text><strong>{{ runnerDashboard.runner.reviewCount ? `${runnerDashboard.runner.positiveReviewRate}%` : '暂无评价' }}</strong></view><view><text>信用分</text><strong>{{ runnerDashboard.runner.creditScore }}</strong></view><view><text>等级</text><strong>{{ runnerDashboard.runner.level }}</strong></view></view>
          <view class="runner-feedback-block"><view class="runner-block-title">评价标签</view><view v-if="runnerDashboard.runner.reviewTags.length" class="runner-tags"><text v-for="tag in runnerDashboard.runner.reviewTags" :key="tag.name">{{ tag.name }} · {{ tag.count }}</text></view><view v-else class="runner-empty-copy">完成订单后，评价标签会在这里汇总。</view></view>
          <view class="runner-feedback-block"><view class="runner-block-title">最近评价</view><view v-if="runnerDashboard.runner.recentReviews.length" class="runner-review-list"><view v-for="review in runnerDashboard.runner.recentReviews" :key="review.id" class="runner-review"><view class="runner-review-top"><text>评分 {{ review.rating }} / 5</text><text>{{ formatDateTime(review.createdAt) }}</text></view><view class="runner-review-content">{{ review.content || '用户未填写文字评价' }}</view><view v-if="review.tags.length" class="runner-tags runner-tags-small"><text v-for="tag in review.tags" :key="tag">{{ tag }}</text></view></view></view><view v-else class="runner-empty-copy">暂时还没有收到评价。</view></view>
        </view>
        <view v-else class="card runner-state runner-error" @tap="loadRunnerDashboard">{{ runnerError || '跑腿数据加载失败，点击重试' }}</view>
      </view>
      <view class="card menu-card"><view v-for="item in menus" :key="item.label" class="menu-item" @tap="go(item.url)"><view class="menu-icon"><uni-icons :type="item.icon" size="22" color="#52C41A" /></view><view class="menu-copy"><text class="menu-label">{{ item.label }}</text><text v-if="item.desc" class="menu-desc">{{ item.desc }}</text></view><uni-icons type="right" size="18" color="#c0c4cc" /></view></view>
      <view class="btn-danger logout" @tap="logout">退出登录</view>
    </template>
    <!-- #ifdef H5 -->
    <AppTabBar current="profile" :unread-message-count="unreadCount" />
    <!-- #endif -->
  </view>
</template>

<style lang="scss" scoped>
.profile-page { padding-bottom: 160rpx; }.profile-core { display: flex; align-items: center; gap: 22rpx; }.avatar { width: 112rpx; height: 112rpx; border-radius: 50%; }.avatar-placeholder { display: flex; align-items: center; justify-content: center; color: #fff; background: #52c41a; font-size: 42rpx; }.core-info { flex: 1; }.menu-card { margin-top: 24rpx; padding: 0 24rpx; }.menu-item { display: flex; align-items: center; gap: 18rpx; padding: 24rpx 0; border-bottom: 1rpx solid #eef0f3; }.menu-item:last-child { border-bottom: 0; }.menu-icon { width: 64rpx; height: 64rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; background: #f1faed; }.menu-copy { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }.menu-label { font-size: 28rpx; color: #111827; }.menu-desc { font-size: 22rpx; color: #9ca3af; }.logout { margin-top: 36rpx; }

/* Commercial profile identity header */
.profile-page{background:#f6f9f3}.profile-core{position:relative;overflow:hidden;min-height:220rpx;padding:40rpx 32rpx;background:linear-gradient(135deg,#389e0d 0%,#52c41a 58%,#73d13d 100%);border-radius:40rpx;box-shadow:0 18rpx 42rpx rgba(82,196,26,.22)}.profile-core:after{content:'';position:absolute;right:-70rpx;top:-100rpx;width:260rpx;height:260rpx;border:40rpx solid rgba(255,255,255,.10);border-radius:50%}.profile-core .section-title,.profile-core .section-desc{color:#fff}.profile-core .section-desc{opacity:.78}.avatar{position:relative;z-index:1;width:128rpx;height:128rpx;border:6rpx solid rgba(255,255,255,.72);box-shadow:0 8rpx 24rpx rgba(30,41,59,.18)}.avatar-placeholder{background:rgba(255,255,255,.2)}.core-info{position:relative;z-index:1}.menu-card{border:0;border-radius:32rpx;box-shadow:0 4rpx 24rpx rgba(0,0,0,.05)}.menu-icon{background:#f1faed}.menu-item:nth-child(2n) .menu-icon{background:#edf8e9}.menu-item:nth-child(3n) .menu-icon{background:#fffbeb}.menu-item:nth-child(4n) .menu-icon{background:#ecfdf5}.menu-label{color:#1a1a2e!important;font-size:30rpx!important;font-weight:500}.menu-desc{color:#6b7280!important;font-size:24rpx!important}.logout{border:2rpx solid #fecaca;background:#fff;color:#ef4444;box-shadow:none}
.birthday{margin-top:12rpx;color:rgba(255,255,255,.9);font-size:23rpx}
.runner-section{margin-top:24rpx}.runner-profile-card{padding:30rpx}.runner-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20rpx}.runner-title{color:#1a1a2e;font-size:32rpx;font-weight:700}.runner-caption{margin-top:7rpx;color:#8a928c;font-size:22rpx}.runner-level{border-radius:999rpx;padding:8rpx 18rpx;background:#eff9eb;color:#389e0d;font-size:22rpx;font-weight:700}.runner-data-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:26rpx;border:2rpx solid #e5f1e7;border-radius:22rpx;overflow:hidden;background:#fafdfa}.runner-data-item{display:flex;min-height:118rpx;flex-direction:column;justify-content:center;gap:8rpx;padding:17rpx 20rpx;border-right:2rpx solid #e5f1e7;border-bottom:2rpx solid #e5f1e7}.runner-data-item:nth-child(2n){border-right:0}.runner-data-item:nth-child(n+3){border-bottom:0}.runner-data-item text,.runner-metric-grid text{color:#8a928c;font-size:21rpx}.runner-data-item strong{color:#1a5137;font-size:32rpx;font-weight:750;font-variant-numeric:tabular-nums}.runner-data-item small{font-size:21rpx;font-weight:500}.runner-identity{display:flex;align-items:center;gap:16rpx;margin-top:28rpx;padding-bottom:24rpx;border-bottom:2rpx solid #edf2ee}.runner-avatar{width:78rpx;height:78rpx;border:2rpx solid #d8ebdc;border-radius:50%}.runner-avatar-placeholder{display:flex;align-items:center;justify-content:center;background:#52c41a;color:#fff;font-size:30rpx;font-weight:750}.runner-name{display:flex;flex:1;flex-direction:column;gap:5rpx}.runner-name text{color:#1a1a2e;font-size:27rpx;font-weight:700}.runner-name view{color:#8a928c;font-size:21rpx}.runner-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12rpx;margin-top:22rpx}.runner-metric-grid view{display:flex;min-width:0;flex-direction:column;gap:8rpx}.runner-metric-grid strong{overflow:hidden;color:#1a1a2e;font-size:24rpx;font-weight:700;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}.runner-feedback-block{margin-top:24rpx;padding-top:22rpx;border-top:2rpx solid #edf2ee}.runner-block-title{color:#26392f;font-size:26rpx;font-weight:700}.runner-tags{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:14rpx}.runner-tags text{border:2rpx solid #dcebe0;border-radius:999rpx;padding:7rpx 13rpx;background:#f7fbf8;color:#4f6c5b;font-size:20rpx}.runner-tags-small{margin-top:10rpx}.runner-tags-small text{padding:5rpx 11rpx;font-size:19rpx}.runner-review-list{display:grid;gap:18rpx;margin-top:14rpx}.runner-review{padding-bottom:18rpx;border-bottom:2rpx solid #edf2ee}.runner-review:last-child{padding-bottom:0;border-bottom:0}.runner-review-top{display:flex;justify-content:space-between;gap:16rpx;color:#5d7768;font-size:20rpx}.runner-review-top text:last-child{color:#a3afa7;text-align:right}.runner-review-content{margin-top:10rpx;color:#33473a;font-size:24rpx;line-height:1.55}.runner-empty-copy{margin-top:12rpx;color:#9aa69e;font-size:22rpx}.runner-state{padding:44rpx 30rpx;color:#7d8d83;font-size:25rpx;text-align:center}.runner-error{color:#d86b50}
</style>
