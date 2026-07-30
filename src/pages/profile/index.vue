<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import AppTabBar from '@/components/AppTabBar.vue'
import { formatMoney, toAbsoluteFileUrl } from '@/utils/format'
import { http, uploadImage } from '@/utils/request'
import type { RunnerAuthStatus, UserProfile } from '@/types/models'

const authStore = useAuthStore()
const messageStore = useMessageStore()
const unreadCount = computed(() => messageStore.unreadCount)
const loading = ref(false)
const wallet = ref({ balance: 0, frozen: 0 })

const editing = ref(false)
const editForm = reactive<{ nickname: string; phone: string; studentId: string }>({
  nickname: '',
  phone: '',
  studentId: '',
})
const submittingEdit = ref(false)

const rechargeVisible = ref(false)
const rechargeAmount = ref('')
const submittingRecharge = ref(false)

const applyVisible = ref(false)
const applyForm = reactive<{ student_id: string; phone: string; real_name: string; reason: string }>({
  student_id: '',
  phone: '',
  real_name: '',
  reason: '',
})
const submittingApply = ref(false)

const firstLetter = computed(() => {
  const name = authStore.profile?.nickname || 'U'
  const letter = name.trim().charAt(0).toUpperCase()
  return letter || 'U'
})

const canSwitchRole = computed(() => {
  if (authStore.role === 'admin') return false
  if (authStore.role === 'runner') return true
  return authStore.runnerAuthStatus === 'APPROVED'
})

const runnerBadgeType = computed((): 'default' | 'warning' | 'success' | 'danger' => {
  const map: Record<RunnerAuthStatus, 'default' | 'warning' | 'success' | 'danger'> = {
    NONE: 'default',
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
  }
  if (authStore.role === 'runner') return 'success'
  return map[authStore.runnerAuthStatus] || 'default'
})

const runnerBadgeClass = computed(() => {
  const map = {
    default: 'badge-default',
    warning: 'badge-warning',
    success: 'badge-success',
    danger: 'badge-danger',
  }
  return map[runnerBadgeType.value]
})

const runnerStatusLabel = computed(() => {
  if (authStore.role === 'runner') return '已是跑腿员'
  const map: Record<RunnerAuthStatus, string> = {
    NONE: '未申请',
    PENDING: '审核中',
    APPROVED: '审核通过',
    REJECTED: '审核拒绝',
  }
  return map[authStore.runnerAuthStatus] || '未申请'
})

const showApplyButton = computed(() => {
  if (authStore.role === 'runner') return false
  return authStore.runnerAuthStatus === 'NONE' || authStore.runnerAuthStatus === 'REJECTED'
})

const isApplyPending = computed(() => authStore.runnerAuthStatus === 'PENDING')

const fetchProfileWithFallback = async () => {
  try {
    const res = await http.get<any>('/user/me')
    const user = res?.data?.user ?? res?.user ?? res?.data ?? res ?? {}
    const profile: UserProfile = {
      id: String(user?.id ?? user?.user_id ?? authStore.profile?.id ?? ''),
      nickname: String(user?.nickname ?? authStore.profile?.nickname ?? '同学'),
      phone: String(user?.phone ?? authStore.profile?.phone ?? ''),
      studentId: String(user?.student_id ?? user?.studentId ?? authStore.profile?.studentId ?? ''),
      avatar: String(user?.avatar ?? user?.avatar_url ?? authStore.profile?.avatar ?? ''),
      role: (String(user?.role ?? authStore.role ?? 'user').toLowerCase() as UserProfile['role']),
      creditScore: Number(user?.credit_score ?? user?.creditScore ?? authStore.profile?.creditScore ?? 0),
      walletBalance: Number(user?.wallet_balance ?? user?.walletBalance ?? authStore.profile?.walletBalance ?? 0),
    }
    authStore.profile = profile
    authStore.role = profile.role
    await (authStore as any).persist?.()
    return profile
  } catch {
    return authStore.fetchProfile()
  }
}

const fetchWallet = async () => {
  try {
    const res = await http.get<any>('/wallet/info')
    wallet.value = {
      balance: Number(res?.data?.balance ?? res?.balance ?? 0),
      frozen: Number(res?.data?.frozen ?? res?.frozen ?? 0),
    }
  } catch {
    wallet.value = { balance: 0, frozen: 0 }
  }
}

const fetchRunnerAuthWithFallback = async () => {
  try {
    try {
      const res = await http.get<any>('/user/auth-status')
      const status = String(
        res?.data?.authStatus ?? res?.authStatus ?? res?.data?.status ?? res?.status ?? '',
      ).toUpperCase() as RunnerAuthStatus
      const valid: RunnerAuthStatus[] = ['NONE', 'PENDING', 'APPROVED', 'REJECTED']
      authStore.runnerAuthStatus = valid.includes(status) ? status : 'NONE'
      return authStore.runnerAuthStatus
    } catch {
      const res = await http.get<any>('/user/auth')
      const status = String(
        res?.data?.authStatus ?? res?.authStatus ?? res?.data?.status ?? res?.status ?? '',
      ).toUpperCase() as RunnerAuthStatus
      const valid: RunnerAuthStatus[] = ['NONE', 'PENDING', 'APPROVED', 'REJECTED']
      authStore.runnerAuthStatus = valid.includes(status) ? status : 'NONE'
      return authStore.runnerAuthStatus
    }
  } catch {
    authStore.runnerAuthStatus = 'NONE'
    return 'NONE'
  }
}

const fetchPageData = async () => {
  loading.value = true
  try {
    await Promise.all([
      fetchProfileWithFallback(),
      fetchWallet(),
      fetchRunnerAuthWithFallback(),
    ])
  } catch (error: any) {
    uni.showToast({ title: error.message || '个人信息加载失败', icon: 'none' })
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

const openEdit = () => {
  editForm.nickname = authStore.profile?.nickname || ''
  editForm.phone = authStore.profile?.phone || ''
  editForm.studentId = authStore.profile?.studentId || ''
  editing.value = true
}

const closeEdit = () => {
  editing.value = false
}

const saveProfile = async () => {
  if (!editForm.nickname.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  submittingEdit.value = true
  try {
    const payload1 = {
      nickname: editForm.nickname.trim(),
      phone: editForm.phone.trim(),
      student_id: editForm.studentId.trim(),
    }
    try {
      await http.put('/user/profile', payload1)
    } catch {
      const payload2 = {
        nickname: editForm.nickname.trim(),
        phone: editForm.phone.trim(),
        studentId: editForm.studentId.trim(),
      }
      await http.put('/user/profile', payload2)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    editing.value = false
    await fetchProfileWithFallback()
  } catch (error: any) {
    uni.showToast({ title: error.message || '保存失败', icon: 'none' })
  } finally {
    submittingEdit.value = false
  }
}

const chooseAvatar = () => {
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      try {
        const avatar = await uploadImage(res.tempFilePaths[0], 'file')
        await http.post('/user/avatar', { avatar })
        uni.showToast({ title: '头像更新成功', icon: 'success' })
        await fetchProfileWithFallback()
      } catch (error: any) {
        uni.showToast({ title: error.message || '头像上传失败', icon: 'none' })
      }
    },
  })
}

const openRecharge = () => {
  rechargeAmount.value = ''
  rechargeVisible.value = true
}

const closeRecharge = () => {
  rechargeVisible.value = false
}

const confirmRecharge = async () => {
  const amount = Number(rechargeAmount.value)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '请输入大于 0 的金额', icon: 'none' })
    return
  }
  submittingRecharge.value = true
  try {
    await http.post('/wallet/recharge', { amount })
    uni.showToast({ title: '充值成功', icon: 'success' })
    rechargeVisible.value = false
    await fetchWallet()
  } catch (error: any) {
    uni.showToast({ title: error.message || '充值失败', icon: 'none' })
  } finally {
    submittingRecharge.value = false
  }
}

const switchRole = async () => {
  if (authStore.role === 'admin') {
    uni.showToast({ title: '管理员账号不允许切换', icon: 'none' })
    return
  }
  try {
    const nextRole = authStore.role === 'runner' ? 'USER' : 'RUNNER'
    await http.put('/user/switch-role', { role: nextRole })
    authStore.role = nextRole.toLowerCase() as 'user' | 'runner'
    if (authStore.profile) authStore.profile.role = authStore.role
    await (authStore as any).persist?.()
    uni.showToast({ title: '身份已切换', icon: 'success' })
    await fetchProfileWithFallback()
  } catch (error: any) {
    uni.showToast({ title: error.message || '切换失败', icon: 'none' })
  }
}

const openApply = () => {
  applyForm.student_id = authStore.profile?.studentId || ''
  applyForm.phone = authStore.profile?.phone || ''
  applyForm.real_name = authStore.profile?.nickname || ''
  applyForm.reason = ''
  applyVisible.value = true
}

const closeApply = () => {
  applyVisible.value = false
}

const submitApply = async () => {
  if (!applyForm.student_id.trim()) {
    uni.showToast({ title: '请输入学号', icon: 'none' })
    return
  }
  if (!applyForm.phone.trim()) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return
  }
  if (!applyForm.real_name.trim()) {
    uni.showToast({ title: '请输入真实姓名', icon: 'none' })
    return
  }
  submittingApply.value = true
  try {
    await http.post('/user/auth', {
      student_id: applyForm.student_id.trim(),
      phone: applyForm.phone.trim(),
      real_name: applyForm.real_name.trim(),
      reason: applyForm.reason.trim() || '小程序端申请跑腿员',
    })
    uni.showToast({ title: '申请已提交', icon: 'success' })
    applyVisible.value = false
    await fetchRunnerAuthWithFallback()
  } catch (error: any) {
    uni.showToast({ title: error.message || '申请失败', icon: 'none' })
  } finally {
    submittingApply.value = false
  }
}

const goPage = (url: string) => {
  uni.navigateTo({ url })
}

const logout = async () => {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    success: async (res) => {
      if (!res.confirm) return
      await authStore.logout()
      uni.reLaunch({ url: '/pages/auth/index' })
    },
  })
}

onPullDownRefresh(() => {
  fetchPageData()
})

onLoad(async () => {
  await authStore.bootstrap()
  if (!authStore.isLogin) {
    uni.reLaunch({ url: '/pages/auth/index' })
    return
  }
  fetchPageData()
})
</script>

<template>
  <view class="page-shell">
    <view v-if="loading" class="empty-box">加载中...</view>
    <template v-else>
      <view class="card profile-card">
        <view class="row gap-20 profile-header">
          <view class="avatar-wrapper" @tap="chooseAvatar">
            <image
              v-if="authStore.profile?.avatar"
              class="avatar"
              :src="toAbsoluteFileUrl(authStore.profile.avatar)"
              mode="aspectFill"
            />
            <view v-else class="avatar placeholder-avatar">
              {{ firstLetter }}
            </view>
            <view class="avatar-camera">
              <text class="avatar-camera-icon">📷</text>
            </view>
          </view>

          <view class="user-info">
            <view class="section-title">{{ authStore.profile?.nickname || '同学' }}</view>
            <view class="section-desc">ID：{{ authStore.profile?.id || '-' }}</view>
            <view class="section-desc">手机号：{{ authStore.profile?.phone || '-' }}</view>
            <view class="section-desc">学号：{{ authStore.profile?.studentId || '-' }}</view>
            <view class="row gap-8 info-tags">
              <view class="badge badge-primary">{{ authStore.role === 'runner' ? '跑腿员' : authStore.role === 'admin' ? '管理员' : '普通用户' }}</view>
              <view class="badge badge-default">信用分 {{ authStore.profile?.creditScore || 0 }}</view>
            </view>
          </view>
        </view>

        <view class="edit-toggle-row" @tap="openEdit">
          <text class="edit-toggle-text">{{ editing ? '收起编辑' : '编辑资料' }}</text>
          <text class="muted">{{ editing ? '▴' : '▾' }}</text>
        </view>

        <view v-if="editing" class="edit-section">
          <view class="field-group">
            <view class="field-label">昵称 <text class="required">*</text></view>
            <input
              class="input"
              v-model="editForm.nickname"
              placeholder="请输入昵称"
              maxlength="20"
            />
          </view>
          <view class="field-group">
            <view class="field-label">手机号</view>
            <input
              class="input"
              v-model="editForm.phone"
              placeholder="请输入手机号"
              type="number"
              maxlength="11"
            />
          </view>
          <view class="field-group">
            <view class="field-label">学号</view>
            <input
              class="input"
              v-model="editForm.studentId"
              placeholder="请输入学号"
              maxlength="30"
            />
          </view>
          <view class="row gap-16 edit-actions">
            <view class="btn-ghost flex-1" @tap="closeEdit">取消</view>
            <view class="btn-primary flex-1" :class="{ disabled: submittingEdit }" @tap="saveProfile">
              {{ submittingEdit ? '保存中...' : '保存修改' }}
            </view>
          </view>
        </view>
      </view>

      <view class="card wallet-card">
        <view class="row-between wallet-header">
          <view class="section-title">我的钱包</view>
          <view class="btn-ghost btn-small" @tap="openRecharge">充值</view>
        </view>
        <view class="grid-2 wallet-grid">
          <view class="wallet-item">
            <view class="muted">可用余额</view>
            <view class="wallet-value balance">{{ formatMoney(wallet.balance) }}</view>
          </view>
          <view class="wallet-item">
            <view class="muted">冻结金额</view>
            <view class="wallet-value frozen">{{ formatMoney(wallet.frozen) }}</view>
          </view>
        </view>
      </view>

      <view class="card menu-card">
        <view class="menu-item" @tap="goPage('/pages/order/published')">
          <view class="row gap-16">
            <text class="menu-icon">📦</text>
            <text class="menu-text">我发布的订单</text>
          </view>
          <text class="muted">›</text>
        </view>
        <view class="menu-item" @tap="goPage('/pages/order/taken')">
          <view class="row gap-16">
            <text class="menu-icon">🛵</text>
            <text class="menu-text">我接单的订单</text>
          </view>
          <text class="muted">›</text>
        </view>
        <view class="menu-item" @tap="goPage('/pages/earnings/index')">
          <view class="row gap-16">
            <text class="menu-icon">💰</text>
            <text class="menu-text">收益 / 钱包 / 提现</text>
          </view>
          <text class="muted">›</text>
        </view>
        <view class="menu-item" @tap="goPage('/pages/message/index')">
          <view class="row gap-16">
            <text class="menu-icon">🔔</text>
            <text class="menu-text">消息中心</text>
          </view>
          <text class="muted">›</text>
        </view>
        <view class="menu-item menu-item-last" @tap="goPage('/pages/review/index')">
          <view class="row gap-16">
            <text class="menu-icon">⭐</text>
            <text class="menu-text">评价列表</text>
          </view>
          <text class="muted">›</text>
        </view>
      </view>

      <view class="card runner-card">
        <view class="row-between">
          <view>
            <view class="section-title">跑腿员资格</view>
            <view class="section-desc">当前状态：{{ runnerStatusLabel }}</view>
          </view>
          <view class="badge" :class="runnerBadgeClass">{{ authStore.role === 'runner' ? 'RUNNER' : authStore.runnerAuthStatus }}</view>
        </view>

        <view v-if="canSwitchRole" class="btn-primary runner-action-btn" @tap="switchRole">
          {{ authStore.role === 'runner' ? '切换为普通用户' : '切换为跑腿员' }}
        </view>
        <view v-else-if="showApplyButton" class="btn-secondary runner-action-btn" @tap="openApply">
          {{ authStore.runnerAuthStatus === 'REJECTED' ? '重新申请跑腿员' : '申请成为跑腿员' }}
        </view>
        <view v-else-if="isApplyPending" class="btn-ghost runner-action-btn disabled">
          审核中，请耐心等待
        </view>
      </view>

      <view class="btn-danger logout-btn" @tap="logout">退出登录</view>
    </template>

    <view v-if="rechargeVisible" class="modal-mask" @tap="closeRecharge">
      <view class="modal-box" @tap.stop>
        <view class="modal-header">
          <view class="section-title">钱包充值</view>
          <view class="modal-close" @tap="closeRecharge">✕</view>
        </view>
        <view class="modal-body">
          <view class="field-label">充值金额</view>
          <input
            class="input recharge-input"
            v-model="rechargeAmount"
            type="digit"
            placeholder="请输入充值金额（元）"
          />
          <view class="row gap-8 quick-amounts">
            <view
              v-for="amt in ['10', '20', '50', '100']"
              :key="amt"
              class="quick-amount"
              @tap="rechargeAmount = amt"
            >
              ¥{{ amt }}
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <view class="btn-ghost flex-1" @tap="closeRecharge">取消</view>
          <view class="btn-primary flex-1" :class="{ disabled: submittingRecharge }" @tap="confirmRecharge">
            {{ submittingRecharge ? '充值中...' : '确认充值' }}
          </view>
        </view>
      </view>
    </view>

    <view v-if="applyVisible" class="modal-mask" @tap="closeApply">
      <view class="modal-box" @tap.stop>
        <view class="modal-header">
          <view class="section-title">申请跑腿员</view>
          <view class="modal-close" @tap="closeApply">✕</view>
        </view>
        <view class="modal-body">
          <view class="field-group">
            <view class="field-label">学号 <text class="required">*</text></view>
            <input class="input" v-model="applyForm.student_id" placeholder="请输入学号" maxlength="30" />
          </view>
          <view class="field-group">
            <view class="field-label">手机号 <text class="required">*</text></view>
            <input class="input" v-model="applyForm.phone" placeholder="请输入手机号" type="number" maxlength="11" />
          </view>
          <view class="field-group">
            <view class="field-label">真实姓名 <text class="required">*</text></view>
            <input class="input" v-model="applyForm.real_name" placeholder="请输入真实姓名" maxlength="20" />
          </view>
          <view class="field-group">
            <view class="field-label">申请理由</view>
            <textarea class="textarea" v-model="applyForm.reason" placeholder="请简单说明申请理由（选填）" maxlength="200" />
          </view>
        </view>
        <view class="modal-footer">
          <view class="btn-ghost flex-1" @tap="closeApply">取消</view>
          <view class="btn-primary flex-1" :class="{ disabled: submittingApply }" @tap="submitApply">
            {{ submittingApply ? '提交中...' : '提交申请' }}
          </view>
        </view>
      </view>
    </view>

    <AppTabBar current="profile" :unread-message-count="unreadCount" />
  </view>
</template>

<style lang="scss" scoped>
.profile-card {
  position: relative;
}

.profile-header {
  align-items: flex-start;
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
}

.placeholder-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  font-size: 52rpx;
  font-weight: 700;
}

.avatar-camera {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 44rpx;
  height: 44rpx;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.avatar-camera-icon {
  font-size: 22rpx;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.info-tags {
  margin-top: 16rpx;
  flex-wrap: wrap;
}

.edit-toggle-row {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.edit-toggle-text {
  color: #2563eb;
  font-size: 26rpx;
  font-weight: 600;
}

.edit-section {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid #f3f4f6;
}

.field-group {
  margin-bottom: 20rpx;
}

.required {
  color: #ef4444;
}

.edit-actions {
  margin-top: 28rpx;
}

.flex-1 {
  flex: 1;
}

.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.wallet-card {
  margin-top: 24rpx;
}

.wallet-header {
  margin-bottom: 24rpx;
}

.btn-small {
  height: 56rpx;
  min-width: 120rpx;
  padding: 0 24rpx;
  border-radius: 14rpx;
  font-size: 24rpx;
}

.wallet-grid {
  margin-top: 8rpx;
}

.wallet-item {
  padding: 20rpx 0;
  text-align: center;
  background: #f9fafb;
  border-radius: 18rpx;
}

.wallet-value {
  margin-top: 12rpx;
  font-size: 40rpx;
  font-weight: 700;
}

.wallet-value.balance {
  color: #2563eb;
}

.wallet-value.frozen {
  color: #6b7280;
}

.menu-card {
  margin-top: 24rpx;
  padding: 0 24rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
}

.menu-item-last {
  border-bottom: none;
}

.menu-icon {
  font-size: 34rpx;
}

.menu-text {
  font-size: 28rpx;
  color: #111827;
}

.runner-card {
  margin-top: 24rpx;
}

.runner-action-btn {
  margin-top: 28rpx;
}

.logout-btn {
  margin-top: 40rpx;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 48rpx;
}

.modal-box {
  width: 100%;
  background: #ffffff;
  border-radius: 28rpx;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32rpx 24rpx;
  border-bottom: 2rpx solid #f3f4f6;
}

.modal-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 32rpx;
}

.modal-body {
  padding: 28rpx 32rpx;
  max-height: 70vh;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx 32rpx;
  border-top: 2rpx solid #f3f4f6;
}

.recharge-input {
  font-size: 32rpx;
  font-weight: 600;
}

.quick-amounts {
  margin-top: 20rpx;
  flex-wrap: wrap;
}

.quick-amount {
  padding: 16rpx 28rpx;
  background: #eef2ff;
  color: #2563eb;
  border-radius: 14rpx;
  font-size: 26rpx;
  font-weight: 600;
}

.page-shell {
  padding-bottom: 160rpx;
}
</style>
