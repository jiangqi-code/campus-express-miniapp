<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { formatDateTime, formatMoney } from '@/utils/format'
import { http } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

interface LevelConfig {
  key: string
  name: string
  min: number
  max: number
  benefits: string[]
  color: string
  badgeClass: string
}

const LEVELS: LevelConfig[] = [
  {
    key: 'BRONZE',
    name: '青铜',
    min: 0,
    max: 399,
    benefits: ['基础信用保障', '普通接单权限', '标准提现周期'],
    color: '#b45309',
    badgeClass: 'badge-warning',
  },
  {
    key: 'SILVER',
    name: '白银',
    min: 400,
    max: 699,
    benefits: ['更高曝光权重', '优先派单资格', '提现手续费优惠'],
    color: '#6b7280',
    badgeClass: 'badge-default',
  },
  {
    key: 'GOLD',
    name: '黄金',
    min: 700,
    max: 849,
    benefits: ['订单优先展示', '专属客服通道', '极速提现服务'],
    color: '#d97706',
    badgeClass: 'badge-warning',
  },
  {
    key: 'DIAMOND',
    name: '钻石',
    min: 850,
    max: 9999,
    benefits: ['最高曝光等级', '优先服务特权', '0手续费提现'],
    color: '#2563eb',
    badgeClass: 'badge-primary',
  },
]

const WITHDRAW_STATUS_MAP: Record<string, { label: string; class: string }> = {
  PENDING: { label: '审核中', class: 'badge-warning' },
  APPROVED: { label: '已通过', class: 'badge-success' },
  REJECTED: { label: '已拒绝', class: 'badge-danger' },
}

const loading = ref(false)
const errorMsg = ref('')
const withdrawSubmitting = ref(false)
const withdrawAmount = ref('')

const credit = ref({ score: 0, level: 'BRONZE' })
const wallet = ref({ balance: 0, frozen: 0 })

const logs = ref<any[]>([])
const logsPage = ref(1)
const logsPageSize = 20
const logsTotal = ref(0)
const logsLoading = ref(false)

const withdrawals = ref<any[]>([])

const currentLevelIndex = computed(() => {
  const score = credit.value.score
  const idx = LEVELS.findIndex((l) => score >= l.min && score <= l.max)
  return idx >= 0 ? idx : 0
})

const currentLevel = computed(() => LEVELS[currentLevelIndex.value])

const nextLevel = computed(() => {
  if (currentLevelIndex.value >= LEVELS.length - 1) return null
  return LEVELS[currentLevelIndex.value + 1]
})

const progressPercent = computed(() => {
  const curr = currentLevel.value
  const next = nextLevel.value
  const score = credit.value.score
  if (!next) return 100
  const range = next.min - curr.min
  const done = score - curr.min
  return Math.min(100, Math.max(0, Math.round((done / range) * 100)))
})

const distanceToNext = computed(() => {
  const next = nextLevel.value
  if (!next) return 0
  return Math.max(0, next.min - credit.value.score)
})

const canWithdraw = computed(() => wallet.value.balance >= 1)

const logsHasPrev = computed(() => logsPage.value > 1)
const logsHasNext = computed(() => logsPage.value * logsPageSize < logsTotal.value)

const getCreditType = (delta: number) => (delta >= 0 ? '加分' : '减分')
const getCreditClass = (delta: number) => (delta >= 0 ? 'success' : 'danger')
const formatDelta = (delta: number) => (delta >= 0 ? `+${delta}` : `${delta}`)

const getWithdrawStatusInfo = (status: string) => {
  const key = String(status || '').toUpperCase()
  return WITHDRAW_STATUS_MAP[key] || { label: status || '未知', class: 'badge-default' }
}

const fetchCreditScore = async () => {
  try {
    const res = await http.get<any>('/credit/score').catch(() => ({}))
    credit.value = {
      score: Number(res?.data?.credit_score ?? res?.credit_score ?? credit.value.score ?? 0),
      level: String(res?.data?.credit_level ?? res?.credit_level ?? credit.value.level ?? 'BRONZE').toUpperCase(),
    }
  } catch {
    // ignore
  }
}

const fetchWalletInfo = async () => {
  try {
    const res = await http.get<any>('/wallet/info').catch(() => ({}))
    wallet.value = {
      balance: Number(res?.data?.balance ?? res?.balance ?? wallet.value.balance ?? 0),
      frozen: Number(res?.data?.frozen ?? res?.frozen ?? wallet.value.frozen ?? 0),
    }
  } catch {
    // ignore
  }
}

const fetchCreditLogs = async (page = logsPage.value) => {
  logsLoading.value = true
  try {
    const res = await http.get<any>('/credit/logs', { page, pageSize: logsPageSize }).catch(() => ({}))
    const list = res?.data?.list ?? res?.data?.items ?? res?.list ?? res?.items ?? []
    const total = Number(res?.data?.total ?? res?.total ?? list.length)
    logs.value = list
    logsTotal.value = total
    logsPage.value = page
  } catch {
    logs.value = []
    logsTotal.value = 0
  } finally {
    logsLoading.value = false
  }
}

const fetchWithdrawList = async () => {
  try {
    const res = await http.get<any>('/withdraw/list', { page: 1, pageSize: 50 }).catch(() => ({}))
    withdrawals.value = res?.data?.list ?? res?.data?.items ?? res?.list ?? res?.items ?? []
  } catch {
    withdrawals.value = []
  }
}

const fetchPageData = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    await Promise.all([
      fetchCreditScore(),
      fetchWalletInfo(),
      fetchCreditLogs(1),
      fetchWithdrawList(),
    ])
  } catch (err: any) {
    errorMsg.value = err?.message || '数据加载失败，请下拉刷新重试'
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

const submitWithdraw = async () => {
  const amount = Number(withdrawAmount.value)
  if (!Number.isFinite(amount) || amount < 1) {
    uni.showToast({ title: '请输入不小于 1 元的提现金额', icon: 'none' })
    return
  }
  if (amount > wallet.value.balance) {
    uni.showToast({ title: '提现金额不能超过余额', icon: 'none' })
    return
  }
  withdrawSubmitting.value = true
  try {
    await http.post('/withdraw/apply', { amount })
    uni.showToast({ title: '提现申请已提交', icon: 'success' })
    withdrawAmount.value = ''
    await Promise.all([fetchWalletInfo(), fetchWithdrawList()])
  } catch (err: any) {
    uni.showToast({ title: err?.message || '提现失败', icon: 'none' })
  } finally {
    withdrawSubmitting.value = false
  }
}

const goPrevLogsPage = () => {
  if (logsHasPrev.value && !logsLoading.value) {
    fetchCreditLogs(logsPage.value - 1)
  }
}

const goNextLogsPage = () => {
  if (logsHasNext.value && !logsLoading.value) {
    fetchCreditLogs(logsPage.value + 1)
  }
}

onPullDownRefresh(() => {
  fetchPageData()
})

onLoad(() => {
  fetchPageData()
})
</script>

<template>
  <view class="page-shell">
    <view v-if="loading" class="empty-box">
      <view class="loading-spinner"></view>
      <view class="loading-text">加载中...</view>
    </view>

    <view v-else-if="errorMsg" class="empty-box error-box">
      <view class="error-icon">⚠️</view>
      <view class="error-text">{{ errorMsg }}</view>
      <view class="btn-secondary retry-btn" @tap="fetchPageData">重新加载</view>
    </view>

    <template v-else>
      <view class="earnings-top card">
        <view class="section-title light-title">钱包余额</view>
        <view class="balance-number">{{ formatMoney(wallet.balance) }}</view>
        <view class="row-between top-meta-row">
          <view class="meta-item">
            <view class="meta-label">信用分</view>
            <view class="meta-value credit-score">{{ credit.score }}</view>
          </view>
          <view class="meta-item center-item">
            <view class="meta-label">当前等级</view>
            <view class="badge level-badge" :class="currentLevel.badgeClass" :style="{ borderColor: currentLevel.color }">
              {{ currentLevel.name }}
            </view>
          </view>
          <view class="meta-item right-item">
            <view class="meta-label">冻结金额</view>
            <view class="meta-value frozen-value">{{ formatMoney(wallet.frozen) }}</view>
          </view>
        </view>
      </view>

      <view class="card progress-card">
        <view class="section-title">信用等级进度</view>
        <view class="progress-info">
          <view class="progress-range-text">
            <text>本级范围：{{ currentLevel.min }} - {{ currentLevel.max === 9999 ? '∞' : currentLevel.max }}</text>
            <text v-if="nextLevel" class="next-range">下一等级：{{ nextLevel.min }}+</text>
          </view>
          <view class="progress-bar-wrapper">
            <view class="progress-bar-bg">
              <view class="progress-bar-fill" :style="{ width: `${progressPercent}%`, background: currentLevel.color }"></view>
            </view>
            <view class="progress-percent" :style="{ color: currentLevel.color }">{{ progressPercent }}%</view>
          </view>
          <view v-if="nextLevel" class="progress-hint">
            距离 <text class="next-level-name" :style="{ color: nextLevel.color }">{{ nextLevel.name }}</text> 还需
            <text class="need-score" :style="{ color: nextLevel.color }">{{ distanceToNext }}</text> 分
          </view>
          <view v-else class="progress-hint max-level">
            🎉 已达最高等级，享受全部特权！
          </view>
        </view>
      </view>

      <view class="card withdraw-card">
        <view class="section-title">提现申请</view>
        <view class="section-desc">余额达到 1 元即可申请提现，审核通过后 1-3 个工作日到账</view>
        <view class="withdraw-input-row">
          <text class="currency-symbol">¥</text>
          <input
            v-model="withdrawAmount"
            class="input withdraw-input"
            type="digit"
            placeholder="请输入提现金额"
            :disabled="!canWithdraw || withdrawSubmitting"
          />
          <view
            v-if="canWithdraw"
            class="all-in-btn"
            @tap="withdrawAmount = String(wallet.balance.toFixed(2))"
          >
            全部
          </view>
        </view>
        <view class="withdraw-tips">
          <text class="muted">当前可提现余额：</text>
          <text class="balance-amount">{{ formatMoney(wallet.balance) }}</text>
        </view>
        <view
          class="btn-primary submit-btn"
          :class="{ disabled: !canWithdraw || withdrawSubmitting }"
          @tap="submitWithdraw"
        >
          {{ withdrawSubmitting ? '提交中...' : '提交提现申请' }}
        </view>
        <view class="withdraw-desc">
          <text>· 单笔最低提现 1 元</text>
          <text>· 提现将在审核后处理</text>
        </view>
      </view>

      <view class="card levels-card">
        <view class="section-title">等级说明</view>
        <view class="section-desc">信用分越高，等级越高，享受更多权益</view>
        <view class="levels-list">
          <view
            v-for="(lv, idx) in LEVELS"
            :key="lv.key"
            class="level-item"
            :class="{ active: currentLevel.key === lv.key }"
            :style="currentLevel.key === lv.key ? { borderColor: lv.color, boxShadow: `0 8rpx 24rpx ${lv.color}33` } : {}"
          >
            <view class="level-header" :style="{ borderColor: lv.color }">
              <view class="level-name" :style="{ color: lv.color }">
                {{ lv.name }}
              </view>
              <view class="level-score-range muted">{{ lv.min }} - {{ lv.max === 9999 ? '∞' : lv.max }}</view>
              <view v-if="currentLevel.key === lv.key" class="current-tag" :style="{ background: lv.color }">当前</view>
            </view>
            <view class="level-benefits">
              <view v-for="(b, bi) in lv.benefits" :key="bi" class="benefit-item">
                <text class="benefit-dot" :style="{ background: lv.color }"></text>
                <text>{{ b }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="card logs-card">
        <view class="row-between">
          <view class="section-title">信用变动记录</view>
          <view class="logs-page-info muted">
            第 {{ logsPage }} 页 / 共 {{ Math.ceil(logsTotal / logsPageSize) || 1 }} 页
          </view>
        </view>
        <view v-if="logsLoading" class="empty-box">
          <view class="loading-spinner small"></view>
        </view>
        <view v-else-if="logs.length === 0" class="empty-box">
          <view>📝</view>
          <view class="empty-text">暂无信用变动记录</view>
        </view>
        <view v-else class="logs-list">
          <view v-for="(item, idx) in logs" :key="item.id || idx" class="log-row">
            <view class="log-info">
              <view class="log-remark">{{ item.remark || item.description || '信用变动' }}</view>
              <view class="row gap-12 log-meta">
                <text class="muted small-text">{{ formatDateTime(item.created_at || item.createdAt) }}</text>
                <view class="log-type-tag">{{ getCreditType(Number(item.delta || 0)) }}</view>
              </view>
            </view>
            <view class="log-delta" :class="getCreditClass(Number(item.delta || 0))">
              {{ formatDelta(Number(item.delta || 0)) }}
            </view>
          </view>
        </view>
        <view v-if="!logsLoading && logs.length > 0" class="logs-pagination row-between">
          <view
            class="btn-ghost page-btn"
            :class="{ disabled: !logsHasPrev }"
            @tap="goPrevLogsPage"
          >
            上一页
          </view>
          <view class="muted page-number">{{ logsPage }} / {{ Math.ceil(logsTotal / logsPageSize) || 1 }}</view>
          <view
            class="btn-ghost page-btn"
            :class="{ disabled: !logsHasNext }"
            @tap="goNextLogsPage"
          >
            下一页
          </view>
        </view>
      </view>

      <view class="card withdraw-list-card">
        <view class="section-title">提现记录</view>
        <view v-if="withdrawals.length === 0" class="empty-box">
          <view>💳</view>
          <view class="empty-text">暂无提现记录</view>
        </view>
        <view v-else class="withdraw-list">
          <view v-for="(item, idx) in withdrawals" :key="idx" class="withdraw-row">
            <view class="withdraw-info">
              <view class="withdraw-amount">{{ formatMoney(item.amount || 0) }}</view>
              <view class="muted small-text">
                申请时间：{{ formatDateTime(item.apply_time || item.created_at || item.createdAt) }}
              </view>
            </view>
            <view class="badge" :class="getWithdrawStatusInfo(item.status).class">
              {{ getWithdrawStatusInfo(item.status).label }}
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.earnings-top {
  background: linear-gradient(135deg, #2563eb 0%, #6366f1 50%, #8b5cf6 100%);
  color: #ffffff;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -60rpx;
    right: -60rpx;
    width: 240rpx;
    height: 240rpx;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 50%;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -80rpx;
    left: -40rpx;
    width: 200rpx;
    height: 200rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 50%;
  }
}

.light-title {
  color: rgba(255, 255, 255, 0.9);
  position: relative;
  z-index: 1;
}

.balance-number {
  margin-top: 16rpx;
  font-size: 72rpx;
  font-weight: 800;
  letter-spacing: -2rpx;
  position: relative;
  z-index: 1;
}

.top-meta-row {
  margin-top: 28rpx;
  position: relative;
  z-index: 1;
}

.meta-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;

  &.center-item {
    align-items: center;
  }

  &.right-item {
    align-items: flex-end;
  }
}

.meta-label {
  font-size: 22rpx;
  opacity: 0.8;
}

.meta-value {
  font-size: 28rpx;
  font-weight: 700;
}

.credit-score {
  font-size: 32rpx;
}

.frozen-value {
  opacity: 0.9;
}

.level-badge {
  border: 2rpx solid;
  font-weight: 600;
}

.progress-card {
  margin-top: 24rpx;
}

.progress-info {
  margin-top: 20rpx;
}

.progress-range-text {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 24rpx;
  color: #6b7280;
  margin-bottom: 16rpx;
}

.next-range {
  color: #2563eb;
}

.progress-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.progress-bar-bg {
  flex: 1;
  height: 20rpx;
  background: #f3f4f6;
  border-radius: 999rpx;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 999rpx;
  transition: width 0.4s ease;
}

.progress-percent {
  font-size: 26rpx;
  font-weight: 700;
  min-width: 80rpx;
  text-align: right;
}

.progress-hint {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #6b7280;

  &.max-level {
    color: #16a34a;
    font-weight: 600;
  }
}

.next-level-name {
  font-weight: 600;
}

.need-score {
  font-weight: 700;
}

.withdraw-card {
  margin-top: 24rpx;
}

.withdraw-input-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 24rpx;
  background: #f9fafb;
  border: 2rpx solid #e5e7eb;
  border-radius: 18rpx;
  padding: 0 24rpx;
}

.currency-symbol {
  font-size: 40rpx;
  font-weight: 700;
  color: #2563eb;
}

.withdraw-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 24rpx 0;
  font-size: 36rpx;
  font-weight: 700;
}

.all-in-btn {
  padding: 12rpx 20rpx;
  background: #eef2ff;
  color: #2563eb;
  border-radius: 12rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.withdraw-tips {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;
}

.balance-amount {
  color: #2563eb;
  font-weight: 600;
}

.submit-btn {
  margin-top: 24rpx;
}

.withdraw-desc {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

.levels-card {
  margin-top: 24rpx;
}

.levels-list {
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.level-item {
  border: 2rpx solid #e5e7eb;
  border-radius: 20rpx;
  padding: 20rpx;
  background: #fafafa;
  transition: all 0.2s ease;

  &.active {
    background: #ffffff;
  }
}

.level-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-bottom: 16rpx;
  border-bottom: 2rpx dashed #e5e7eb;
}

.level-name {
  font-size: 30rpx;
  font-weight: 800;
}

.level-score-range {
  flex: 1;
  font-size: 22rpx;
}

.current-tag {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 600;
}

.level-benefits {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  color: #374151;
}

.benefit-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.logs-card {
  margin-top: 24rpx;
}

.logs-page-info {
  font-size: 22rpx;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  margin: 0 auto 16rpx;
  animation: spin 0.8s linear infinite;

  &.small {
    width: 36rpx;
    height: 36rpx;
  }
}

.loading-text {
  color: #6b7280;
  font-size: 26rpx;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-text {
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 26rpx;
}

.logs-list {
  margin-top: 20rpx;
}

.log-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
}

.log-info {
  flex: 1;
  min-width: 0;
}

.log-remark {
  font-size: 26rpx;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-meta {
  margin-top: 8rpx;
}

.small-text {
  font-size: 22rpx;
}

.log-type-tag {
  padding: 4rpx 12rpx;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 8rpx;
  font-size: 20rpx;
}

.log-delta {
  font-size: 30rpx;
  font-weight: 800;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.logs-pagination {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid #f3f4f6;
}

.page-btn {
  height: 64rpx;
  min-width: 160rpx;
  font-size: 24rpx;
  padding: 0 24rpx;
}

.page-number {
  font-size: 24rpx;
}

.withdraw-list-card {
  margin-top: 24rpx;
}

.withdraw-list {
  margin-top: 20rpx;
}

.withdraw-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
}

.withdraw-info {
  flex: 1;
  min-width: 0;
}

.withdraw-amount {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.error-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.error-icon {
  font-size: 64rpx;
}

.error-text {
  color: #6b7280;
  font-size: 26rpx;
}

.retry-btn {
  margin-top: 16rpx;
  height: 72rpx;
  padding: 0 40rpx;
}

.disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
