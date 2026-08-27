<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import type { MenuItem, Merchant } from '@/types/models'
import { formatMoney, toAbsoluteFileUrl } from '@/utils/format'
import { http } from '@/utils/request'

const merchantId = ref(0)
const merchant = ref<Merchant | null>(null)
const items = ref<MenuItem[]>([])
const cart = reactive<Record<number, number>>({})
const deliveryFee = ref(0)
const loading = ref(true)
const submitting = ref(false)
const form = reactive({ address: '', phone: '', remark: '' })

const cartItems = computed(() => items.value.filter((item) => (cart[item.id] || 0) > 0))
const itemAmount = computed(() => cartItems.value.reduce((sum, item) => sum + Number(item.price) * (cart[item.id] || 0), 0))
const totalAmount = computed(() => itemAmount.value + deliveryFee.value)
const cartCount = computed(() => cartItems.value.reduce((sum, item) => sum + (cart[item.id] || 0), 0))

function unwrap(result: any) { return result?.data ?? result ?? {} }

async function loadDetail() {
  loading.value = true
  try {
    const [detailResult, settingsResult] = await Promise.all([http.get<any>(`/food/merchants/${merchantId.value}`), http.get<any>('/food/settings')])
    const detail = unwrap(detailResult)
    const settings = unwrap(settingsResult)
    merchant.value = detail.merchant || null
    items.value = Array.isArray(detail.menu_items) ? detail.menu_items : []
    deliveryFee.value = Number(settings.food_delivery_fee || 0)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '菜单加载失败', icon: 'none' })
  } finally { loading.value = false }
}

function adjust(item: MenuItem, delta: number) {
  const next = Math.max(0, (cart[item.id] || 0) + delta)
  if (item.stock >= 0 && next > item.stock) return uni.showToast({ title: '库存不足', icon: 'none' })
  cart[item.id] = next
}

async function placeOrder() {
  if (!cartItems.value.length) return uni.showToast({ title: '请先选择菜品', icon: 'none' })
  if (!form.address.trim()) return uni.showToast({ title: '请填写配送地址', icon: 'none' })
  if (submitting.value) return
  submitting.value = true
  try {
    const created = unwrap(await http.post<any>('/food/orders', {
      merchant_id: merchantId.value,
      items: cartItems.value.map((item) => ({ menu_item_id: item.id, quantity: cart[item.id] })),
      delivery_address: form.address.trim(),
      contact_phone: form.phone.trim() || undefined,
      remark: form.remark.trim() || undefined,
    }))
    const order = created.order
    const confirm = await new Promise<UniApp.ShowModalRes>((resolve) => uni.showModal({ title: '确认钱包支付', content: `合计 ${formatMoney(order?.total_amount || totalAmount.value)}，支付后将等待配送员接单。`, confirmText: '立即支付', success: resolve }))
    if (confirm.confirm) {
      await http.post(`/food/orders/${order.id}/pay`)
      uni.showToast({ title: '支付成功，等待配送', icon: 'success' })
    } else {
      uni.showToast({ title: '订单已生成，可在订单页继续支付', icon: 'none' })
    }
    setTimeout(() => uni.redirectTo({ url: '/pages/food/orders' }), 700)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '下单失败', icon: 'none', duration: 2600 })
  } finally { submitting.value = false }
}

onLoad((options) => { merchantId.value = Number(options?.id || 0); void loadDetail() })
</script>

<template>
  <view class="page-shell menu-page">
    <view v-if="loading" class="loading-card"><view /><view /><view /></view>
    <template v-else-if="merchant">
      <view class="merchant-header"><image v-if="merchant.logo" class="merchant-logo" :src="toAbsoluteFileUrl(merchant.logo)" mode="aspectFill" /><view v-else class="merchant-logo logo-placeholder">{{ merchant.name.slice(0, 1) }}</view><view class="merchant-copy"><view class="merchant-name">{{ merchant.name }}</view><view class="merchant-description">{{ merchant.description || merchant.address }}</view><view class="merchant-address">⌖ {{ merchant.address }}</view></view></view>
      <view class="menu-label">今日菜单</view>
      <view v-if="items.length === 0" class="empty-menu">商家正在整理菜单，请稍后再来。</view>
      <view v-else class="menu-list"><view v-for="item in items" :key="item.id" class="menu-item"><image v-if="item.image" class="item-image" :src="toAbsoluteFileUrl(item.image)" mode="aspectFill" /><view v-else class="item-image item-placeholder">◒</view><view class="item-main"><view class="item-name">{{ item.name }}</view><view class="item-description">{{ item.description || '新鲜制作，按时配送' }}</view><view class="item-bottom"><text class="item-price">{{ formatMoney(item.price) }}</text><text v-if="item.stock >= 0" class="item-stock">余 {{ item.stock }}</text></view></view><view class="stepper"><view class="stepper-button" :class="{ muted: !cart[item.id] }" @tap="adjust(item, -1)">−</view><text v-if="cart[item.id]" class="quantity">{{ cart[item.id] }}</text><view class="stepper-button plus" @tap="adjust(item, 1)">＋</view></view></view></view>
      <view class="delivery-card"><view class="field-label">配送信息</view><input v-model="form.address" class="delivery-input" maxlength="180" placeholder="送到哪里？例如：3 栋 512 宿舍" /><input v-model="form.phone" class="delivery-input" maxlength="30" placeholder="联系电话（选填）" /><input v-model="form.remark" class="delivery-input last" maxlength="500" placeholder="口味、取餐备注（选填）" /></view>
    </template>
    <view v-if="merchant" class="cart-bar"><view class="cart-summary"><text class="cart-count">{{ cartCount }} 件</text><view><text class="total-price">{{ formatMoney(totalAmount) }}</text><text class="fee-text">含配送费 {{ formatMoney(deliveryFee) }}</text></view></view><view class="pay-button" :class="{ disabled: !cartCount || submitting }" @tap="placeOrder">{{ submitting ? '提交中…' : '去支付' }}</view></view>
  </view>
</template>

<style lang="scss" scoped>
.menu-page { padding-top: 22rpx; padding-bottom: 160rpx; }.loading-card { display: grid; gap: 18rpx; padding: 30rpx; border-radius: 24rpx; background: #fff; }.loading-card view { height: 34rpx; border-radius: 99rpx; background: #edf2ef; }.loading-card view:nth-child(2) { width: 80%; }.loading-card view:nth-child(3) { width: 55%; }.merchant-header { display: flex; gap: 18rpx; padding: 24rpx 0 26rpx; border-bottom: 2rpx solid #e1eae4; }.merchant-logo { width: 118rpx; height: 118rpx; flex: 0 0 118rpx; border-radius: 21rpx; background: #e9f1ed; }.logo-placeholder { display: flex; align-items: center; justify-content: center; background: #d8ede1; color: #287250; font-size: 44rpx; font-weight: 800; }.merchant-copy { min-width: 0; flex: 1; }.merchant-name { overflow: hidden; color: #1f3d30; font-size: 34rpx; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }.merchant-description { overflow: hidden; margin-top: 9rpx; color: #70877c; font-size: 23rpx; text-overflow: ellipsis; white-space: nowrap; }.merchant-address { margin-top: 13rpx; color: #8ba096; font-size: 21rpx; }.menu-label { margin: 28rpx 0 16rpx; color: #244937; font-size: 31rpx; font-weight: 800; }.menu-list { display: grid; gap: 18rpx; }.menu-item { display: flex; align-items: center; gap: 16rpx; border-bottom: 2rpx solid #edf2ee; padding-bottom: 18rpx; }.item-image { width: 128rpx; height: 128rpx; flex: 0 0 128rpx; border-radius: 18rpx; background: #edf2ef; }.item-placeholder { display: flex; align-items: center; justify-content: center; color: #8ebb9f; font-size: 44rpx; }.item-main { min-width: 0; flex: 1; }.item-name { color: #264636; font-size: 29rpx; font-weight: 760; }.item-description { display: -webkit-box; margin-top: 7rpx; overflow: hidden; color: #83958c; font-size: 22rpx; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.item-bottom { display: flex; align-items: center; gap: 12rpx; margin-top: 13rpx; }.item-price { color: #d35631; font-size: 27rpx; font-weight: 800; }.item-stock { color: #9aa89f; font-size: 20rpx; }.stepper { display: flex; align-items: center; gap: 8rpx; align-self: flex-end; }.stepper-button { display: flex; width: 46rpx; height: 46rpx; align-items: center; justify-content: center; border-radius: 50%; background: #2d7c58; color: #fff; font-size: 30rpx; font-weight: 500; }.stepper-button.muted { background: #e5ece8; color: #90a299; }.stepper-button.plus { background: #2f7d5b; }.quantity { min-width: 28rpx; color: #315a46; font-size: 25rpx; text-align: center; }.delivery-card { margin-top: 26rpx; border: 2rpx solid #dce9e1; border-radius: 22rpx; padding: 22rpx; background: #fff; }.field-label { margin-bottom: 12rpx; color: #315846; font-size: 26rpx; font-weight: 750; }.delivery-input { height: 76rpx; border-bottom: 2rpx solid #edf1ee; color: #365a49; font-size: 24rpx; }.delivery-input.last { border-bottom: 0; }.empty-menu { padding: 70rpx 20rpx; color: #87998f; font-size: 25rpx; text-align: center; }.cart-bar { position: fixed; z-index: 20; right: 0; bottom: 0; left: 0; display: flex; align-items: center; gap: 16rpx; border-top: 2rpx solid #dce7df; padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); background: #fff; }.cart-summary { display: flex; align-items: center; gap: 14rpx; min-width: 0; flex: 1; }.cart-count { display: flex; min-width: 68rpx; height: 68rpx; align-items: center; justify-content: center; border-radius: 18rpx; background: #e2f1e8; color: #28704f; font-size: 23rpx; font-weight: 800; }.total-price { display: block; color: #d64e27; font-size: 31rpx; font-weight: 850; }.fee-text { display: block; margin-top: 1rpx; color: #91a199; font-size: 19rpx; }.pay-button { display: flex; min-width: 148rpx; height: 76rpx; align-items: center; justify-content: center; border-radius: 17rpx; background: #2f7d5b; color: #fff; font-size: 27rpx; font-weight: 800; }.pay-button.disabled { opacity: .55; pointer-events: none; }
</style>
