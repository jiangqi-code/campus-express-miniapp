<template>
  <AppTabBar :current="current" :unread-message-count="unreadCount" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/AppTabBar.vue'
import { useMessageStore } from '@/stores/message'

const routeToKey: Record<string, string> = {
  'pages/index/index': 'home',
  'pages/task/hall': 'hall',
  'pages/task/publish': 'publish',
  'pages/message/index': 'message',
  'pages/profile/index': 'profile',
}

const current = ref('home')
const unreadCount = computed(() => useMessageStore().unreadCount)

function syncCurrent() {
  const pages = getCurrentPages()
  const route = pages[pages.length - 1]?.route || 'pages/index/index'
  current.value = routeToKey[route] || 'home'
}

onMounted(syncCurrent)
onShow(syncCurrent)
</script>
