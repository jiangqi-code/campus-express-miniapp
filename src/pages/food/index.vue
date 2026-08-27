<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { http } from '@/utils/request'

type Merchant = { id:number; name:string; description?:string; logo?:string; cover_image?:string; address:string; is_open:boolean; min_order_amount?:number; prepare_minutes?:number; menu_item_count?:number }
const loading = ref(false), keyword = ref(''), merchants = ref<Merchant[]>([])
const visible = computed(() => merchants.value.filter(v => !keyword.value.trim() || `${v.name}${v.address}`.includes(keyword.value.trim())))
const payload = (value:any) => value?.data?.data ?? value?.data ?? value ?? {}
async function load() { loading.value=true; try { const data=payload(await http.get('/food/merchants',{page:1,page_size:50})); merchants.value=Array.isArray(data.list)?data.list:[] } catch (e:any) { uni.showToast({title:e?.message||'商家加载失败',icon:'none'}) } finally { loading.value=false; uni.stopPullDownRefresh() } }
function open(item:Merchant){ uni.navigateTo({url:`/pages/food/menu?id=${item.id}`}) }
onLoad(load); onPullDownRefresh(load)
</script>

<template>
  <view class="food-page">
    <view class="hero"><text class="eyebrow">CAMPUS FOOD</text><text class="title">食堂点餐</text><text class="sub">下单后由校园跑腿员配送到你身边</text><view class="search"><uni-icons type="search" size="19" color="#8a928c"/><input v-model="keyword" placeholder="搜索食堂、档口或菜品" confirm-type="search" /></view></view>
    <view class="section"><view class="section-head"><text>正在营业</text><text>{{ visible.length }} 家商家</text></view>
      <view v-if="loading" class="state">正在获取附近商家…</view>
      <view v-else-if="!visible.length" class="state"><text>暂时没有营业中的商家</text><text class="hint">稍后刷新，或尝试发布餐饮代购任务</text><button size="mini" @tap="load">重新加载</button></view>
      <view v-else class="merchant-list"><view v-for="item in visible" :key="item.id" class="merchant" @tap="open(item)"><image v-if="item.cover_image||item.logo" :src="item.cover_image||item.logo" mode="aspectFill"/><view v-else class="cover">食</view><view class="merchant-info"><view class="row"><text class="name">{{item.name}}</text><text class="open">营业中</text></view><text class="desc">{{item.description||item.address}}</text><view class="meta"><text>起送 ¥{{Number(item.min_order_amount||0).toFixed(0)}}</text><text>{{item.prepare_minutes||15}} 分钟备餐</text><text>{{item.menu_item_count||0}} 道菜</text></view></view><uni-icons type="right" size="18" color="#a4ada7"/></view></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.food-page{min-height:100vh;background:#f6f9f3;color:#293630}.hero{padding:56rpx 32rpx 38rpx;background:linear-gradient(135deg,#19653e,#55b681);color:#fff}.eyebrow{display:block;font-size:20rpx;letter-spacing:3rpx;opacity:.78}.title{display:block;margin-top:12rpx;font-size:52rpx;font-weight:800}.sub{display:block;margin-top:8rpx;font-size:25rpx;opacity:.9}.search{display:flex;align-items:center;gap:14rpx;height:78rpx;margin-top:30rpx;padding:0 22rpx;border-radius:40rpx;background:#fff}.search input{flex:1;color:#293630;font-size:26rpx}.section{padding:26rpx 24rpx}.section-head{display:flex;justify-content:space-between;margin-bottom:18rpx;font-size:30rpx;font-weight:700}.section-head text:last-child{font-size:22rpx;font-weight:400;color:#819087}.merchant-list{display:grid;gap:18rpx}.merchant{display:flex;align-items:center;gap:20rpx;padding:18rpx;border-radius:26rpx;background:#fff;box-shadow:0 8rpx 22rpx rgba(39,78,54,.06)}.merchant image,.cover{width:126rpx;height:126rpx;flex:0 0 auto;border-radius:20rpx}.cover{display:flex;align-items:center;justify-content:center;background:#dff3e6;color:#3b976d;font-size:46rpx;font-weight:800}.merchant-info{min-width:0;flex:1}.row{display:flex;gap:12rpx;align-items:center}.name{overflow:hidden;font-size:30rpx;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.open{padding:4rpx 9rpx;border-radius:8rpx;background:#e8f8ed;color:#46a56f;font-size:18rpx}.desc{display:block;overflow:hidden;margin-top:10rpx;color:#7d8883;font-size:23rpx;text-overflow:ellipsis;white-space:nowrap}.meta{display:flex;gap:15rpx;margin-top:13rpx;color:#6b897a;font-size:20rpx}.state{display:flex;min-height:300rpx;align-items:center;justify-content:center;flex-direction:column;gap:18rpx;border-radius:26rpx;background:#fff;color:#65746b}.hint{font-size:23rpx;color:#9aa59f}.state button{margin:0;background:#52c41a;color:#fff;border-radius:30rpx;font-size:24rpx}
</style>
