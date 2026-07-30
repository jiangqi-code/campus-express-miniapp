<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { formatDateTime, formatMoney } from '@/utils/format'
import { http } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const isRunner = computed(() => auth.role === 'runner')
const loading = ref(false)
const summary = ref({ todayAmount: 0, weekAmount: 0, monthAmount: 0, totalAmount: 0 })
const trend = ref<any[]>([])
const earnings = ref<any[]>([])
const earningPage = ref(1)
const earningTotal = ref(0)
const pageSize = 10
const activeLog = ref<'earning' | 'credit'>('earning')
const creditLogs = ref<any[]>([])
const withdrawals = ref<any[]>([])
const withdrawPage = ref(1)
const withdrawTotal = ref(0)
const withdrawAmount = ref('')
const payoutAccount = ref('')
const withdrawSubmitting = ref(false)
const maxTrend = computed(() => Math.max(1, ...trend.value.map(item => Number(item.amount || 0))))
const earningPages = computed(() => Math.max(1, Math.ceil(earningTotal.value / pageSize)))
const withdrawPages = computed(() => Math.max(1, Math.ceil(withdrawTotal.value / pageSize)))
const cards = computed(() => [
  ['今日收益', summary.value.todayAmount], ['本周收益', summary.value.weekAmount],
  ['本月收益', summary.value.monthAmount], ['累计收益', summary.value.totalAmount],
])

async function loadDashboard(page = earningPage.value, append = false) {
  if (!isRunner.value) return
  loading.value = true
  try {
    const result: any = await http.get('/earning/dashboard', { page, pageSize, days: 7 })
    const root = result?.data ?? result
    summary.value = {
      todayAmount: Number(root?.summary?.todayAmount || 0), weekAmount: Number(root?.summary?.weekAmount || 0),
      monthAmount: Number(root?.summary?.monthAmount || 0), totalAmount: Number(root?.summary?.totalAmount || 0),
    }
    trend.value = root?.trend ?? []
    const items = root?.items ?? []
    earnings.value = append ? [...earnings.value, ...items] : items
    earningTotal.value = Number(root?.total || 0)
    earningPage.value = page
  } catch (error: any) { uni.showToast({ title: error?.message || '收益加载失败', icon: 'none' }) }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}

async function loadCreditLogs() {
  if (!isRunner.value || creditLogs.value.length) return
  const result: any = await http.get('/credit/logs', { page: 1, pageSize: 20 }).catch(() => ({}))
  const root = result?.data ?? result
  creditLogs.value = root?.items ?? root?.list ?? []
}

async function loadWithdrawals(page = withdrawPage.value, append = false) {
  if (!isRunner.value) return
  const result: any = await http.get('/withdraw/list', { page, pageSize }).catch(() => ({}))
  const root = result?.data ?? result
  const items = root?.items ?? root?.list ?? []
  withdrawals.value = append ? [...withdrawals.value, ...items] : items
  withdrawTotal.value = Number(root?.total || 0)
  withdrawPage.value = page
}

function switchLog(value: 'earning' | 'credit') {
  activeLog.value = value
  if (value === 'credit') loadCreditLogs()
}

async function submitWithdraw() {
  if (!isRunner.value || withdrawSubmitting.value) return
  const amount = Number(withdrawAmount.value)
  if (!Number.isFinite(amount) || amount < 1) return uni.showToast({ title: '提现金额不能少于1元', icon: 'none' })
  if (!payoutAccount.value.trim()) return uni.showToast({ title: '请输入到账账户', icon: 'none' })
  withdrawSubmitting.value = true
  try {
    await http.post('/withdraw/apply', { amount, payoutAccount: payoutAccount.value.trim() })
    uni.showToast({ title: '提现申请已提交', icon: 'success' })
    withdrawAmount.value = ''; payoutAccount.value = ''; await loadWithdrawals(1)
  } catch (error: any) { uni.showToast({ title: error?.message || '提现失败', icon: 'none' }) }
  finally { withdrawSubmitting.value = false }
}

onPullDownRefresh(() => { if (isRunner.value) Promise.all([loadDashboard(1), loadWithdrawals(1)]) ; else uni.stopPullDownRefresh() })
onReachBottom(() => {
  if (!isRunner.value || loading.value) return
  if (earningPage.value < earningPages.value) loadDashboard(earningPage.value + 1, true)
  if (withdrawPage.value < withdrawPages.value) loadWithdrawals(withdrawPage.value + 1, true)
})
onLoad(async () => {
  await auth.bootstrap()
  if (!isRunner.value) return
  await Promise.all([loadDashboard(1), loadWithdrawals(1)])
})
</script>

<template>
  <view class="page-shell earnings-page">
    <view v-if="!isRunner" class="card role-tip">您还不是跑腿员，暂无收益数据</view>
    <template v-else>
      <view class="summary-grid"><view v-for="card in cards" :key="card[0]" class="card summary-card"><text class="muted">{{ card[0] }}</text><text class="summary-value">{{ formatMoney(card[1]) }}</text></view></view>
      <view class="card section-card"><view class="section-title">近7日收入趋势</view><view class="trend-chart"><view v-for="item in trend" :key="item.date" class="trend-item"><text class="trend-value">{{ Number(item.amount).toFixed(0) }}</text><view class="trend-bar" :style="{ height: `${Math.max(4, Number(item.amount) / maxTrend * 150)}rpx` }" /><text class="trend-label">{{ item.date.slice(5) }}</text></view></view></view>
      <view class="card section-card"><view class="log-tabs"><view :class="{ active: activeLog === 'earning' }" @tap="switchLog('earning')">收益日志</view><view :class="{ active: activeLog === 'credit' }" @tap="switchLog('credit')">信用日志</view></view>
        <template v-if="activeLog === 'earning'"><view v-for="item in earnings" :key="item.id" class="log-row"><view class="log-main"><text>订单 #{{ item.orderId || '-' }}</text><text class="muted small">{{ item.pickupAddress || '-' }} → {{ item.deliveryAddress || '-' }}</text><text class="muted small">{{ formatDateTime(item.settledAt) }}</text></view><text class="income">收入 +{{ formatMoney(item.amount) }}</text></view><view v-if="!earnings.length" class="empty-box"><view class="empty-title">暂无收益明细</view><view class="empty-desc">完成跑腿订单后，收益会显示在这里</view></view><view v-else class="list-footer">{{ earningPage < earningPages ? '上拉加载更多' : '已加载全部收益' }}</view></template>
        <template v-else><view v-for="item in creditLogs" :key="item.id" class="log-row"><view><text>{{ item.remark || item.description || '信用变动' }}</text><text class="muted small">{{ formatDateTime(item.created_at || item.createdAt) }}</text></view><text :class="Number(item.delta) >= 0 ? 'income' : 'expense'">{{ Number(item.delta) >= 0 ? '+' : '' }}{{ item.delta }}</text></view><view v-if="!creditLogs.length" class="empty-box">暂无信用日志</view></template>
      </view>
      <view class="card section-card"><view class="section-title">申请提现</view><input v-model="payoutAccount" class="input" placeholder="到账账户（支付宝或银行卡）" /><input v-model="withdrawAmount" class="input" type="digit" placeholder="提现金额" /><view class="withdraw-info"><text>手续费：¥0.00（平台暂免）</text><text>预计到账：审核通过后1-3个工作日</text></view><view class="btn-primary" :class="{ disabled: withdrawSubmitting }" @tap="submitWithdraw">{{ withdrawSubmitting ? '提交中...' : '提交提现申请' }}</view></view>
      <view class="card section-card"><view class="section-title">提现记录</view><view v-for="item in withdrawals" :key="item.id" class="log-row"><view><text>{{ formatMoney(item.amount) }}</text><text class="muted small">{{ formatDateTime(item.apply_time || item.created_at) }}</text></view><text class="status-text">{{ item.status }}</text></view><view v-if="!withdrawals.length" class="empty-box"><view class="empty-title">暂无提现记录</view><view class="empty-desc">提交提现申请后可在这里跟踪状态</view></view><view v-else class="list-footer">{{ withdrawPage < withdrawPages ? '上拉加载更多' : '已加载全部记录' }}</view></view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.role-tip { margin-top: 80rpx; text-align: center; color: #2563eb; padding: 60rpx 24rpx; }.summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; }.summary-card { display: flex; flex-direction: column; gap: 12rpx; }.summary-value { font-size: 38rpx; font-weight: 700; }.section-card { margin-top: 24rpx; }.trend-chart { height: 220rpx; display: flex; align-items: flex-end; justify-content: space-around; margin-top: 28rpx; }.trend-item { height: 100%; flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 6rpx; }.trend-bar { width: 28rpx; border-radius: 8rpx 8rpx 0 0; background: #2563eb; }.trend-label,.trend-value,.small { font-size: 20rpx; }.log-tabs { display: flex; gap: 28rpx; border-bottom: 1rpx solid #e5e7eb; margin-bottom: 12rpx; }.log-tabs view { padding: 16rpx 4rpx; color: #6b7280; }.log-tabs .active { color: #2563eb; border-bottom: 4rpx solid #2563eb; }.log-row { display: flex; justify-content: space-between; gap: 20rpx; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }.log-main,.log-row>view { display: flex; flex-direction: column; gap: 6rpx; min-width: 0; }.income { color: #16a34a; font-weight: 700; }.expense { color: #dc2626; font-weight: 700; }.pager { display: flex; justify-content: center; align-items: center; gap: 20rpx; margin-top: 20rpx; }.pager button { margin: 0; font-size: 24rpx; }.input { margin: 18rpx 0; }.withdraw-info { display: flex; flex-direction: column; gap: 8rpx; color: #6b7280; font-size: 22rpx; margin-bottom: 20rpx; }.disabled { opacity: .55; pointer-events: none; }
</style>
