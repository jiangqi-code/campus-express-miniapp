<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { REVIEW_TAGS } from '@/config'
import { toAbsoluteFileUrl } from '@/utils/format'
import { http, uploadImage } from '@/utils/request'

const orderId = ref('')
const submitting = ref(false)
const imageList = ref<string[]>([])
const form = reactive({
  rating: 5,
  tags: [] as string[],
  content: '',
})

function toggleTag(tag: string) {
  if (form.tags.includes(tag)) {
    form.tags = form.tags.filter((item) => item !== tag)
  } else {
    form.tags = [...form.tags, tag]
  }
}

function chooseImages() {
  if (imageList.value.length >= 3) {
    uni.showToast({ title: '最多上传 3 张图片', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: 3 - imageList.value.length,
    success: async (res) => {
      try {
        const uploaded = await Promise.all(res.tempFilePaths.map((filePath) => uploadImage(filePath)))
        imageList.value = [...imageList.value, ...uploaded].slice(0, 3)
      } catch (error: any) {
        uni.showToast({ title: error.message || '上传失败', icon: 'none' })
      }
    },
  })
}

async function submitReview() {
  if (!orderId.value) {
    uni.showToast({ title: '缺少订单号', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await http.post(`/order/${encodeURIComponent(orderId.value)}/review`, {
      rating: form.rating,
      tags: form.tags,
      content: form.content.trim(),
      images: imageList.value,
    })
    uni.showToast({ title: '评价成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error: any) {
    uni.showToast({ title: error.message || '评价失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onLoad((query) => {
  orderId.value = String(query?.orderId ?? '')
})
</script>

<template>
  <view class="page-shell">
    <view class="card">
      <view class="section-title">订单评价</view>
      <view class="section-desc">支持 1-5 星、标签、文字和图片评价</view>

      <view class="field-label">评分</view>
      <view class="star-row">
        <view
          v-for="star in 5"
          :key="star"
          class="star-item"
          :class="{ active: star <= form.rating }"
          @tap="form.rating = star"
        >
          ★
        </view>
      </view>

      <view class="field-label">评价标签</view>
      <view class="tag-list">
        <view
          v-for="tag in REVIEW_TAGS"
          :key="tag"
          class="tag-item"
          :class="{ active: form.tags.includes(tag) }"
          @tap="toggleTag(tag)"
        >
          {{ tag }}
        </view>
      </view>

      <view class="field-label">文字评价</view>
      <textarea v-model="form.content" class="textarea" maxlength="200" placeholder="说说你的这次跑腿体验" />

      <view class="field-label">图片</view>
      <view class="thumb-list">
        <view class="upload-box" @tap="chooseImages">+</view>
        <image
          v-for="item in imageList"
          :key="item"
          class="thumb-image"
          :src="toAbsoluteFileUrl(item)"
          mode="aspectFill"
        />
      </view>

      <view class="btn-primary submit-btn" @tap="submitReview">
        {{ submitting ? '提交中...' : '提交评价' }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.star-row {
  display: flex;
  gap: 20rpx;
}

.star-item {
  font-size: 56rpx;
  color: #d1d5db;

  &.active {
    color: #f59e0b;
  }
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.tag-item {
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #4b5563;

  &.active {
    background: #dbeafe;
    color: #2563eb;
  }
}

.upload-box {
  width: 180rpx;
  height: 180rpx;
  border-radius: 20rpx;
  background: #eff6ff;
  border: 2rpx dashed #93c5fd;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  font-size: 56rpx;
  flex-shrink: 0;
}

.submit-btn {
  margin-top: 28rpx;
}

.field-label:not(:first-child) {
  margin-top: 24rpx;
}
</style>
