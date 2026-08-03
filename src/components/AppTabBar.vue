<template>
  <view class="app-tabbar">
    <view class="tabbar-inner">
      <view
        v-for="item in tabs"
        :key="item.key"
        class="tabbar-item"
        :class="{ active: current === item.key, publish: item.key === 'publish' }"
        @tap="handleTap(item)"
      >
        <view class="tabbar-icon-wrap">
          <view v-if="item.key === 'publish'" class="publish-button">
            <uni-icons type="plusempty" size="28" color="#FFFFFF" />
          </view>
          <uni-icons
            v-else
            :type="current === item.key ? item.activeIcon : item.icon"
            size="24"
            :color="current === item.key ? '#52C41A' : '#8A928C'"
          />
          <view v-if="item.key === 'message' && unreadMessageCount > 0" class="tabbar-badge">
            {{ unreadMessageCount > 99 ? '99+' : unreadMessageCount }}
          </view>
        </view>
        <text class="tabbar-label">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface TabItem {
  key: string
  label: string
  icon: string
  activeIcon: string
  pagePath: string
}

const props = withDefaults(defineProps<{ current: string; unreadMessageCount?: number }>(), {
  unreadMessageCount: 0,
})

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: 'home', activeIcon: 'home-filled', pagePath: '/pages/index/index' },
  { key: 'hall', label: '大厅', icon: 'list', activeIcon: 'list', pagePath: '/pages/task/hall' },
  { key: 'publish', label: '发布', icon: 'plusempty', activeIcon: 'plusempty', pagePath: '/pages/task/publish' },
  { key: 'message', label: '消息', icon: 'chat', activeIcon: 'chat-filled', pagePath: '/pages/message/index' },
  { key: 'profile', label: '我的', icon: 'person', activeIcon: 'person-filled', pagePath: '/pages/profile/index' },
]

function handleTap(item: TabItem) {
  if (item.key === props.current) return
  uni.switchTab({ url: item.pagePath })
}
</script>

<style lang="scss" scoped>
.app-tabbar {
  position: fixed;
  z-index: 999;
  right: 0;
  bottom: 0;
  left: 0;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 2rpx solid #eef3ec;
  background: #ffffff;
  box-shadow: 0 -8rpx 24rpx rgba(41, 78, 54, 0.08);
}

.tabbar-inner { display: grid; height: 104rpx; padding: 0 24rpx; grid-template-columns: repeat(5, 1fr); align-items: center; }
.tabbar-item { position: relative; display: flex; min-width: 0; min-height: 88rpx; align-items: center; justify-content: center; flex-direction: column; gap: 4rpx; color: #8a928c; transition: transform 150ms ease; }
.tabbar-item:active { transform: scale(0.96); }
.tabbar-icon-wrap { position: relative; display: flex; width: 48rpx; height: 48rpx; align-items: center; justify-content: center; }
.tabbar-label { font-size: 20rpx; line-height: 1.2; }
.tabbar-item.active { color: #52c41a; font-weight: 700; }
.tabbar-item.publish { padding-top: 0; transform: none; }
.publish-button {
  position: absolute;
  top: -48rpx;
  display: flex;
  width: 112rpx;
  height: 112rpx;
  align-items: center;
  justify-content: center;
  border: 8rpx solid #ffffff;
  border-radius: 50%;
  background: #52c41a;
  box-shadow: 0 10rpx 24rpx rgba(82, 196, 26, 0.34);
  box-sizing: border-box;
  transition: transform 120ms ease-out, box-shadow 120ms ease-out;
}
.publish:active { transform: none; }
.publish:active .publish-button { transform: scale(0.9); box-shadow: 0 5rpx 14rpx rgba(82, 196, 26, 0.26); }
.publish-button :deep(.uni-icons) { font-weight: 700; line-height: 1; }
.publish .tabbar-label { height: 0; margin: 0; overflow: hidden; opacity: 0; }
.tabbar-badge { position: absolute; top: -8rpx; right: -18rpx; min-width: 32rpx; height: 32rpx; padding: 0 8rpx; border: 4rpx solid #fff; border-radius: 999rpx; background: #ef4444; color: #fff; font-size: 20rpx; font-weight: 700; line-height: 28rpx; text-align: center; box-sizing: border-box; }
@media (prefers-reduced-motion: reduce) { .tabbar-item, .publish-button { transition: none; } }
</style>
