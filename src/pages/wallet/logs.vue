<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { http } from '@/utils/request'
import { formatDateTime, formatMoney } from '@/utils/format'
const logs=ref<any[]>([]),page=ref(1),total=ref(0),loading=ref(false),error=ref('');const pageSize=15
const hasMore=()=>logs.value.length<total.value
async function load(target=1,append=false){if(loading.value)return;loading.value=true;error.value='';try{const result:any=await http.get('/wallet/logs',{page:target,pageSize}),root=result?.data??result,items=root?.items??root?.list??[];logs.value=append?[...logs.value,...items]:items;total.value=Number(root?.total||logs.value.length);page.value=target}catch(e:any){error.value=e?.message||'钱包流水加载失败'}finally{loading.value=false;uni.stopPullDownRefresh()}}
onPullDownRefresh(()=>load(1));onReachBottom(()=>{if(hasMore())load(page.value+1,true)});onLoad(()=>load(1))
</script>
<template><view class="page-shell"><view class="card"><view class="section-title">钱包流水</view><view v-if="error&&!logs.length" class="empty-box"><view class="empty-title">加载失败</view><view class="empty-desc">{{error}}</view><view class="btn-secondary" @tap="load(1)">重新加载</view></view><view v-else-if="loading&&!logs.length" class="empty-box"><view class="skeleton-block" /></view><view v-else-if="!logs.length" class="empty-box"><view class="empty-title">暂无钱包流水</view><view class="empty-desc">充值、支付和退款记录会显示在这里</view></view><view v-for="item in logs" :key="item.id" class="log"><view><text>{{item.type||'余额变动'}}</text><text class="muted time">{{formatDateTime(item.created_at||item.createdAt)}}</text></view><text :class="Number(item.amount)>=0?'income':'expense'">{{Number(item.amount)>=0?'收入 +':'支出 '}}{{formatMoney(Math.abs(Number(item.amount)))}}</text></view><view v-if="logs.length" class="list-footer">{{loading?'加载中…':hasMore()?'上拉加载更多':'已加载全部流水'}}</view></view></view></template>
<style lang="scss" scoped>.log{display:flex;justify-content:space-between;align-items:center;min-height:96rpx;padding:24rpx 0;border-bottom:1rpx solid #eef0f3}.log>view{display:flex;flex-direction:column;gap:8rpx}.time{font-size:22rpx}.income{color:#15803d;font-weight:600}.expense{color:#b91c1c;font-weight:600}.skeleton-block{width:100%;height:120rpx}</style>
