<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import type { ForumCategory } from '@/types/models'
import { toAbsoluteFileUrl } from '@/utils/format'
import { http, uploadImage } from '@/utils/request'

const authStore = useAuthStore()
const categories = ref<ForumCategory[]>([])
const categoryIndex = ref(0)
const imageList = ref<string[]>([])
const uploading = ref(false)
const submitting = ref(false)
const form = reactive({
  title: '',
  content: '',
  locationName: '',
})

const selectedCategory = computed(() => categories.value[categoryIndex.value] || null)

function unwrap(result: any) {
  return result?.data ?? result ?? {}
}

async function loadCategories() {
  const data = unwrap(await http.get<any>('/forum/categories'))
  categories.value = Array.isArray(data.list) ? data.list : []
}

function chooseImages() {
  if (uploading.value || imageList.value.length >= 3) return
  uni.chooseImage({
    count: 3 - imageList.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (result) => {
      uploading.value = true
      uni.showLoading({ title: '上传图片…', mask: true })
      try {
        const uploaded = await Promise.all(result.tempFilePaths.map((path, index) => uploadImage(path, 'images', (result as any).tempFiles?.[index])))
        imageList.value = [...imageList.value, ...uploaded].slice(0, 3)
      } catch (error: any) {
        uni.showToast({ title: error?.message || '图片上传失败', icon: 'none' })
      } finally {
        uploading.value = false
        uni.hideLoading()
      }
    },
  })
}

function previewImage(index: number) {
  const urls = imageList.value.map(toAbsoluteFileUrl)
  uni.previewImage({ urls, current: urls[index] })
}

function removeImage(index: number) {
  imageList.value.splice(index, 1)
}

async function submit() {
  if (submitting.value || uploading.value) return
  if (!authStore.isLogin) {
    uni.navigateTo({ url: '/pages/auth/index' })
    return
  }
  if (!selectedCategory.value) {
    uni.showToast({ title: '请选择信息分类', icon: 'none' })
    return
  }
  if (form.title.trim().length < 2) {
    uni.showToast({ title: '标题至少需要 2 个字符', icon: 'none' })
    return
  }
  if (form.content.trim().length < 5) {
    uni.showToast({ title: '正文至少需要 5 个字符', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await http.post('/forum/posts', {
      category_id: selectedCategory.value.id,
      title: form.title.trim(),
      content: form.content.trim(),
      images: imageList.value,
      location_name: form.locationName.trim() || undefined,
    })
    uni.showToast({ title: '提交成功，等待审核', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 700)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '发布失败，请稍后重试', icon: 'none', duration: 2600 })
  } finally {
    submitting.value = false
  }
}

onLoad(async () => {
  await authStore.bootstrap()
  try {
    await loadCategories()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '分类加载失败', icon: 'none' })
  }
})
</script>

<template>
  <view class="page-shell publish-page">
    <view class="publish-intro">
      <text class="intro-kicker">CAMPUS SQUARE</text>
      <view class="intro-title">发布一条有用的信息</view>
      <view class="intro-copy">提交后将由平台审核，审核通过后对校园用户展示。</view>
    </view>

    <view class="form-card">
      <view class="field-group">
        <view class="field-label">信息分类 <text class="required">*</text></view>
        <picker :range="categories" range-key="name" :value="categoryIndex" @change="categoryIndex = Number($event.detail.value)">
          <view class="picker-field">
            <view v-if="selectedCategory" class="selected-category">
              <text v-if="selectedCategory.icon">{{ selectedCategory.icon }}</text>
              <text>{{ selectedCategory.name }}</text>
            </view>
            <text v-else class="placeholder">请选择分类</text>
            <text class="chevron">›</text>
          </view>
        </picker>
      </view>

      <view class="field-group">
        <view class="field-label">标题 <text class="required">*</text><text class="counter">{{ form.title.length }}/100</text></view>
        <input v-model="form.title" class="input" maxlength="100" placeholder="用一句话说明你要发布什么" />
      </view>

      <view class="field-group">
        <view class="field-label">详细说明 <text class="required">*</text><text class="counter">{{ form.content.length }}/2000</text></view>
        <textarea v-model="form.content" class="textarea content-input" maxlength="2000" placeholder="补充时间、物品特征、交易方式等细节，让同学更容易帮到你" />
      </view>

      <view class="field-group">
        <view class="field-label">相关地点 <text class="optional">（选填）</text></view>
        <input v-model="form.locationName" class="input" maxlength="120" placeholder="例如：图书馆一楼服务台、东门" />
      </view>

      <view class="field-group field-last">
        <view class="field-label">上传图片 <text class="optional">（最多 3 张）</text></view>
        <view class="image-uploader">
          <view v-if="imageList.length < 3" class="add-image" :class="{ disabled: uploading }" @tap="chooseImages">
            <text class="add-symbol">＋</text>
            <text>{{ uploading ? '上传中' : '添加图片' }}</text>
          </view>
          <view v-for="(image, index) in imageList" :key="image" class="image-item">
            <image class="preview-image" :src="toAbsoluteFileUrl(image)" mode="aspectFill" @tap="previewImage(index)" />
            <view class="remove-image" @tap.stop="removeImage(index)">×</view>
          </view>
        </view>
      </view>
    </view>

    <view class="safe-note">请勿发布违法、诈骗、辱骂或侵犯他人隐私的信息；平台将进行敏感词过滤和人工审核。</view>
    <view class="submit-button" :class="{ disabled: submitting || uploading }" @tap="submit">{{ submitting ? '正在提交…' : '提交审核' }}</view>
  </view>
</template>

<style lang="scss" scoped>
.publish-page { padding-top: 24rpx; }.publish-intro { padding: 16rpx 8rpx 30rpx; }.intro-kicker { display: block; color: #3773b7; font-size: 20rpx; font-weight: 850; letter-spacing: .13em; }.intro-title { margin-top: 12rpx; color: #172b43; font-size: 42rpx; font-weight: 800; letter-spacing: -.04em; }.intro-copy { margin-top: 10rpx; color: #71839a; font-size: 25rpx; line-height: 1.55; }
.form-card { border: 2rpx solid #dfe8f1; border-radius: 26rpx; padding: 28rpx; background: #fff; box-shadow: 0 12rpx 30rpx rgba(25, 55, 84, .055); }.field-group { margin-bottom: 30rpx; }.field-last { margin-bottom: 0; }.field-label { display: flex; align-items: center; gap: 6rpx; margin-bottom: 14rpx; color: #2b4058; font-size: 26rpx; font-weight: 750; }.required { color: #d74949; }.optional { color: #8a9aad; font-size: 22rpx; font-weight: 500; }.counter { margin-left: auto; color: #9aa9b9; font-size: 21rpx; font-weight: 500; }.picker-field { display: flex; align-items: center; justify-content: space-between; min-height: 92rpx; border: 2rpx solid #e1e8f0; border-radius: 18rpx; padding: 0 22rpx; background: #fbfcfe; color: #2d465f; font-size: 27rpx; }.selected-category { display: flex; gap: 10rpx; align-items: center; }.placeholder { color: #a5b1bf; }.chevron { color: #7890a8; font-size: 38rpx; line-height: 1; }.content-input { min-height: 270rpx; line-height: 1.6; }
.image-uploader { display: flex; flex-wrap: wrap; gap: 16rpx; }.add-image, .image-item { width: 178rpx; height: 178rpx; border-radius: 18rpx; }.add-image { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; border: 2rpx dashed #a9bfda; background: #f7faff; color: #3972aa; font-size: 22rpx; }.add-image:active { background: #edf5ff; }.add-image.disabled, .submit-button.disabled { opacity: .56; pointer-events: none; }.add-symbol { font-size: 44rpx; font-weight: 300; line-height: 1; }.image-item { position: relative; overflow: visible; }.preview-image { width: 178rpx; height: 178rpx; border-radius: 18rpx; background: #eef2f7; }.remove-image { position: absolute; top: -12rpx; right: -12rpx; display: flex; width: 42rpx; height: 42rpx; align-items: center; justify-content: center; border: 3rpx solid #fff; border-radius: 50%; background: #c94040; color: #fff; font-size: 28rpx; line-height: 1; }
.safe-note { margin: 24rpx 8rpx; color: #8494a7; font-size: 22rpx; line-height: 1.6; }.submit-button { display: flex; align-items: center; justify-content: center; min-height: 90rpx; border-radius: 19rpx; background: #165dff; color: #fff; font-size: 29rpx; font-weight: 750; box-shadow: 0 12rpx 22rpx rgba(22, 93, 255, .22); }.submit-button:active { transform: translateY(2rpx); background: #0c4fdc; }
</style>
