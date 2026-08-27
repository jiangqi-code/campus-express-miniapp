<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import type { FoodOrder } from '@/types/models'
import { formatMoney } from '@/utils/format'
import { http } from '@/utils/request'

const authStore = useAuthStore()
const orders = ref<FoodOrder[]>([])
const loading = ref(false)
const runnerMode = ref(false)
const runnerTab = ref<'available' | 'mine'>('available')

const pageTitle = computed(() => runnerMode.value ? (runnerTab.value === 'available' ? '待配送订单' : '我的配送') : '我的外卖订单')

function unwrap(result: any) { return result?.data ?? result ?? {} }
function statusText(status: FoodOrder['status']) {
  const map: Record<FoodOrder['status'], string> = { PENDING_PAYMENT: '待支付', PAID: '待接单', ACCEPTED: '配送员已接单', PICKED: '已取餐', DELIVERING: '配送中', COMPLETED: '已完成', CANCELLED: '已取消' }
  return map[status] || status
}
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }

async function loadOrders() {
  loading.value = true
  try {
    const endpoint = runnerMode.value ? '/food/runner/orders' : '/food/orders/my'
    const params = runnerMode.value ? { available: runnerTab.value === 'available' ? 1 : undefined, page_size: 30 } : { page_size: 30 }
    const data = unwrap(await http.get<any>(endpoint, params))
    orders.value = Array.isArray(data.list) ? data.list : []
  } catch (error: any) {
    uni.showToast({ title: error?.message || '订单加载失败', icon: 'none' })
  } finally { loading.value = false; uni.stopPullDownRefresh() }
}

async function pay(order: FoodOrder) {
  try {
    await http.post(`/food/orders/${order.id}/pay`)
    uni.showToast({ title: '支付成功，等待配送', icon: 'success' })
    await loadOrders()
  } catch (error: any) { uni.showToast({ title: error?.message || '支付失败', icon: 'none' }) }
}

async function cancel(order: FoodOrder) {
  const result = await new Promise<UniApp.ShowModalRes>((resolve) => uni.showModal({ title: '取消订单', content: order.status === 'PAID' ? '取消后将原路退回钱包余额。' : '确定取消这个待支付订单吗？', confirmColor: '#c64141', success: resolve }))
  if (!result.confirm) return
  try {
    await http.post(`/food/orders/${order.id}/cancel`, { reason: '用户主动取消' })
    uni.showToast({ title: '订单已取消', icon: 'success' })
    await loadOrders()
  } catch (error: any) { uni.showToast({ title: error?.message || '取消失败', icon: 'none' }) }
}

async function accept(order: FoodOrder) {
  try {
    await http.post(`/food/runner/orders/${order.id}/accept`)
    uni.showToast({ title: '接单成功', icon: 'success' })
    await loadOrders()
  } catch (error: any) { uni.showToast({ title: error?.message || '接单失败', icon: 'none' }) }
}

async function updateDelivery(order: FoodOrder, action: 'pickup' | 'deliver' | 'complete') {
  try {
    await http.post(`/food/runner/orders/${order.id}/status`, { action })
    const copy = action === 'pickup' ? '已确认取餐' : action === 'deliver' ? '已开始配送' : '订单已完成，配送费已入账'
    uni.showToast({ title: copy, icon: 'success' })
    await loadOrders()
  } catch (error: any) { uni.showToast({ title: error?.message || '操作失败', icon: 'none' }) }
}

onLoad(async (options) => {
  await authStore.bootstrap()
  runnerMode.value = options?.mode === 'runner' && authStore.role === 'runner'
  await loadOrders()
})
onPullDownRefresh(() => { void loadOrders() })
</script>

<template>
  <view class="page-shell food-orders-page">
    <view class="orders-header"><view><text class="header-kicker">CAMPUS FOOD</text><view class="header-title">{{ pageTitle }}</view></view><view class="refresh-link" @tap="loadOrders">刷新</view></view>
    <view v-if="runnerMode" class="runner-tabs"><view :class="{ active: runnerTab === 'available' }" @tap="runnerTab = 'available'; loadOrders()">待配送</view><view :class="{ active: runnerTab === 'mine' }" @tap="runnerTab = 'mine'; loadOrders()">我的配送</view></view>
    <view v-if="!loading && orders.length === 0" class="empty-card"><text>◒</text><view>{{ runnerMode ? '这里暂时没有匹配的配送订单' : '还没有外卖订单' }}</view><view class="empty-copy">{{ runnerMode ? '刷新一下，新的配送单会实时出现。' : '去校园外卖看看今天吃什么。' }}</view></view>
    <view v-else class="orders-list"><view v-for="order in orders" :key="order.id" class="order-card"><view class="order-top"><view><view class="merchant-name">{{ order.merchant?.name || '校园商家' }}</view><view class="order-time">订单 #{{ order.id }} · {{ formatTime(order.created_at) }}</view></view><view class="status-badge" :class="`status-${order.status.toLowerCase()}`">{{ statusText(order.status) }}</view></view><view class="items-line">{{ order.items.map((item) => `${item.item_name} ×${item.quantity}`).join('、') }}</view><view class="order-info"><text>送至：{{ order.delivery_address }}</text><text v-if="runnerMode && order.user?.phone">联系：{{ order.user.phone }}</text><text v-if="order.remark">备注：{{ order.remark }}</text></view><view class="order-bottom"><view><text class="amount-label">实付</text><text class="amount">{{ formatMoney(order.total_amount) }}</text><text v-if="runnerMode" class="reward">配送费 {{ formatMoney(order.delivery_fee) }}</text></view><view class="actions"><view v-if="!runnerMode && order.status === 'PENDING_PAYMENT'" class="primary-button" @tap="pay(order)">去支付</view><view v-if="!runnerMode && (order.status === 'PENDING_PAYMENT' || order.status === 'PAID')" class="ghost-button" @tap="cancel(order)">取消</view><view v-if="runnerMode && runnerTab === 'available'" class="primary-button" @tap="accept(order)">接配送单</view><view v-if="runnerMode && runnerTab === 'mine' && order.status === 'ACCEPTED'" class="primary-button" @tap="updateDelivery(order, 'pickup')">确认取餐</view><view v-if="runnerMode && runnerTab === 'mine' && order.status === 'PICKED'" class="primary-button" @tap="updateDelivery(order, 'deliver')">开始配送</view><view v-if="runnerMode && runnerTab === 'mine' && order.status === 'DELIVERING'" class="primary-button" @tap="updateDelivery(order, 'complete')">确认送达</view></view></view></view></view>
  </view>
</template>

<style lang="scss" scoped>
.food-orders-page { padding-top: 20rpx; }.orders-header, .order-top, .order-bottom { display: flex; align-items: center; justify-content: space-between; }.header-kicker { color: #38805c; font-size: 20rpx; font-weight: 850; letter-spacing: .12em; }.header-title { margin-top: 9rpx; color: #214533; font-size: 40rpx; font-weight: 800; }.refresh-link { border-radius: 999rpx; padding: 10rpx 17rpx; background: #e8f5ec; color: #28704e; font-size: 23rpx; font-weight: 700; }.runner-tabs { display: flex; gap: 10rpx; margin: 22rpx 0; }.runner-tabs view { border: 2rpx solid #d9e7de; border-radius: 999rpx; padding: 12rpx 22rpx; color: #729080; font-size: 24rpx; font-weight: 700; }.runner-tabs view.active { border-color: #2d7956; background: #eaf6ee; color: #27714e; }.orders-list { display: grid; gap: 18rpx; margin-top: 22rpx; }.order-card { border: 2rpx solid #dfeae4; border-radius: 23rpx; padding: 22rpx; background: #fff; }.merchant-name { color: #284a37; font-size: 29rpx; font-weight: 800; }.order-time { margin-top: 6rpx; color: #9aa9a0; font-size: 20rpx; }.status-badge { border-radius: 999rpx; padding: 8rpx 12rpx; font-size: 21rpx; font-weight: 750; }.status-pending_payment { background: #fff2dc; color: #a16a16; }.status-paid, .status-accepted, .status-picked, .status-delivering { background: #e6f5ec; color: #27754f; }.status-completed { background: #edf1f3; color: #62767d; }.status-cancelled { background: #fbe9e9; color: #b43e3e; }.items-line { margin-top: 18rpx; overflow: hidden; color: #405f4e; font-size: 26rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }.order-info { display: grid; gap: 6rpx; margin-top: 14rpx; color: #82958a; font-size: 22rpx; line-height: 1.45; }.order-bottom { gap: 12rpx; margin-top: 19rpx; padding-top: 17rpx; border-top: 2rpx solid #edf2ef; }.amount-label { margin-right: 7rpx; color: #82948a; font-size: 20rpx; }.amount { color: #d8542d; font-size: 30rpx; font-weight: 850; }.reward { display: block; margin-top: 3rpx; color: #51826a; font-size: 20rpx; }.actions { display: flex; gap: 10rpx; }.primary-button, .ghost-button { display: flex; min-height: 58rpx; align-items: center; justify-content: center; border-radius: 13rpx; padding: 0 16rpx; font-size: 22rpx; font-weight: 750; }.primary-button { background: #2e7d59; color: #fff; }.ghost-button { background: #f2f5f3; color: #74877c; }.empty-card { margin-top: 30rpx; padding: 90rpx 20rpx; border: 2rpx dashed #ccddd2; border-radius: 24rpx; background: #fff; color: #6c8476; font-size: 29rpx; text-align: center; }.empty-card text { display: block; margin-bottom: 14rpx; color: #8dbc9f; font-size: 74rpx; }.empty-copy { margin-top: 8rpx; color: #96a89d; font-size: 23rpx; }
</style>
