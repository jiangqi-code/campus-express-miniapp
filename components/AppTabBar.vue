<template>
  <view class="app-tabbar">
    <view class="tabbar-safe" />
    <view class="tabbar-inner">
      <view
        v-for="(item, idx) in tabs"
        :key="item.key"
        class="tabbar-item"
        :class="{ active: current === item.key }"
        @tap="handleTap(item, idx)"
      >
        <view class="tabbar-icon">
          <text class="icon-text">{{ item.icon }}</text>
          <view v-if="item.badge && item.badge > 0" class="tabbar-badge">
            {{ item.badge > 99 ? '99+' : item.badge }}
          </view>
        </view>
        <text class="tabbar-label">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TabItem {
  key: string
  label: string
  icon: string
  pagePath: string
  badge?: number
}

const props = withDefaults(
  defineProps<{
    current: string
    unreadMessageCount?: number
  }>(),
  {
    unreadMessageCount: 0,
  },
)

const emit = defineEmits<{
  (e: 'change', key: string): void
}>()

const tabs = computed<TabItem[]>(() => [
  {
    key: 'hall',
    label: '任务大厅',
    icon: '🏠',
    pagePath: '/pages/task/hall',
  },
  {
    key: 'order',
    label: '订单',
    icon: '📋',
    pagePath: '/pages/order/index',
  },
  {
    key: 'message',
    label: '消息',
    icon: '🔔',
    pagePath: '/pages/message/index',
    badge: props.unreadMessageCount,
  },
  {
    key: 'profile',
    label: '我的',
    icon: '👤',
    pagePath: '/pages/profile/index',
  },
])

const handleTap = (item: TabItem, idx: number) => {
  if (props.current === item.key) return
  emit('change', item.key)
  uni.reLaunch({ url: item.pagePath })
}
</script>

<style lang="scss" scoped>
.app-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: #ffffff;
  box-shadow: 0 -2rpx 20rpx rgba(0, 0, 0, 0.06);
  border-top: 2rpx solid #f2f3f5;
}

.tabbar-safe {
  height: constant(safe-area-inset-bottom);
  height: env(safe-area-inset-bottom);
}

.tabbar-inner {
  display: flex;
  align-items: center;
  height: 110rpx;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  transition: transform 0.15s;

  &:active {
    transform: scale(0.95);
  }

  &.active {
    .tabbar-icon {
      transform: translateY(-4rpx);
    }
    .icon-text {
      opacity: 1;
    }
    .tabbar-label {
      color: #165dff;
      font-weight: 600;
    }
  }
}

.tabbar-icon {
  position: relative;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.icon-text {
  font-size: 44rpx;
  line-height: 1;
  opacity: 0.75;
  transition: opacity 0.2s;
}

.tabbar-badge {
  position: absolute;
  top: -6rpx;
  right: -16rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  background: #f53f3f;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 32rpx;
  text-align: center;
  border-radius: 999rpx;
  border: 4rpx solid #ffffff;
  box-sizing: border-box;
}

.tabbar-label {
  font-size: 22rpx;
  color: #86909c;
  line-height: 1.2;
  transition: all 0.2s;
}
</style>
