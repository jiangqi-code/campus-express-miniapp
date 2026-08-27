<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { http } from '@/utils/request'

const authStore = useAuthStore()
const profile = ref<any>(null)
const ranking = ref<any[]>([])
const inviteInput = ref('')
const loading = ref(false)
const binding = ref(false)

const levelClass = computed(() => `level-${String(profile.value?.level || 'BRONZE').toLowerCase()}`)
const progress = computed(() => {
  if (!profile.value?.next_level || !profile.value?.required_orders) return 100
  return Math.min(100, Math.round((Number(profile.value.completed_orders || 0) / Number(profile.value.required_orders)) * 100))
})
function unwrap(result: any) { return result?.data ?? result ?? {} }

async function load() {
  loading.value = true
  try {
    const [membership, inviteRanking] = await Promise.all([http.get<any>('/membership'), http.get<any>('/membership/ranking')])
    profile.value = unwrap(membership)
    const data = unwrap(inviteRanking)
    ranking.value = Array.isArray(data.list) ? data.list : []
  } catch (error: any) { uni.showToast({ title: error?.message || '会员信息加载失败', icon: 'none' }) } finally { loading.value = false; uni.stopPullDownRefresh() }
}

function copyCode() {
  if (!profile.value?.invite_code) return
  uni.setClipboardData({ data: profile.value.invite_code, success: () => uni.showToast({ title: '邀请码已复制', icon: 'success' }) })
}
async function bindInvite() {
  const code = inviteInput.value.trim().toUpperCase()
  if (!code || binding.value) return
  binding.value = true
  try {
    const result = unwrap(await http.post<any>('/membership/invite', { code }))
    uni.showToast({ title: result.coupon_rewarded ? '绑定成功，奖励券已发放' : '绑定成功', icon: 'success' })
    inviteInput.value = ''
    await load()
  } catch (error: any) { uni.showToast({ title: error?.message || '绑定失败', icon: 'none', duration: 2500 }) } finally { binding.value = false }
}
function rankLabel(index: number) { return index < 3 ? ['Ⅰ', 'Ⅱ', 'Ⅲ'][index] : String(index + 1) }

onLoad(async () => { await authStore.bootstrap(); await load() })
onPullDownRefresh(() => { void load() })
</script>

<template>
  <view class="page-shell membership-page">
    <view v-if="profile" class="level-hero" :class="levelClass"><text class="hero-kicker">CAMPUS MEMBERSHIP</text><view class="hero-row"><view><view class="level-name">{{ profile.level_name }}会员</view><view class="level-benefit">{{ profile.benefit }}</view></view><view class="level-mark">{{ profile.level_name.slice(0, 1) }}</view></view><view class="stats-row"><view><text>{{ profile.completed_orders }}</text><span>完成订单</span></view><view><text>{{ profile.credit_score }}</text><span>信用分</span></view><view><text>{{ profile.invite_count }}</text><span>成功邀请</span></view></view></view>
    <view v-if="profile?.next_level" class="progress-card"><view class="progress-head"><text>升级至{{ profile.next_level_name }}</text><text>{{ profile.completed_orders }} / {{ profile.required_orders }} 单</text></view><view class="progress-track"><view class="progress-fill" :style="{ width: `${progress}%` }" /></view><view class="progress-copy">还需完成 {{ Math.max(0, profile.required_orders - profile.completed_orders) }} 单，且信用分达到 {{ profile.required_credit }} 分</view></view>
    <view class="invite-card"><view><text class="section-kicker">INVITE FRIENDS</text><view class="section-title">邀请好友，一起享受校园服务</view><view class="section-copy">好友绑定你的邀请码后，双方将获得运营配置中的邀请奖励券。</view></view><view class="code-row"><text class="invite-code">{{ profile?.invite_code || '——' }}</text><view class="copy-button" @tap="copyCode">复制</view></view></view>
    <view v-if="!profile?.invited_by" class="bind-card"><view class="field-label">填写好友邀请码</view><view class="bind-row"><input v-model="inviteInput" class="code-input" maxlength="8" placeholder="例如 CEABC123" /><view class="bind-button" :class="{ disabled: !inviteInput.trim() || binding }" @tap="bindInvite">{{ binding ? '绑定中' : '绑定' }}</view></view></view>
    <view class="ranking-card"><view class="ranking-head"><view class="section-title">邀请排行榜</view><text>前 20 名</text></view><view v-if="!ranking.length" class="ranking-empty">暂时还没有邀请记录</view><view v-for="(item, index) in ranking" :key="item.user_id" class="ranking-row"><view class="rank-number" :class="{ top: index < 3 }">{{ rankLabel(index) }}</view><view class="rank-avatar">{{ String(item.nickname || '同').slice(0, 1) }}</view><text class="rank-name">{{ item.nickname }}</text><text class="rank-count">{{ item.invite_count }} 人</text></view></view>
  </view>
</template>

<style lang="scss" scoped>
.membership-page { padding-top: 20rpx; }.level-hero { border-radius: 28rpx; padding: 30rpx; color: #fff; }.level-bronze { background: #6e5545; }.level-silver { background: #4d6173; }.level-gold { background: #876721; }.level-diamond { background: #355b82; }.hero-kicker, .section-kicker { font-size: 20rpx; font-weight: 850; letter-spacing: .12em; }.hero-kicker { color: rgba(255,255,255,.65); }.hero-row, .stats-row, .progress-head, .code-row, .bind-row, .ranking-head, .ranking-row { display: flex; align-items: center; }.hero-row { justify-content: space-between; margin-top: 16rpx; }.level-name { font-size: 43rpx; font-weight: 850; letter-spacing: -.04em; }.level-benefit { margin-top: 8rpx; color: rgba(255,255,255,.76); font-size: 24rpx; }.level-mark { display: flex; width: 92rpx; height: 92rpx; align-items: center; justify-content: center; border: 2rpx solid rgba(255,255,255,.3); border-radius: 22rpx; font-size: 46rpx; font-weight: 850; }.stats-row { gap: 12rpx; margin-top: 30rpx; }.stats-row view { min-width: 0; flex: 1; border-top: 2rpx solid rgba(255,255,255,.22); padding-top: 16rpx; }.stats-row text, .stats-row span { display: block; }.stats-row text { font-size: 30rpx; font-weight: 800; }.stats-row span { margin-top: 3rpx; color: rgba(255,255,255,.62); font-size: 20rpx; }.progress-card, .invite-card, .bind-card, .ranking-card { margin-top: 20rpx; border: 2rpx solid #e0e9f2; border-radius: 24rpx; padding: 24rpx; background: #fff; }.progress-head, .ranking-head { justify-content: space-between; color: #39526c; font-size: 24rpx; font-weight: 750; }.progress-head text:last-child, .ranking-head text { color: #8093a6; font-size: 21rpx; font-weight: 600; }.progress-track { height: 14rpx; margin-top: 16rpx; overflow: hidden; border-radius: 999rpx; background: #eaf0f5; }.progress-fill { height: 100%; border-radius: inherit; background: #2563eb; }.progress-copy { margin-top: 12rpx; color: #7b8d9e; font-size: 22rpx; }.invite-card { background: #f4f8ff; }.section-kicker { color: #3c72b5; }.section-title { margin-top: 8rpx; color: #29435e; font-size: 30rpx; font-weight: 800; }.section-copy { margin-top: 8rpx; color: #72859a; font-size: 23rpx; line-height: 1.55; }.code-row { justify-content: space-between; margin-top: 20rpx; border-top: 2rpx solid #dce8f6; padding-top: 18rpx; }.invite-code { color: #1d5db0; font-size: 35rpx; font-weight: 850; letter-spacing: .08em; }.copy-button, .bind-button { display: flex; min-height: 62rpx; align-items: center; justify-content: center; border-radius: 14rpx; padding: 0 20rpx; background: #2468bd; color: #fff; font-size: 23rpx; font-weight: 750; }.field-label { margin-bottom: 12rpx; color: #3c536c; font-size: 25rpx; font-weight: 750; }.bind-row { gap: 12rpx; }.code-input { height: 70rpx; min-width: 0; flex: 1; border-radius: 14rpx; padding: 0 17rpx; background: #f4f7fa; color: #344f69; font-size: 25rpx; }.bind-button { background: #296ebf; }.bind-button.disabled { opacity: .55; pointer-events: none; }.ranking-head { margin-bottom: 8rpx; }.ranking-row { gap: 12rpx; min-height: 76rpx; border-bottom: 2rpx solid #edf1f5; }.ranking-row:last-child { border-bottom: 0; }.rank-number { width: 34rpx; color: #96a5b3; font-size: 22rpx; text-align: center; font-weight: 750; }.rank-number.top { color: #c38621; font-size: 25rpx; }.rank-avatar { display: flex; width: 42rpx; height: 42rpx; align-items: center; justify-content: center; border-radius: 50%; background: #e4eefb; color: #3169aa; font-size: 21rpx; font-weight: 750; }.rank-name { overflow: hidden; min-width: 0; flex: 1; color: #405873; font-size: 24rpx; text-overflow: ellipsis; white-space: nowrap; }.rank-count { color: #64819e; font-size: 22rpx; }.ranking-empty { padding: 34rpx 0; color: #92a2b1; font-size: 23rpx; text-align: center; }
</style>
