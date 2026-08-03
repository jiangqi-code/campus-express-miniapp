<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import { formatMessageTime } from '@/utils/format'
import AppTabBar from '@/components/AppTabBar.vue'
import type { MessageItem } from '@/types/models'

const authStore = useAuthStore()
const messageStore = useMessageStore()

const loading = ref(false)

const messages = computed(() => messageStore.list)
const unreadCount = computed(() => messageStore.unreadCount)
const errorMessage = computed(() => messageStore.errorMessage)
const page = computed(() => messageStore.page)
const pageSize = computed(() => messageStore.pageSize)
const total = computed(() => messageStore.total)
const hasPrev = computed(() => messageStore.hasPrev)
const hasNext = computed(() => messageStore.hasNext)
const totalPages = computed(() => messageStore.totalPages)

const getInitial = (name: string | null | undefined) => {
  const n = String(name || '').trim()
  return n ? n.charAt(0).toUpperCase() : '·'
}

const getTitle = (item: MessageItem) => {
  if (item.type === 'chat') {
    return `${item.sender_name || '对方'} 发来消息`
  }
  return item.title || '系统消息'
}

const fetchMessages = async (targetPage?: number, append = false) => {
  loading.value = true
  try {
    const p = targetPage ?? page.value
    await messageStore.fetchMessages(p, pageSize.value, append)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '消息加载失败', icon: 'none' })
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

const markRead = async (id: number) => {
  try {
    await messageStore.markRead(id)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '标记失败', icon: 'none' })
  }
}

const markAllRead = async () => {
  if (unreadCount.value === 0) return
  try {
    await messageStore.markAllRead()
    uni.showToast({ title: '已全部标记为已读', icon: 'success' })
  } catch (error: any) {
    uni.showToast({ title: error?.message || '操作失败', icon: 'none' })
  }
}

const openMessage = async (item: MessageItem) => {
  if (!item.is_read) {
    await markRead(item.id)
  }
  const orderId = (item as any).order_id ?? (item as any).orderId ?? item.related_id ?? item.conversation_id
  if ((item.type === 'chat' || item.type === 'order' || orderId) && orderId) {
    uni.navigateTo({ url: `/pages/order/detail?orderId=${orderId}` })
    return
  }
  if (item.type === 'task' && item.related_id) {
    uni.navigateTo({ url: `/pages/task/detail?id=${item.related_id}` })
  }
}

const loadMore = () => { if (hasNext.value && !loading.value) fetchMessages(page.value + 1, true) }

const retry = () => {
  fetchMessages(1)
}

onPullDownRefresh(() => {
  fetchMessages(1)
})

onLoad(async () => {
  await authStore.bootstrap()
  fetchMessages(1)
})
</script>

<template>
  <view class="page-shell">
    <view class="card header-card">
      <view class="row-between">
        <view>
          <view class="section-title">消息中心</view>
          <view class="section-desc">实时通知 + 历史消息记录</view>
        </view>
        <view class="badge badge-primary">{{ unreadCount }} 条未读</view>
      </view>

      <view class="action-row grid-2">
        <view class="btn-secondary action-btn" :class="{ disabled: loading }" @tap="() => fetchMessages(1)">
          {{ loading ? '加载中...' : '刷新' }}
        </view>
        <view
          class="btn-primary action-btn"
          :class="{ disabled: unreadCount === 0 || loading }"
          @tap="markAllRead"
        >
          全部已读
        </view>
      </view>
    </view>

    <view v-if="errorMessage" class="card error-card">
      <view class="error-text">{{ errorMessage }}</view>
      <view class="btn-primary retry-btn" @tap="retry">重试</view>
    </view>

    <scroll-view v-else scroll-y class="message-scroll" :show-scrollbar="false" lower-threshold="120" @scrolltolower="loadMore">
      <view v-if="messages.length === 0 && !loading" class="card empty-card">
        <view class="empty-illustration">📭</view>
        <view class="empty-title">暂无消息</view>
        <view class="empty-desc">新消息会第一时间推送给你</view>
      </view>

      <view v-else class="message-list">
        <view
          v-for="item in messages"
          :key="item.id"
          class="card message-card"
          :class="{ unread: !item.is_read }"
          @tap="openMessage(item)"
        >
          <view v-if="!item.is_read" class="unread-bar" />
          <view class="message-avatar">
            <image
              v-if="item.sender_avatar"
              :src="item.sender_avatar"
              class="avatar-image"
              mode="aspectFill"
            />
            <view v-else class="avatar-placeholder">{{ getInitial(item.sender_name) }}</view>
            <view v-if="!item.is_read" class="unread-dot">新</view>
          </view>
          <view class="message-body">
            <view class="row-between">
              <view class="message-title">{{ getTitle(item) }}</view>
              <view class="message-time muted">{{ formatMessageTime(item.created_at) }}</view>
            </view>
            <view class="message-content">{{ item.content || '暂无内容' }}</view>
            <view class="row-between footer-row">
              <view class="muted">{{ item.sender_name || item.type || '系统通知' }}</view>
              <view
                v-if="!item.is_read"
                class="mark-read-btn"
                @tap.stop="markRead(item.id)"
              >
                标已读
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="messages.length > 0" class="list-footer">{{ loading ? '加载中…' : hasNext ? '上拉加载更多' : '已加载全部消息' }}</view>
    </scroll-view>

    <!-- #ifdef H5 -->
    <AppTabBar current="message" :unread-message-count="unreadCount" />
    <!-- #endif -->
  </view>
</template>

<style lang="scss" scoped>
.header-card {
  position: sticky;
  top: 0;
  z-index: 10;
}

.action-btn {
  height: 72rpx;
  font-size: 26rpx;
}

.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.error-card {
  margin-top: 24rpx;
  text-align: center;
  background: #fef2f2;
  border: 2rpx solid #fecaca;
}

.error-text {
  color: #dc2626;
  font-size: 26rpx;
  margin-bottom: 20rpx;
}

.retry-btn {
  height: 64rpx;
  font-size: 26rpx;
  display: inline-flex;
  padding: 0 32rpx;
}

.message-scroll {
  margin-top: 24rpx;
  height: calc(100vh - 360rpx);
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.empty-card {
  text-align: center;
  padding: 80rpx 24rpx;
}

.empty-illustration {
  font-size: 120rpx;
  line-height: 1.5;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-top: 16rpx;
  color: #111827;
}

.empty-desc {
  font-size: 26rpx;
  color: #6b7280;
  margin-top: 8rpx;
}

.message-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding-left: 40rpx;
  transition: background 0.2s;
}

.message-card.unread {
  background: #fffbeb;
}

.unread-bar {
  position: absolute;
  left: 0;
  top: 24rpx;
  bottom: 24rpx;
  width: 8rpx;
  background: #52c41a;
  border-radius: 0 4rpx 4rpx 0;
}

.message-avatar {
  position: relative;
  flex-shrink: 0;
}

.avatar-image,
.avatar-placeholder {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
}

.avatar-image {
  display: block;
  background: #f3f4f6;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #9ca3af;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
}

.unread-dot {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 10rpx;
  background: #ef4444;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 700;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #ffffff;
}

.message-body {
  flex: 1;
  min-width: 0;
  line-height: 1.5;
}

.message-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 360rpx;
}

.message-time {
  font-size: 22rpx;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.message-content {
  margin-top: 12rpx;
  color: #374151;
  font-size: 26rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-row {
  margin-top: 16rpx;
}

.mark-read-btn {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  background: #f1faed;
  color: #389e0d;
  font-size: 22rpx;
  border-radius: 999rpx;
  font-weight: 600;
}

.pagination {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.page-btn {
  height: 64rpx;
  padding: 0 28rpx;
  font-size: 24rpx;
  flex-shrink: 0;
}

.page-info {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
}

.page-shell {
  padding-bottom: 140rpx;
}
</style>
