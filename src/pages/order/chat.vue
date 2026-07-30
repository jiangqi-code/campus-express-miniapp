<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { http } from '@/utils/request'
import { miniSocket, type SocketEventPayload } from '@/utils/socket'

type ChatMessage = { id: string; fromUserId: string; text: string; createdAt: string }
const auth = useAuthStore()
const orderId = ref('')
const toUserId = ref('')
const messages = ref<ChatMessage[]>([])
const draft = ref('')
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const sending = ref(false)
const scrollIntoView = ref('')
const myUserId = computed(() => String(auth.profile?.id ?? ''))
let unsubscribe: (() => void) | undefined

function normalize(raw: any): ChatMessage {
  const root = raw?.data ?? raw
  return {
    id: String(root?.id ?? `${root?.from_user_id}-${root?.created_at}-${root?.message}`),
    fromUserId: String(root?.from_user_id ?? root?.fromUserId ?? ''),
    text: String(root?.message ?? root?.content ?? ''),
    createdAt: String(root?.created_at ?? root?.createdAt ?? new Date().toISOString()),
  }
}

function merge(items: ChatMessage[], prepend = false) {
  const known = new Set(messages.value.map(item => item.id))
  const fresh = items.filter(item => item.text && !known.has(item.id))
  messages.value = prepend ? [...fresh, ...messages.value] : [...messages.value, ...fresh]
}

async function scrollBottom() {
  await nextTick()
  const last = messages.value[messages.value.length - 1]
  scrollIntoView.value = last ? `message-${last.id}` : ''
}

async function loadHistory(nextPage = 1) {
  if (loading.value) return
  loading.value = true
  try {
    const result: any = await http.get('/chat/messages', { orderId: orderId.value, page: nextPage, pageSize: 20 })
    const root = result?.data ?? result
    const items = (root?.messages ?? []).map(normalize)
    if (nextPage === 1) messages.value = items
    else merge(items, true)
    page.value = nextPage
    hasMore.value = Boolean(root?.pagination?.hasMore ?? items.length >= 20)
    if (nextPage === 1) scrollBottom()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '消息加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function send() {
  const message = draft.value.trim()
  if (!message || !toUserId.value || sending.value) return
  sending.value = true
  try {
    const result: any = await http.post('/chat/send', { orderId: orderId.value, toUserId: toUserId.value, message })
    merge([normalize(result?.chatMessage ?? result?.data?.chatMessage ?? result)])
    draft.value = ''
    scrollBottom()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '发送失败', icon: 'none' })
  } finally {
    sending.value = false
  }
}

function receive(payload: SocketEventPayload) {
  if (payload.event === 'socket:open') {
    miniSocket.sendEvent('order:join', { orderId: Number(orderId.value) })
    return
  }
  if (payload.event !== 'chat:message') return
  const raw = payload.data
  if (String(raw?.order_id ?? raw?.orderId ?? '') !== orderId.value) return
  merge([normalize(raw)])
  scrollBottom()
}

onLoad(async query => {
  orderId.value = String(query?.orderId ?? '')
  toUserId.value = String(query?.toUserId ?? '')
  await auth.bootstrap()
  unsubscribe = miniSocket.subscribe(receive)
  miniSocket.connect(auth.token)
  loadHistory(1)
})

onUnload(() => {
  miniSocket.sendEvent('order:leave', { orderId: Number(orderId.value) })
  unsubscribe?.()
})
</script>

<template>
  <view class="chat-page">
    <scroll-view class="chat-history" scroll-y :scroll-into-view="scrollIntoView">
      <view v-if="hasMore" class="load-more" @tap="loadHistory(page + 1)">{{ loading ? '加载中...' : '加载更早消息' }}</view>
      <view v-if="!loading && messages.length === 0" class="empty-chat">暂无消息，开始沟通吧</view>
      <view v-for="item in messages" :id="`message-${item.id}`" :key="item.id" class="message-row" :class="{ mine: item.fromUserId === myUserId }">
        <view class="message-bubble">
          <text>{{ item.text }}</text>
          <text class="message-time">{{ new Date(item.createdAt).toLocaleString() }}</text>
        </view>
      </view>
    </scroll-view>
    <view class="composer safe-area-inset-bottom">
      <input v-model="draft" class="message-input" maxlength="500" confirm-type="send" placeholder="输入消息..." @confirm="send" />
      <button class="send-button" :disabled="sending || !draft.trim()" @tap="send">{{ sending ? '发送中' : '发送' }}</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chat-page { height: 100vh; display: flex; flex-direction: column; background: #f5f6f8; }
.chat-history { flex: 1; height: 0; padding: 24rpx; box-sizing: border-box; }
.load-more, .empty-chat { text-align: center; color: #8c8c8c; padding: 20rpx; font-size: 24rpx; }
.message-row { display: flex; justify-content: flex-start; margin-bottom: 20rpx; }
.message-row.mine { justify-content: flex-end; }
.message-bubble { max-width: 72%; padding: 18rpx 22rpx; border-radius: 20rpx; background: #fff; color: #1f2937; display: flex; flex-direction: column; gap: 8rpx; }
.message-row.mine .message-bubble { color: #fff; background: #2563eb; }
.message-time { font-size: 20rpx; opacity: .68; }
.composer { display: flex; gap: 16rpx; padding: 20rpx 24rpx; background: #fff; border-top: 1rpx solid #e5e7eb; }
.message-input { flex: 1; height: 72rpx; padding: 0 22rpx; border-radius: 36rpx; background: #f3f4f6; }
.send-button { width: 140rpx; height: 72rpx; line-height: 72rpx; margin: 0; padding: 0; border-radius: 36rpx; background: #2563eb; color: #fff; font-size: 26rpx; }
</style>
