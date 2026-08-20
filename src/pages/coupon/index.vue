<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { http } from '@/utils/request'

type CouponStatus = 'UNUSED' | 'USED' | 'EXPIRED'

const tabs = [
  { key: 'UNUSED', label: '未使用' },
  { key: 'USED', label: '已使用' },
  { key: 'EXPIRED', label: '已过期' },
] as const
const tab = ref<CouponStatus>('UNUSED')
const rows = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const total = ref(0)
const pageSize = 15
let loadSequence = 0

const money = (value: unknown) => Number(value || 0).toFixed(2)
const valueText = (coupon: any) => coupon?.type === 'CASH'
  ? `¥${money(coupon.value)}`
  : `减${Number(coupon?.value || 0)}%`
const condition = (coupon: any) => Number(coupon?.min_order_amount) > 0
  ? `满 ¥${money(coupon.min_order_amount)} 可用`
  : '无门槛使用'
const statusText = (status: CouponStatus) => status === 'USED' ? '已使用' : status === 'EXPIRED' ? '已过期' : '可使用'
const hasMore = () => rows.value.length < total.value

async function load(reset = false) {
  if ((!reset && loading.value) || (!reset && !hasMore())) return
  const sequence = ++loadSequence
  loading.value = true
  const targetPage = reset ? 1 : page.value + 1
  try {
    const result = await http.get<any>('/coupons/my', {
      status: tab.value,
      page: targetPage,
      page_size: pageSize,
    })
    if (sequence !== loadSequence) return
    const payload = result?.data ?? result ?? {}
    const list = Array.isArray(payload?.list) ? payload.list : []
    rows.value = reset ? list : [...rows.value, ...list]
    page.value = targetPage
    total.value = Number(payload?.total ?? rows.value.length)
  } catch (error: any) {
    if (sequence !== loadSequence) return
    if (reset) rows.value = []
    uni.showToast({ title: error?.message || '优惠券加载失败', icon: 'none' })
  } finally {
    if (sequence === loadSequence) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function selectTab(next: CouponStatus) {
  if (tab.value === next) return
  tab.value = next
  rows.value = []
  total.value = 0
  page.value = 1
  void load(true)
}

function useCoupon() {
  uni.switchTab({ url: '/pages/task/publish' })
}

onShow(() => load(true))
onPullDownRefresh(() => load(true))
onReachBottom(() => load(false))
</script>
<template>
  <view class="coupon-page">
    <view class="page-head">
      <text class="page-title">我的优惠券</text>
      <text class="page-desc">发布任务时可抵扣配送费</text>
    </view>

    <view class="tabs">
      <view
        v-for="item in tabs"
        :key="item.key"
        class="tab"
        :class="{ active: tab === item.key }"
        @tap="selectTab(item.key)"
      >
        {{ item.label }}
      </view>
    </view>

    <view v-if="loading && !rows.length" class="state-box">正在加载优惠券...</view>
    <view v-else-if="!rows.length" class="state-box">
      <text class="state-title">暂无{{ tabs.find((item) => item.key === tab)?.label }}优惠券</text>
      <text class="state-desc">领取后的优惠券会显示在这里</text>
    </view>

    <view v-else class="coupon-list">
      <view
        v-for="item in rows"
        :key="item.id"
        class="coupon-card"
        :class="{ muted: item.status !== 'UNUSED' }"
      >
        <view class="coupon-value">
          <text>{{ valueText(item.coupon) }}</text>
          <text class="coupon-kind">{{ item.coupon?.type === 'CASH' ? '现金券' : '折扣券' }}</text>
        </view>
        <view class="coupon-info">
          <text class="coupon-name">{{ item.coupon?.name }}</text>
          <text class="coupon-rule">{{ condition(item.coupon) }}</text>
          <text class="coupon-date">有效期至 {{ new Date(item.expired_at).toLocaleDateString('zh-CN') }}</text>
        </view>
        <button v-if="item.status === 'UNUSED'" class="use-btn" @tap="useCoupon">去使用</button>
        <text v-else class="status">{{ statusText(item.status) }}</text>
      </view>
      <view class="list-footer">{{ loading ? '加载中...' : hasMore() ? '上拉加载更多' : '已加载全部优惠券' }}</view>
    </view>
  </view>
</template>

<style scoped>
.coupon-page{min-height:100vh;padding:28rpx 24rpx 60rpx;background:#f6f9f3;box-sizing:border-box;color:#293630}
.page-head{display:flex;padding:8rpx 4rpx 24rpx;flex-direction:column;gap:8rpx}
.page-title{font-size:40rpx;font-weight:800}
.page-desc{color:#718077;font-size:24rpx}
.tabs{position:sticky;z-index:10;top:0;display:grid;width:100%;min-width:0;grid-template-columns:repeat(3,minmax(0,1fr));padding:8rpx;margin-bottom:24rpx;overflow:hidden;border:2rpx solid #e4eee0;border-radius:16rpx;background:rgba(255,255,255,.96);box-sizing:border-box}
.tab{display:flex;min-width:0;height:68rpx;align-items:center;justify-content:center;border-radius:12rpx;color:#758078;font-size:25rpx;white-space:nowrap}
.tab.active{background:#edf8e9;color:#389e0d;font-weight:700}
.coupon-list{display:flex;flex-direction:column;gap:20rpx}
.coupon-card{position:relative;display:grid;min-height:176rpx;padding:26rpx 22rpx;grid-template-columns:154rpx minmax(0,1fr) auto;align-items:center;gap:20rpx;overflow:hidden;border:2rpx solid #dfeedd;border-radius:16rpx;background:#fff;box-sizing:border-box}
.coupon-card:before,.coupon-card:after{position:absolute;left:142rpx;width:24rpx;height:24rpx;border:2rpx solid #dfeedd;border-radius:50%;background:#f6f9f3;content:''}
.coupon-card:before{top:-15rpx}.coupon-card:after{bottom:-15rpx}
.coupon-value{display:flex;min-width:0;align-items:center;flex-direction:column;color:#389e0d;text-align:center}
.coupon-value>text:first-child{font-size:38rpx;font-weight:800;line-height:1.1}
.coupon-kind{margin-top:10rpx;color:#79a56e;font-size:20rpx}
.coupon-info{display:flex;min-width:0;padding-left:20rpx;flex-direction:column;gap:8rpx;border-left:2rpx dashed #cde7c7}
.coupon-name{overflow:hidden;color:#293630;font-size:28rpx;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.coupon-rule,.coupon-date{color:#748078;font-size:22rpx}
.use-btn{display:flex;height:60rpx;padding:0 22rpx;align-items:center;justify-content:center;border:0;border-radius:30rpx;background:#52c41a;color:#fff;font-size:23rpx;font-weight:700;line-height:60rpx}
.use-btn:after{border:0}
.status{color:#7d8781;font-size:23rpx;font-weight:600}
.muted{border-color:#e5e8e5;background:#f7f8f7;filter:grayscale(.7);opacity:.76}
.state-box{display:flex;min-height:300rpx;padding:40rpx;align-items:center;justify-content:center;flex-direction:column;gap:12rpx;border:2rpx dashed #d9e5d5;border-radius:16rpx;background:#fff;color:#7a867e;text-align:center}
.state-title{color:#435048;font-size:27rpx;font-weight:700}
.state-desc{font-size:23rpx}
.list-footer{padding:24rpx 0;color:#8b968f;font-size:22rpx;text-align:center}
@media screen and (max-width:375px){.coupon-card{grid-template-columns:126rpx minmax(0,1fr)}.coupon-card:before,.coupon-card:after{left:116rpx}.use-btn,.status{grid-column:2;justify-self:start}}
</style>
