<template>
  <view class="home-page">
    <view class="hero">
      <image class="hero-art" src="/static/task-hall/campus-runner-hero.png" mode="aspectFill" />
      <view class="hero-shade" />
      <view class="hero-top">
        <view class="campus-pill">
          <image src="/static/task-hall-icons/location.svg" mode="aspectFit" />
          <text>广东白云学院</text>
        </view>
        <text class="weather">晴 28°C</text>
      </view>
      <view class="hero-copy">
        <text class="eyebrow">今天也有同学正在帮你跑腿</text>
        <text class="hero-title">你好，{{ displayName }}</text>
        <text class="hero-title">欢迎回到校园跑腿</text>
      </view>
      <view class="search-box" @tap="goHall">
        <image src="/static/task-hall-icons/search.svg" mode="aspectFit" />
        <text>搜索取件码、地点、物品...</text>
        <view class="search-btn">搜索</view>
      </view>
    </view>

    <view class="main">
      <view class="service-card">
        <view v-for="item in services" :key="item.title" class="service" @tap="go(item.path)">
          <view class="service-icon" :class="item.tone">
            <image :src="item.icon" mode="aspectFit" />
          </view>
          <text class="service-title">{{ item.title }}</text>
          <text class="service-desc">{{ item.desc }}</text>
        </view>
      </view>

      <view class="runner-status">
        <view class="status-item"><view class="online-dot" /><text>校园跑腿员在线接单</text></view>
        <view class="status-item"><image src="/static/task-hall-icons/clock.svg" /><text>响应及时</text></view>
      </view>

      <view class="section-head">
        <text class="section-title">推荐任务</text>
        <text class="more" @tap="goHall">查看更多 ›</text>
      </view>

      <scroll-view v-if="tasks.length" scroll-x class="task-scroll" :show-scrollbar="false">
        <view class="task-row">
          <view v-for="task in tasks" :key="task.id" class="task-card" @tap="openTask(task.id)">
            <view class="task-head">
              <text class="task-tag">{{ task.task_type || task.type || '跑腿' }}</text>
              <text class="price">¥{{ money(task.fee_total) }}</text>
            </view>
            <view class="route"><text class="route-mark start">起</text><text>{{ task.pickup_address || '取件地点待确认' }}</text></view>
            <view class="route"><text class="route-mark end">终</text><text>{{ task.delivery_address || '送达地点待确认' }}</text></view>
            <view class="detail-tip"><image src="/static/task-hall-icons/clock.svg" /><text>查看任务详情</text></view>
          </view>
        </view>
      </scroll-view>
      <view v-else class="task-empty" @tap="goHall">
        <image src="/static/task-hall-icons/empty.svg" mode="aspectFit" />
        <view><text class="empty-title">{{ loading ? '正在获取推荐任务' : '暂时没有待接任务' }}</text><text class="empty-desc">去任务大厅看看最新需求</text></view>
      </view>

      <view class="coupon" @tap="goPublish">
        <view>
          <text class="coupon-title">新用户专享优惠</text>
          <view class="coupon-row"><text class="coupon-off">首单立减 ¥5</text><text class="coupon-btn">立即发布</text></view>
        </view>
        <image src="/static/task-hall-icons/mascot.svg" mode="aspectFit" />
      </view>

      <view class="tools-card">
        <text class="section-title">快捷工具</text>
        <view class="tool-grid">
          <view v-for="tool in tools" :key="tool.label" class="tool" @tap="go(tool.path)">
            <view class="tool-icon"><image :src="tool.icon" mode="aspectFit" /></view>
            <text>{{ tool.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="tabbar">
      <view class="tab active"><image src="/static/task-hall-icons/location.svg" /><text>首页</text></view>
      <view class="tab" @tap="goHall"><image src="/static/task-hall-icons/bicycle.svg" /><text>大厅</text></view>
      <view class="publish" @tap="goPublish"><text>＋</text></view>
      <view class="tab" @tap="go('/pages/message/index')"><image src="/static/task-hall-icons/note.svg" /><text>消息</text></view>
      <view class="tab" @tap="go('/pages/profile/index')"><image src="/static/task-hall-icons/mascot.svg" /><text>我的</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { http } from '@/utils/request'
import type { TaskItem } from '@/types/models'

const authStore = useAuthStore()
const tasks = ref<TaskItem[]>([])
const loading = ref(true)
const displayName = computed(() => authStore.profile?.nickname?.trim() || '同学')

const services = [
  { title: '取快递', desc: '代取件寄件', icon: '/static/task-hall-icons/bicycle.svg', tone: 'mint', path: '/pages/task/publish?type=快递' },
  { title: '买餐饮', desc: '食堂外卖代购', icon: '/static/task-hall-icons/mascot.svg', tone: 'orange', path: '/pages/task/publish?type=餐饮' },
  { title: '送文件', desc: '教务资料代跑', icon: '/static/task-hall-icons/note.svg', tone: 'blue', path: '/pages/task/publish?type=文件' },
  { title: '数码维修', desc: '校园软硬件修', icon: '/static/task-hall-icons/warning.svg', tone: 'violet', path: '/pages/task/publish?type=维修' },
  { title: '其他代办', desc: '各种跑腿需求', icon: '/static/task-hall-icons/location.svg', tone: 'yellow', path: '/pages/task/publish?type=其他' },
]
const tools = [
  { label: '我的订单', icon: '/static/task-hall-icons/note.svg', path: '/pages/order/index' },
  { label: '我的钱包', icon: '/static/task-hall-icons/mascot.svg', path: '/pages/wallet/index' },
  { label: '消息中心', icon: '/static/task-hall-icons/warning.svg', path: '/pages/message/index' },
  { label: '个人中心', icon: '/static/task-hall-icons/location.svg', path: '/pages/profile/index' },
  { label: '邀请好友', icon: '/static/task-hall-icons/bicycle.svg', path: '/pages/profile/index' },
]

const go = (url: string) => uni.navigateTo({ url })
const goHall = () => uni.reLaunch({ url: '/pages/task/hall' })
const goPublish = () => go('/pages/task/publish')
const openTask = (id: string) => go(`/pages/task/detail?id=${encodeURIComponent(id)}`)
const money = (value: unknown) => Number(value || 0).toFixed(2)

async function loadTasks() {
  loading.value = true
  try {
    const result = await http.get<any>('/task/list', { page: 1, page_size: 6, status: 'PENDING' })
    const payload = result?.data ?? result
    tasks.value = payload?.list ?? payload?.records ?? payload?.items ?? []
  } catch {
    tasks.value = []
  } finally {
    loading.value = false
  }
}

onLoad(() => {
  if (authStore.isLogin && !authStore.profile) authStore.fetchProfile().catch(() => {})
  loadTasks()
})
</script>

<style lang="scss" scoped>
.home-page{min-height:100vh;padding-bottom:calc(154rpx + env(safe-area-inset-bottom));overflow-x:hidden;background:#f6f9f3;color:#293630;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
.hero{position:relative;height:590rpx;overflow:hidden;background:#6bc9f3}.hero-art,.hero-shade{position:absolute;inset:0;width:100%;height:100%}.hero-shade{background:linear-gradient(180deg,rgba(81,190,241,.08),rgba(23,85,57,.16))}
.hero-top{position:relative;z-index:2;display:flex;padding:calc(28rpx + env(safe-area-inset-top)) 32rpx 0;align-items:center;justify-content:space-between}.campus-pill{display:flex;height:58rpx;padding:0 20rpx;align-items:center;gap:9rpx;border-radius:30rpx;background:rgba(255,255,255,.8);font-size:25rpx;font-weight:700}.campus-pill image{width:29rpx;height:29rpx}.weather{color:#2f758d;font-size:24rpx;font-weight:600}
.hero-copy{position:relative;z-index:2;display:flex;padding:42rpx 34rpx 0;flex-direction:column}.eyebrow{color:#fff;font-size:31rpx;line-height:1.45;text-shadow:0 2rpx 8rpx rgba(28,96,118,.16)}.hero-title{color:#1e2925;font-size:41rpx;font-weight:800;line-height:1.28}
.search-box{position:absolute;z-index:3;left:32rpx;right:32rpx;bottom:25rpx;display:flex;height:94rpx;padding:0 12rpx 0 26rpx;align-items:center;gap:15rpx;border-radius:50rpx;background:#fff;box-shadow:0 12rpx 30rpx rgba(28,75,56,.15);color:#7d8883;font-size:26rpx}.search-box>image{width:34rpx;height:34rpx}.search-box>text{min-width:0;flex:1;white-space:nowrap}.search-btn{display:flex;width:128rpx;height:70rpx;align-items:center;justify-content:center;border-radius:36rpx;background:#7cc9a6;color:#fff;font-size:27rpx}
.main{position:relative;z-index:3;padding:0 24rpx 30rpx}.service-card{display:grid;grid-template-columns:repeat(5,1fr);padding:34rpx 12rpx 29rpx;border-radius:38rpx;background:rgba(255,255,255,.98);box-shadow:0 14rpx 38rpx rgba(42,76,57,.07)}.service{display:flex;min-width:0;align-items:center;flex-direction:column}.service-icon{display:flex;width:84rpx;height:84rpx;align-items:center;justify-content:center;border-radius:50%}.service-icon image{width:52rpx;height:52rpx}.mint{background:#d7f3d5}.orange{background:#fff0d7}.blue{background:#dceffd}.violet{background:#eeebff}.yellow{background:#fff4c9}.service-title{margin-top:11rpx;font-size:24rpx;font-weight:700}.service-desc{width:106rpx;margin-top:4rpx;color:#7a847f;font-size:18rpx;line-height:1.45;text-align:center}
.runner-status{display:flex;height:82rpx;margin-top:18rpx;padding:0 27rpx;align-items:center;justify-content:space-between;border:2rpx solid #8ed0ad;border-radius:24rpx;background:#f1fbf5;box-sizing:border-box}.status-item{display:flex;align-items:center;gap:9rpx;font-size:22rpx}.status-item image{width:29rpx;height:29rpx}.online-dot{width:17rpx;height:17rpx;border-radius:50%;background:#41cf6c;box-shadow:0 0 0 7rpx rgba(65,207,108,.12)}
.section-head{display:flex;margin:24rpx 0 16rpx;align-items:center;justify-content:space-between}.section-title{font-size:30rpx;font-weight:700}.more{color:#7d8882;font-size:21rpx}.task-scroll{width:calc(100% + 24rpx);white-space:nowrap}.task-row{display:inline-flex;gap:16rpx;padding-right:24rpx}.task-card{display:inline-flex;width:300rpx;min-height:226rpx;padding:23rpx;flex-direction:column;border-radius:28rpx;background:#fff;box-shadow:0 8rpx 24rpx rgba(42,76,57,.055);white-space:normal;box-sizing:border-box}.task-head{display:flex;margin-bottom:17rpx;align-items:center;justify-content:space-between}.task-tag{padding:6rpx 13rpx;border-radius:12rpx;background:#e8f7ef;color:#55aa80;font-size:18rpx}.price{color:#62bd91;font-size:29rpx;font-weight:700}.route{display:flex;min-width:0;margin-bottom:10rpx;align-items:center;gap:8rpx}.route>text:last-child{overflow:hidden;font-size:22rpx;text-overflow:ellipsis;white-space:nowrap}.route-mark{display:flex;width:28rpx;height:28rpx;flex:0 0 auto;align-items:center;justify-content:center;border-radius:50%;font-size:16rpx}.start{background:#e7f6ee;color:#63b589}.end{background:#fff0bd;color:#d3a52d}.detail-tip{display:flex;margin-top:auto;align-items:center;gap:8rpx;color:#858e89;font-size:19rpx}.detail-tip image{width:24rpx;height:24rpx}
.task-empty{display:flex;min-height:180rpx;padding:24rpx 35rpx;align-items:center;gap:23rpx;border-radius:28rpx;background:#fff;box-sizing:border-box}.task-empty image{width:148rpx;height:118rpx}.empty-title,.empty-desc{display:block}.empty-title{font-size:25rpx;font-weight:700}.empty-desc{margin-top:9rpx;color:#89928d;font-size:20rpx}
.coupon{display:flex;min-height:145rpx;margin-top:18rpx;padding:26rpx 30rpx;align-items:center;justify-content:space-between;border-radius:30rpx;background:linear-gradient(100deg,#d7f4e5,#fff2bd);box-sizing:border-box}.coupon-title{display:block;font-size:26rpx}.coupon-row{display:flex;margin-top:11rpx;align-items:center;gap:13rpx}.coupon-off{color:#68bf94;font-size:32rpx;font-weight:700}.coupon-btn{padding:7rpx 14rpx;border-radius:20rpx;background:#80cba7;color:#fff;font-size:18rpx}.coupon image{width:90rpx;height:90rpx}
.tools-card{margin-top:18rpx;padding:29rpx 25rpx;border-radius:34rpx;background:#fff;box-shadow:0 8rpx 25rpx rgba(42,76,57,.05)}.tool-grid{display:grid;grid-template-columns:repeat(5,1fr);margin-top:25rpx}.tool{display:flex;align-items:center;flex-direction:column;gap:11rpx;font-size:20rpx}.tool-icon{display:flex;width:74rpx;height:74rpx;align-items:center;justify-content:center;border-radius:50%;background:#edf8f2}.tool-icon image{width:39rpx;height:39rpx}
.tabbar{position:fixed;z-index:20;left:20rpx;right:20rpx;bottom:calc(14rpx + env(safe-area-inset-bottom));display:grid;height:108rpx;padding:0 18rpx;grid-template-columns:repeat(5,1fr);align-items:center;border-radius:58rpx;background:rgba(255,255,255,.97);box-shadow:0 12rpx 36rpx rgba(36,69,51,.16)}.tab{display:flex;align-items:center;flex-direction:column;gap:5rpx;color:#747f79;font-size:19rpx}.tab image{width:33rpx;height:33rpx}.tab.active{color:#68bf94;font-weight:700}.publish{display:flex;width:102rpx;height:102rpx;margin:-48rpx auto 0;align-items:center;justify-content:center;border:8rpx solid #f6f9f3;border-radius:50%;background:#7dcca7;box-shadow:0 10rpx 22rpx rgba(77,174,128,.3);color:#fff;box-sizing:border-box}.publish text{margin-top:-6rpx;font-size:58rpx;font-weight:300}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
