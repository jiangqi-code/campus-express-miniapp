import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { MessageItem } from '@/types/models'
import { http } from '@/utils/request'
import { miniSocket } from '@/utils/socket'

export const useMessageStore = defineStore('message', () => {
  const list = ref<MessageItem[]>([])
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const serverUnreadCount = ref(0)
  const errorMessage = ref('')
  const socketStatus = ref<'idle' | 'open' | 'closed'>('idle')
  let unsubscribe: (() => void) | null = null

  const unreadCount = computed(() => serverUnreadCount.value)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const hasPrev = computed(() => page.value > 1)
  const hasNext = computed(() => page.value < totalPages.value)

  async function fetchMessages(targetPage = 1, targetPageSize = 20, append = false) {
    errorMessage.value = ''
    try {
      const result = await http.get<any>('/messages/', { page: targetPage, pageSize: targetPageSize })
      const items = result?.items ?? result?.data?.items ?? result?.list ?? result?.data?.list ?? []
      const nextItems = Array.isArray(items) ? items : []
      list.value = append ? [...list.value, ...nextItems.filter((next) => !list.value.some((item) => item.id === next.id))] : nextItems
      page.value = Number(result?.page ?? result?.data?.page ?? targetPage)
      pageSize.value = Number(result?.pageSize ?? result?.data?.pageSize ?? result?.per_page ?? result?.data?.per_page ?? targetPageSize)
      total.value = Number(result?.total ?? result?.data?.total ?? result?.count ?? result?.data?.count ?? list.value.length)
      serverUnreadCount.value = Number(result?.unreadCount ?? result?.data?.unreadCount ?? list.value.filter((item) => !item.is_read).length)
      return result
    } catch (error: any) {
      errorMessage.value = error?.message || '消息加载失败'
      throw error
    }
  }

  async function markRead(id: number) {
    await http.put(`/messages/${id}/read`)
    const target = list.value.find((item) => item.id === id)
    if (target) target.is_read = true
    serverUnreadCount.value = Math.max(0, serverUnreadCount.value - 1)
  }

  async function markAllRead() {
    await http.put('/messages/read-all')
    list.value = list.value.map((item) => ({ ...item, is_read: true }))
    serverUnreadCount.value = 0
  }

  function initSocket(token: string) {
    if (!unsubscribe) {
      unsubscribe = miniSocket.subscribe((payload) => {
        if (payload.event === 'socket:open') socketStatus.value = 'open'
        if (payload.event === 'socket:close') socketStatus.value = 'closed'
        if (payload.event === 'order:urge' || payload.event === 'message:new' || payload.event === 'notify') {
          const message = payload.data as Partial<MessageItem>
          const nextItem: MessageItem = {
            id: Number(message.id ?? Date.now()),
            title: String(message.title ?? '新消息'),
            content: String(message.content ?? message.title ?? ''),
            type: String(message.type ?? 'other'),
            is_read: false,
            created_at: String(message.created_at ?? new Date().toISOString()),
            related_id: message.related_id ?? null,
            conversation_id: message.conversation_id ?? null,
            sender_name: message.sender_name ?? null,
            sender_avatar: message.sender_avatar ?? null,
          }
          if (!list.value.some((item) => item.id === nextItem.id)) {
            list.value.unshift(nextItem)
            total.value += 1
            serverUnreadCount.value += 1
          }
          if (typeof uni.vibrateShort === 'function') uni.vibrateShort({ type: 'light' })
        }
      })
    }
    miniSocket.connect(token)
  }

  function pauseSocketHeartbeat() {
    miniSocket.pauseHeartbeat()
  }

  function reconnectNow() {
    miniSocket.reconnectNow()
  }

  function setBackground(value: boolean) {
    miniSocket.setBackground(value)
  }

  function closeSocket() {
    miniSocket.disconnect()
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    list,
    page,
    pageSize,
    total,
    totalPages,
    hasPrev,
    hasNext,
    errorMessage,
    socketStatus,
    unreadCount,
    fetchMessages,
    markRead,
    markAllRead,
    initSocket,
    pauseSocketHeartbeat,
    reconnectNow,
    setBackground,
    closeSocket,
  }
})
