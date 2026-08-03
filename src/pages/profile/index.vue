<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import AppTabBar from '@/components/AppTabBar.vue'
import { toAbsoluteFileUrl } from '@/utils/format'

const auth = useAuthStore()
const messageStore = useMessageStore()
const loading = ref(false)
const unreadCount = computed(() => messageStore.unreadCount)
const initial = computed(() => (auth.profile?.nickname || '同学').slice(0, 1))
const roleText = computed(() => auth.role === 'runner' ? '跑腿员' : auth.role === 'admin' ? '管理员' : '普通用户')
const menus = [
  { label: '个人资料', desc: '头像、昵称、手机号和学号', icon: 'person', url: '/pages/profile/edit' },
  { label: '我的钱包', desc: '余额、充值和资金管理', icon: 'wallet', url: '/pages/wallet/index' },
  { label: '钱包流水', desc: '查看收入和支出记录', icon: 'list', url: '/pages/wallet/logs' },
  { label: '跑腿员申请', desc: '提交身份资料并查看审核状态', icon: 'auth', url: '/pages/runner/apply' },
  { label: '我发布的订单', desc: '', icon: 'paperplane', url: '/pages/order/published' },
  { label: '我接单的订单', desc: '', icon: 'navigate', url: '/pages/order/taken' },
  { label: '消息中心', desc: '', icon: 'chat', url: '/pages/message/index' },
  { label: '评价列表', desc: '', icon: 'star', url: '/pages/review/list' },
]

async function loadProfile() {
  loading.value = true
  try { await auth.fetchProfile(); await messageStore.fetchMessages?.() }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
const go = (url: string) => uni.navigateTo({ url })
const logout = async () => { const result = await uni.showModal({ title: '退出登录', content: '退出后将停止接收实时消息，确定继续吗？', confirmText: '退出登录', confirmColor: '#dc2626' }); if (result.confirm) { await auth.logout(); uni.reLaunch({ url: '/pages/auth/index' }) } }
onPullDownRefresh(loadProfile)
onLoad(async () => { await auth.bootstrap(); if (!auth.isLogin) return uni.reLaunch({ url: '/pages/auth/index' }); loadProfile() })
</script>

<template>
  <view class="page-shell profile-page">
    <view v-if="loading" class="empty-box">加载中...</view>
    <template v-else>
      <view class="card profile-core" @tap="go('/pages/profile/edit')">
        <image v-if="auth.profile?.avatar" class="avatar" :src="toAbsoluteFileUrl(auth.profile.avatar)" mode="aspectFill" />
        <view v-else class="avatar avatar-placeholder">{{ initial }}</view>
        <view class="core-info"><view class="section-title">{{ auth.profile?.nickname || '同学' }}</view><view class="section-desc">{{ roleText }} · 信用分 {{ auth.profile?.creditScore || 0 }}</view></view>
        <uni-icons type="right" size="20" color="#9ca3af" />
      </view>
      <view class="card menu-card"><view v-for="item in menus" :key="item.label" class="menu-item" @tap="go(item.url)"><view class="menu-icon"><uni-icons :type="item.icon" size="22" color="#3B82F6" /></view><view class="menu-copy"><text class="menu-label">{{ item.label }}</text><text v-if="item.desc" class="menu-desc">{{ item.desc }}</text></view><uni-icons type="right" size="18" color="#c0c4cc" /></view></view>
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
</style>
