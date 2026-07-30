<template>
  <view class="published-page">
    <scroll-view
      scroll-y
      class="order-scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view v-if="loading && list.length === 0" class="loading-wrap">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="list.length === 0" class="empty-wrap">
        <text class="empty-icon">📦</text>
        <text class="empty-text">暂无发布的订单</text>
      </view>

      <view v-else class="order-list">
        <view
          v-for="item in list"
          :key="getItemId(item)"
          class="order-card"
        >
          <view class="card-header">
            <view class="status-tag" :class="getStatusClass(item)">
              {{ getStatusText(item) }}
            </view>
            <text class="publish-time">{{ formatTime(item.created_at || item.create_time) }}</text>
          </view>

          <view class="address-section">
            <view class="address-row">
              <view class="address-dot pickup-dot"></view>
              <text class="address-text">{{ getPickupAddress(item) }}</text>
            </view>
            <view class="address-line"></view>
            <view class="address-row">
              <view class="address-dot delivery-dot"></view>
              <text class="address-text">{{ getDeliveryAddress(item) }}</text>
            </view>
          </view>

          <view class="card-footer">
            <text class="amount">¥{{ getPrice(item) }}</text>
          </view>

          <view class="action-grid">
            <view class="action-col">
              <button
                class="action-btn outline-btn"
                size="mini"
                @tap="goDetail(item)"
              >
                详情
              </button>
            </view>
            <view class="action-col">
              <button
                class="action-btn outline-btn"
                size="mini"
                :disabled="!canContact(item)"
                @tap="contactRunner(item)"
              >
                联系跑腿
              </button>
            </view>
            <view class="action-col">
              <button
                v-if="canUrge(item)"
                class="action-btn primary-btn"
                size="mini"
                @tap="handleUrge(item)"
              >
                催单
              </button>
              <button
                v-else-if="canCancel(item)"
                class="action-btn danger-btn"
                size="mini"
                @tap="handleCancel(item)"
              >
                取消
              </button>
              <button
                v-else-if="canConfirm(item)"
                class="action-btn primary-btn"
                size="mini"
                @tap="handleConfirm(item)"
              >
                确认完成
              </button>
              <button
                v-else-if="canApplyRefund(item)"
                class="action-btn warn-btn"
                size="mini"
                @tap="openRefundModal(item)"
              >
                申请退款
              </button>
              <button
                v-else-if="canReview(item)"
                class="action-btn primary-btn"
                size="mini"
                @tap="goReview(item)"
              >
                去评价
              </button>
              <button
                v-else-if="isReviewed(item)"
                class="action-btn disabled-btn"
                size="mini"
                disabled
              >
                已评价
              </button>
              <view v-else class="action-placeholder"></view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="refundModal.visible" class="modal-mask" @tap="closeRefundModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
        <text class="modal-title">申请退款</text>
        <text class="modal-close" @tap="closeRefundModal">×</text>
      </view>

        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">退款原因</text>
            <view class="reason-list">
              <view
                v-for="(reason, idx) in refundReasons"
                :key="idx"
                class="reason-item"
                :class="{ active: refundModal.reason === reason }"
                @tap="selectRefundReason(reason)"
              >
                {{ reason }}
              </view>
            </view>
          </view>

          <view class="form-item">
            <text class="form-label">详细说明</text>
            <textarea
              v-model="refundModal.remark"
              class="form-textarea"
              placeholder="请输入详细说明（选填）"
              :maxlength="200"
            />
          </view>
        </view>

        <view class="modal-footer">
          <button class="modal-btn cancel-btn" @tap="closeRefundModal">取消</button>
          <button class="modal-btn confirm-btn" @tap="submitRefund">提交申请</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { http } from '@/utils/request'

interface OrderItem {
  order_id?: string | number
  task_id?: string | number
  id?: string | number
  status?: string
  pickup_address?: string
  delivery_address?: string
  fee_total?: string | number
  final_price?: string | number
  price?: string | number
  created_at?: string
  create_time?: string
  confirmed?: boolean
  reviewed?: boolean
  is_reviewed?: boolean
  task?: {
    pickup_address?: string
    delivery_address?: string
  }
  [key: string]: any
}

const list = ref<OrderItem[]>([])
const loading = ref(false)
const refreshing = ref(false)

const refundModal = reactive({
  visible: false,
  order: null as OrderItem | null,
  reason: '',
  remark: ''
})

const refundReasons = [
  '物品损坏',
  '超时送达',
  '跑腿员态度差',
  '物品丢失',
  '其他'
]

const STATUS_MAP: Record<string, string> = {
  PENDING: '待接单',
  ACCEPTED: '已接单',
  PICKING_UP: '取件中',
  DELIVERING: '配送中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  CANCELED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款'
}

const getItemId = (item: OrderItem): string | number => {
  return item.order_id || item.task_id || item.id || ''
}

const getPickupAddress = (item: OrderItem): string => {
  return item.pickup_address || item.task?.pickup_address || '暂无'
}

const getDeliveryAddress = (item: OrderItem): string => {
  return item.delivery_address || item.task?.delivery_address || '暂无'
}

const getPrice = (item: OrderItem): string | number => {
  return item.final_price || item.fee_total || item.price || '0.00'
}

const getStatusText = (item: OrderItem): string => {
  if (item.confirmed && item.status === 'COMPLETED') {
    return '已确认完成'
  }
  return STATUS_MAP[item.status || ''] || '未知状态'
}

const getStatusClass = (item: OrderItem): string => {
  const s = item.status || ''
  if (s === 'PENDING') return 'status-pending'
  if (s === 'ACCEPTED' || s === 'PICKING_UP') return 'status-accepted'
  if (s === 'DELIVERING') return 'status-delivering'
  if (s === 'COMPLETED') return 'status-completed'
  if (s === 'CANCELLED' || s === 'CANCELED') return 'status-cancelled'
  if (s === 'REFUNDING' || s === 'REFUNDED') return 'status-refund'
  return ''
}

const isFinishedStatus = (item: OrderItem): boolean => {
  const s = item.status || ''
  return ['COMPLETED', 'CANCELLED', 'CANCELED', 'REFUNDED'].includes(s)
}

const canUrge = (item: OrderItem): boolean => {
  if (isFinishedStatus(item)) return false
  if (canCancel(item)) return false
  if (canConfirm(item)) return false
  if (canApplyRefund(item)) return false
  return true
}

const canCancel = (item: OrderItem): boolean => {
  return item.status === 'PENDING' || item.status === 'ACCEPTED'
}

const canConfirm = (item: OrderItem): boolean => {
  return item.status === 'COMPLETED' && !item.confirmed
}

const canApplyRefund = (item: OrderItem): boolean => {
  return item.status === 'DELIVERING'
}

const canReview = (item: OrderItem): boolean => {
  return item.status === 'COMPLETED' && !isReviewed(item)
}

const isReviewed = (item: OrderItem): boolean => {
  return !!(item.reviewed || item.is_reviewed)
}

const canContact = (item: OrderItem): boolean => {
  return !!(item.order_id || item.task_id)
}

const formatTime = (time?: string): string => {
  if (!time) return ''
  const d = new Date(time)
  if (isNaN(d.getTime())) return time
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fetchList = async () => {
  loading.value = true
  try {
    const res: any = await http.get<any>('/order/list', { type: 'published' })
    const data = (res?.data ?? res)
    const items = data?.list ?? data?.rows ?? data?.items ?? data?.orders ?? (Array.isArray(data) ? data : [])
    list.value = Array.isArray(items) ? items as OrderItem[] : []
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const onRefresh = () => {
  refreshing.value = true
  fetchList()
}

onPullDownRefresh(() => {
  onRefresh()
})

const goDetail = (item: OrderItem) => {
  const id = getItemId(item)
  uni.navigateTo({
    url: `/pages/order/detail?id=${id}`
  })
}

const contactRunner = (item: OrderItem) => {
  const id = getItemId(item)
  uni.navigateTo({
    url: `/pages/order/detail?id=${id}`
  })
}

const handleUrge = async (item: OrderItem) => {
  const id = getItemId(item)
  try {
    await http.post(`/order/${encodeURIComponent(id)}/urge`)
    uni.showToast({ title: '催单成功', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '催单失败', icon: 'none' })
  }
}

const handleCancel = (item: OrderItem) => {
  const isOrder = !!item.order_id
  const content = isOrder ? '确定取消该订单吗？' : '确定取消该任务吗？'
  uni.showModal({
    title: '提示',
    content,
    success: async (res) => {
      if (!res.confirm) return
      const id = getItemId(item)
      try {
        if (isOrder) {
          await http.put(`/order/${encodeURIComponent(id)}/cancel`)
        } else {
          await http.delete(`/task/${encodeURIComponent(id)}/cancel`)
        }
        uni.showToast({ title: '取消成功', icon: 'success' })
        fetchList()
      } catch (e: any) {
        uni.showToast({ title: e?.message || '取消失败', icon: 'none' })
      }
    }
  })
}

const handleConfirm = async (item: OrderItem) => {
  const id = getItemId(item)
  try {
    await http.post(`/order/confirm/${encodeURIComponent(id)}`)
    uni.showToast({ title: '确认成功', icon: 'success' })
    item.confirmed = true
    fetchList()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '确认失败', icon: 'none' })
  }
}

const openRefundModal = (item: OrderItem) => {
  refundModal.visible = true
  refundModal.order = item
  refundModal.reason = ''
  refundModal.remark = ''
}

const closeRefundModal = () => {
  refundModal.visible = false
  refundModal.order = null
}

const selectRefundReason = (reason: string) => {
  refundModal.reason = reason
}

const submitRefund = async () => {
  if (!refundModal.reason) {
    uni.showToast({ title: '请选择退款原因', icon: 'none' })
    return
  }
  const id = refundModal.order ? getItemId(refundModal.order) : ''
  if (!id) return
  try {
    await http.post(`/order/${encodeURIComponent(id)}/refund`, {
      reason: refundModal.reason,
      remark: refundModal.remark
    })
    uni.showToast({ title: '申请已提交', icon: 'success' })
    closeRefundModal()
    fetchList()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败', icon: 'none' })
  }
}

const goReview = (item: OrderItem) => {
  const id = getItemId(item)
  uni.navigateTo({
    url: `/pages/order/review?id=${id}`
  })
}

onMounted(() => {
  fetchList()
})
</script>

<style lang="scss" scoped>
.published-page {
  min-height: 100vh;
  background: #f5f6f8;
}

.order-scroll {
  height: 100vh;
}

.loading-wrap,
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.order-list {
  padding: 24rpx;
}

.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.status-tag {
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.status-pending {
  background: #fff7e6;
  color: #fa8c16;
}

.status-accepted {
  background: #e6f7ff;
  color: #1890ff;
}

.status-delivering {
  background: #f6ffed;
  color: #52c41a;
}

.status-completed {
  background: #f0f5ff;
  color: #2f54eb;
}

.status-cancelled {
  background: #f5f5f5;
  color: #8c8c8c;
}

.status-refund {
  background: #fff1f0;
  color: #f5222d;
}

.publish-time {
  font-size: 24rpx;
  color: #999;
}

.address-section {
  background: #fafafa;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}

.address-row {
  display: flex;
  align-items: flex-start;
}

.address-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-top: 10rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.pickup-dot {
  background: #52c41a;
}

.delivery-dot {
  background: #f5222d;
}

.address-line {
  width: 2rpx;
  height: 28rpx;
  background: #d9d9d9;
  margin-left: 7rpx;
  margin: 12rpx 0;
}

.address-text {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 20rpx;
}

.amount {
  font-size: 36rpx;
  font-weight: 600;
  color: #ff4d4f;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.action-col {
  display: flex;
  justify-content: center;
}

.action-btn {
  width: 100%;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
  border-radius: 32rpx;
  margin: 0;
  padding: 0;
}

.outline-btn {
  background: #fff;
  color: #595959;
  border: 1rpx solid #d9d9d9;
}

.primary-btn {
  background: #1890ff;
  color: #fff;
  border: none;
}

.danger-btn {
  background: #fff1f0;
  color: #f5222d;
  border: 1rpx solid #ffa39e;
}

.warn-btn {
  background: #fff7e6;
  color: #fa8c16;
  border: 1rpx solid #ffd591;
}

.disabled-btn {
  background: #f5f5f5;
  color: #bfbfbf;
  border: none;
}

.action-placeholder {
  height: 64rpx;
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
}

.modal-content {
  width: 620rpx;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.modal-close {
  font-size: 48rpx;
  color: #999;
  line-height: 1;
}

.modal-body {
  padding: 32rpx;
}

.form-item {
  margin-bottom: 32rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.reason-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.reason-item {
  padding: 12rpx 28rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #595959;
  border: 1rpx solid transparent;

  &.active {
    background: #e6f7ff;
    color: #1890ff;
    border-color: #91d5ff;
  }
}

.form-textarea {
  width: 100%;
  height: 180rpx;
  padding: 20rpx;
  background: #fafafa;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  border-top: 1rpx solid #f0f0f0;
}

.modal-btn {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 30rpx;
  border-radius: 0;
  margin: 0;
  border: none;
}

.cancel-btn {
  background: #fff;
  color: #595959;
  border-right: 1rpx solid #f0f0f0;
}

.confirm-btn {
  background: #1890ff;
  color: #fff;
}
</style>
