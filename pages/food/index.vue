<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import AppTabBar from '@/components/AppTabBar.vue'
import { useAuthStore } from '@/stores/auth'
import type { Merchant } from '@/types/models'
import { toAbsoluteFileUrl } from '@/utils/format'
import { http } from '@/utils/request'

const authStore = useAuthStore()
const merchants = ref<Merchant[]>([])
const keyword = ref('')
const loading = ref(false)
const page = ref(1)
const total = ref(0)
const pageSize = 10

const hasMore = computed(() => merchants.value.length < total.value)

function unwrap(result: any) { return result?.data ?? result ?? {} }

async function loadMerchants(reset = true) {
  if (loading.value) return
  loading.value = true
  const target = reset ? 1 : page.value + 1
  try {
    const data = unwrap(await http.get<any>('/food/merchants', { page: target, page_size: pageSize, keyword: keyword.value.trim() || undefined }))
    const list = Array.isArray(data.list) ? data.list : []
    merchants.value = reset ? list : [...merchants.value, ...list]
    page.value = Number(data.page || target)
    total.value = Number(data.total || merchants.value.length)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '商家加载失败', icon: 'none' })
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openMerchant(merchant: Merchant) {
  uni.navigateTo({ url: `/pages/food/menu?id=${merchant.id}` })
}

function goOrders(mode = '') {
  uni.navigateTo({ url: `/pages/food/orders${mode ? `?mode=${mode}` : ''}` })
}

onLoad(async () => {
  await authStore.bootstrap()
  await loadMerchants()
})

onPullDownRefresh(() => { void loadMerchants() })
onReachBottom(() => { if (hasMore.value) void loadMerchants(false) })
</script>

<template>
  <view class="page-shell food-page">
    <view class="food-hero">
      <view><text class="hero-kicker">CAMPUS FOOD</text><view class="hero-title">今天想吃点什么？</view><view class="hero-copy">食堂档口和校园周边商家，为你送到宿舍楼下。</view></view>
      <view class="orders-link" @tap="goOrders">订单</view>
    </view>
    <view class="search-row"><input v-model="keyword" class="search-input" confirm-type="search" placeholder="搜索商家或位置" @confirm="loadMerchants()" /><view class="search-button" @tap="loadMerchants()">搜索</view></view>
    <view v-if="authStore.role === 'runner'" class="runner-banner" @tap="goOrders('runner')"><text>配送大厅</text><text>查看待配送订单 →</text></view>
    <view v-if="!loading && merchants.length === 0" class="empty-card"><text class="empty-symbol">◒</text><view class="empty-title">暂时没有营业中的商家</view><view class="empty-copy">商家审核通过并开业后会展示在这里。</view></view>
    <view v-else class="merchant-list">
      <view v-for="merchant in merchants" :key="merchant.id" class="merchant-card" @tap="openMerchant(merchant)">
        <image v-if="merchant.logo" class="merchant-logo" :src="toAbsoluteFileUrl(merchant.logo)" mode="aspectFill" />
        <view v-else class="merchant-logo logo-placeholder">{{ merchant.name.slice(0, 1) }}</view>
        <view class="merchant-main"><view class="merchant-name">{{ merchant.name }}</view><view class="merchant-description">{{ merchant.description || merchant.address }}</view><view class="merchant-meta"><text>{{ merchant.address }}</text><text>{{ merchant.menu_item_count || 0 }} 道菜品</text></view></view>
        <view class="merchant-arrow">›</view>
      </view>
      <view class="load-more">{{ loading ? '正在加载…' : hasMore ? '上拉加载更多' : merchants.length ? '已经到底了' : '' }}</view>
    </view>
    <AppTabBar current="food" />
  </view>
</template>

<style lang="scss" scoped>
.food-page { padding-top: 20rpx; }.food-hero { display: flex; justify-content: space-between; gap: 18rpx; padding: 30rpx; border-radius: 28rpx; background: #1e4a39; color: #fff; }.hero-kicker { color: #b4decb; font-size: 20rpx; font-weight: 800; letter-spacing: .12em; }.hero-title { margin-top: 10rpx; font-size: 42rpx; font-weight: 800; letter-spacing: -.04em; }.hero-copy { margin-top: 10rpx; color: #d4eee1; font-size: 24rpx; line-height: 1.5; }.orders-link { display: flex; align-self: flex-start; min-height: 54rpx; align-items: center; border: 2rpx solid rgba(255,255,255,.32); border-radius: 999rpx; padding: 0 18rpx; color: #fff; font-size: 23rpx; font-weight: 700; }.search-row { display: flex; gap: 12rpx; margin: 22rpx 0; }.search-input { height: 76rpx; flex: 1; border-radius: 16rpx; padding: 0 20rpx; background: #fff; color: #304c40; font-size: 26rpx; }.search-button { display: flex; min-width: 112rpx; height: 76rpx; align-items: center; justify-content: center; border-radius: 16rpx; background: #2f7d5b; color: #fff; font-size: 25rpx; font-weight: 700; }.runner-banner { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; border: 2rpx solid #c6e5d3; border-radius: 18rpx; padding: 18rpx 20rpx; background: #edf9f2; color: #246545; font-size: 24rpx; font-weight: 700; }.merchant-list { display: grid; gap: 16rpx; }.merchant-card { display: flex; align-items: center; gap: 18rpx; border: 2rpx solid #e1eae5; border-radius: 24rpx; padding: 20rpx; background: #fff; box-shadow: 0 8rpx 20rpx rgba(30, 70, 49, .045); }.merchant-card:active { border-color: #94cbae; }.merchant-logo { width: 112rpx; height: 112rpx; flex: 0 0 112rpx; border-radius: 19rpx; background: #eaf1ed; }.logo-placeholder { display: flex; align-items: center; justify-content: center; background: #d9eee2; color: #2e7555; font-size: 42rpx; font-weight: 800; }.merchant-main { min-width: 0; flex: 1; }.merchant-name { overflow: hidden; color: #203c31; font-size: 30rpx; font-weight: 780; text-overflow: ellipsis; white-space: nowrap; }.merchant-description { overflow: hidden; margin-top: 8rpx; color: #748b80; font-size: 23rpx; text-overflow: ellipsis; white-space: nowrap; }.merchant-meta { display: flex; gap: 12rpx; margin-top: 13rpx; color: #9baaa2; font-size: 20rpx; }.merchant-arrow { color: #75a38d; font-size: 42rpx; }.empty-card { padding: 92rpx 30rpx; border: 2rpx dashed #cdded4; border-radius: 24rpx; background: #fff; text-align: center; }.empty-symbol { color: #8fbea5; font-size: 80rpx; }.empty-title { margin-top: 14rpx; color: #355847; font-size: 30rpx; font-weight: 780; }.empty-copy { margin-top: 8rpx; color: #809387; font-size: 24rpx; }.load-more { padding: 18rpx; color: #91a298; font-size: 23rpx; text-align: center; }
</style>
