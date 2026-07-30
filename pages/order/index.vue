<template>
  <view class="order-page page-shell">
    <view class="order-tabs card">
      <view class="order-tab" :class="{ active: activeTab === 'published' }" @tap="activeTab = 'published'">
        <text class="tab-label">我的发布</text>
        <view v-if="publishedList.length > 0" class="tab-count">{{ publishedList.length }}</view>
        <view v-if="activeTab === 'published'" class="tab-underline" />
      </view>
      <view class="order-tab" :class="{ active: activeTab === 'taken' }" @tap="activeTab = 'taken'">
        <text class="tab-label">我的接单</text>
        <view v-if="takenList.length > 0" class="tab-count">{{ takenList.length }}</view>
        <view v-if="activeTab === 'taken'" class="tab-underline" />
      </view>
    </view>

    <scroll-view v-show="activeTab === 'published'" scroll-y class="order-scroll"
      refresher-enabled :refresher-triggered="pRefreshing" @refresherrefresh="loadPublished">
      <view v-if="pLoading && publishedList.length === 0" class="empty-box">加载中...</view>
      <view v-else-if="publishedList.length === 0" class="card empty-card">
        <text class="empty-icon">📦</text>
        <text class="empty-text">暂无发布的订单</text>
        <view class="go-btn" @tap="goPublish">去发布任务</view>
      </view>
      <view v-else class="order-list">
        <view v-for="item in publishedList" :key="getPid(item)" class="card order-card" @tap="goDetail(getPublishedTaskId(item))">
          <view class="card-header">
            <view class="status-tag" :class="statusPClass(item)">{{ statusPText(item) }}</view>
            <text class="publish-time">{{ fmtTime(item.created_at) }}</text>
          </view>
          <view class="address-section">
            <view class="address-row"><view class="adot green"></view><text class="addr-txt">{{ item.pickup_address || '暂无' }}</text></view>
            <view class="address-line"></view>
            <view class="address-row"><view class="adot red"></view><text class="addr-txt">{{ item.delivery_address || '暂无' }}</text></view>
          </view>
          <view class="card-footer"><text class="amount">¥{{ item.final_price || item.fee_total || '0.00' }}</text></view>
        </view>
      </view>
      <view class="list-bottom-space" />
    </scroll-view>

    <scroll-view v-show="activeTab === 'taken'" scroll-y class="order-scroll"
      refresher-enabled :refresher-triggered="tRefreshing" @refresherrefresh="loadTaken">
      <view v-if="tLoading && takenList.length === 0" class="empty-box">加载中...</view>
      <view v-else-if="takenList.length === 0" class="card empty-card">
        <text class="empty-icon">🛵</text>
        <text class="empty-text">暂无已接单订单</text>
        <view class="go-btn" @tap="goHall">去任务大厅抢单</view>
      </view>
      <view v-else class="order-list">
        <view v-for="item in takenList" :key="item.id" class="card order-card" @tap="goDetail(item.task_id || item.id)">
          <view class="row-between align-start">
            <view class="badge badge-default">{{ statusPText(item) }}</view>
            <view class="muted small-text">{{ fmtTime(item.created_at) }}</view>
          </view>
          <view class="address-section">
            <view class="address-row"><view class="adot green"></view><text class="addr-txt">{{ item.pickup_address || '-' }}</text></view>
            <view class="address-line"></view>
            <view class="address-row"><view class="adot red"></view><text class="addr-txt">{{ item.delivery_address || '-' }}</text></view>
          </view>
          <view class="card-footer">
            <text class="muted">收益</text>
            <text class="price-text">¥{{ item.final_price || item.fee_total || '0.00' }}</text>
          </view>
        </view>
      </view>
      <view class="list-bottom-space" />
    </scroll-view>

    <AppTabBar current="order" :unread-message-count="unreadCount" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/AppTabBar.vue'
import { useMessageStore } from '@/stores/message'
import { http } from '@/utils/request'

const messageStore = useMessageStore()
const unreadCount = computed(() => messageStore.unreadCount)
const activeTab = ref<'published' | 'taken'>('published')

const publishedList = ref<any[]>([])
const pLoading = ref(false)
const pRefreshing = ref(false)
const takenList = ref<any[]>([])
const tLoading = ref(false)
const tRefreshing = ref(false)

const STATUS_MAP: Record<string, string> = {
  PENDING: '待接单', ACCEPTED: '已接单', PICKED_UP: '已取件', DELIVERING: '配送中',
  COMPLETED: '已完成', CANCELLED: '已取消', CANCELED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款'
}
const normalizeStatus = (status: unknown) => {
  const s = String(status ?? '').toUpperCase()
  const map: Record<string, string> = {
    PICKING_UP: 'PICKED_UP',
    PICKUP: 'PICKED_UP',
    IN_DELIVERY: 'DELIVERING',
    DELIVERED: 'COMPLETED',
    DONE: 'COMPLETED',
    FINISHED: 'COMPLETED',
    CANCELED: 'CANCELLED',
  }
  return map[s] || s
}
const getPid = (i: any) => i.order_id || i.task_id || i.id || ''
const getPublishedTaskId = (i: any) => i.task_id || i.task?.id || i.id || ''
const statusPText = (i: any) => STATUS_MAP[i.status || ''] || '未知状态'
const statusPClass = (i: any) => {
  const s = i.status || ''
  if (s === 'PENDING') return 'st-pending'
  if (s === 'ACCEPTED') return 'st-accepted'
  if (s === 'PICKED_UP') return 'st-accepted'
  if (s === 'DELIVERING') return 'st-delivering'
  if (s === 'COMPLETED') return 'st-completed'
  return 'st-cancelled'
}
const fmtTime = (t?: string) => {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const goDetail = (id: any) => {
  if (!id) {
    uni.showToast({ title: '任务ID不存在', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/task/detail?id=${id}` })
}
const goPublish = () => uni.navigateTo({ url: '/pages/task/publish' })
const goHall = () => uni.reLaunch({ url: '/pages/task/hall' })

const parseOrderList = (res: any): any[] => {
  const data = res?.data ?? res
  const items = data?.list ?? data?.rows ?? data?.items ?? data?.orders ?? (Array.isArray(data) ? data : [])
  return Array.isArray(items) ? items : []
}

const normalizeOrderItem = (item: any) => ({
  ...item,
  id: String(item?.id ?? item?.order_id ?? item?.orderId ?? ''),
  order_id: String(item?.order_id ?? item?.orderId ?? item?.id ?? ''),
  task_id: String(item?.task_id ?? item?.taskId ?? item?.task?.id ?? ''),
  pickup_address: item?.pickup_address ?? item?.task?.pickup_address ?? '',
  delivery_address: item?.delivery_address ?? item?.task?.delivery_address ?? '',
  created_at: item?.created_at ?? item?.create_time ?? '',
  final_price: item?.final_price ?? item?.price ?? item?.fee_total ?? item?.amount ?? 0,
  status: normalizeStatus(item?.status ?? item?.task?.status),
})

const loadPublished = async () => {
  pLoading.value = true
  try {
    const res: any = await http.get('/order/list', { type: 'published', page: 1, pageSize: 100 })
    publishedList.value = parseOrderList(res).map(normalizeOrderItem)
  } catch {
    publishedList.value = []
  }
  finally { pLoading.value = false; pRefreshing.value = false }
}
const loadTaken = async () => {
  tLoading.value = true
  try {
    const res: any = await http.get('/order/list', { type: 'taken', page: 1, pageSize: 100 })
    takenList.value = parseOrderList(res).map(normalizeOrderItem)
  } catch {
    takenList.value = []
  }
  finally { tLoading.value = false; tRefreshing.value = false }
}

onShow(() => { loadPublished(); loadTaken() })
</script>

<style lang="scss" scoped>
.order-page { min-height: 100vh; padding-bottom: 160rpx; }
.order-tabs {
  display: flex; align-items: center; position: sticky; top: 0; z-index: 10;
  border-radius: 0; margin-bottom: 24rpx; padding: 0;
}
.order-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 28rpx 16rpx 20rpx; position: relative;
  &.active .tab-label { color: #165dff; font-weight: 700; font-size: 30rpx; }
}
.tab-label { font-size: 28rpx; color: #4e5969; }
.tab-count {
  position: absolute; top: 20rpx; margin-left: 84rpx;
  min-width: 32rpx; height: 32rpx; padding: 0 8rpx;
  background: #f53f3f; color: #fff; font-size: 20rpx;
  line-height: 32rpx; text-align: center; border-radius: 999rpx;
}
.tab-underline {
  position: absolute; bottom: 0; width: 64rpx; height: 6rpx;
  background: linear-gradient(90deg, #165dff, #4080ff); border-radius: 999rpx;
}
.order-scroll { height: calc(100vh - 280rpx); }
.list-bottom-space { height: 40rpx; }
.empty-card { text-align: center; padding: 100rpx 24rpx; margin: 24rpx; }
.empty-icon { font-size: 120rpx; display: block; margin-bottom: 24rpx; }
.empty-text { display: block; font-size: 28rpx; color: #86909c; margin-bottom: 32rpx; }
.go-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 72rpx; padding: 0 40rpx; font-size: 28rpx;
  background: linear-gradient(135deg, #165dff, #4080ff);
  color: #fff; border-radius: 16rpx; font-weight: 600;
}
.order-list { padding: 0 24rpx; }
.order-card { margin-bottom: 24rpx; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.status-tag { padding: 6rpx 20rpx; border-radius: 20rpx; font-size: 24rpx; font-weight: 500; }
.st-pending { background: #fff7e6; color: #fa8c16; }
.st-accepted { background: #e6f7ff; color: #1890ff; }
.st-delivering { background: #f6ffed; color: #52c41a; }
.st-completed { background: #f0f5ff; color: #2f54eb; }
.st-cancelled { background: #f5f5f5; color: #8c8c8c; }
.publish-time { font-size: 24rpx; color: #86909c; }
.address-section {
  background: #fafafa; border-radius: 12rpx;
  padding: 20rpx 24rpx; margin-bottom: 20rpx;
}
.address-row { display: flex; align-items: flex-start; }
.adot {
  width: 16rpx; height: 16rpx; border-radius: 50%;
  margin-top: 10rpx; margin-right: 16rpx; flex-shrink: 0;
}
.adot.green { background: #52c41a; }
.adot.red { background: #f5222d; }
.address-line { width: 2rpx; height: 24rpx; background: #d9d9d9; margin-left: 7rpx; margin: 10rpx 0; }
.addr-txt { flex: 1; font-size: 28rpx; color: #1f2937; line-height: 1.5; }
.card-footer { display: flex; align-items: center; justify-content: flex-end; }
.amount { font-size: 36rpx; font-weight: 700; color: #ff4d4f; }
.price-text { font-size: 34rpx; font-weight: 700; color: #00b42a; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.align-start { align-items: flex-start; }
.small-text { font-size: 22rpx; }
.muted { color: #86909c; }
.badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 6rpx 20rpx; border-radius: 999rpx; font-size: 24rpx; font-weight: 500;
  background: #eef2ff; color: #165dff;
}
.badge-default { background: #eef2ff; color: #165dff; }
</style>
