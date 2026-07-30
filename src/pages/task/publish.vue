<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ITEM_TYPES } from '@/config'
import { useAuthStore } from '@/stores/auth'
import type { LocationPoint } from '@/types/models'
import { formatMoney, toAbsoluteFileUrl } from '@/utils/format'
import { uploadImage, http } from '@/utils/request'

const authStore = useAuthStore()

const form = reactive({
  pickup: null as LocationPoint | null,
  delivery: null as LocationPoint | null,
  itemType: ITEM_TYPES[0],
  urgency: '普通',
  tip: 0,
  remark: '',
})

const imageList = ref<string[]>([])
const submitting = ref(false)
const loadingCount = ref(0)
const feePreview = computed(() => {
  const base = 3
  const urgent = form.urgency === '加急' ? 4 : 0
  return base + urgent
})

function safeShowLoading(title = '加载中...') {
  if (loadingCount.value === 0) {
    uni.showLoading({ title, mask: true })
  }
  loadingCount.value++
}

function safeHideLoading() {
  loadingCount.value = Math.max(0, loadingCount.value - 1)
  if (loadingCount.value === 0) {
    try {
      uni.hideLoading()
    } catch (e) {
    }
  }
}

function forceHideLoading() {
  if (loadingCount.value > 0) {
    loadingCount.value = 0
    try {
      uni.hideLoading()
    } catch (e) {
    }
  }
}

async function processFiles(files: File[]) {
  safeShowLoading('上传中...')
  try {
    const uploaded = await Promise.all(
      files.map((file) => uploadImage('', 'image', file)),
    )
    imageList.value = [...imageList.value, ...uploaded].slice(0, 3)
  } catch (error: any) {
    uni.showToast({ title: error.message || '图片上传失败', icon: 'none' })
  } finally {
    safeHideLoading()
  }
}

async function ensureLogin() {
  await authStore.bootstrap()
  if (!authStore.isLogin) {
    uni.redirectTo({ url: '/pages/auth/index' })
    return false
  }
  return true
}

async function pickLocation(type: 'pickup' | 'delivery') {
  if (!(await ensureLogin())) return
  uni.chooseLocation({
    success: (res) => {
      const point = {
        address: res.address || res.name || '已选位置',
        latitude: res.latitude,
        longitude: res.longitude,
        name: res.name,
      }
      if (type === 'pickup') form.pickup = point
      else form.delivery = point
    },
    fail: () => {
      uni.showToast({ title: '选点已取消', icon: 'none' })
    },
  })
}

function chooseImages() {
  if (imageList.value.length >= 3) {
    uni.showToast({ title: '最多上传 3 张图片', icon: 'none' })
    return
  }
  const isH5 = typeof window !== 'undefined'
  if (isH5 && typeof document !== 'undefined') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.style.display = 'none'
    let handled = false
    const cleanup = () => {
      if (!handled) {
        handled = true
        try {
          document.body.removeChild(input)
        } catch (e) {
        }
      }
    }
    input.addEventListener('change', (e) => {
      try {
        const target = e.target as HTMLInputElement
        if (target && target.files && target.files.length > 0) {
          const remaining = 3 - imageList.value.length
          const files = Array.from(target.files).slice(0, Math.max(0, remaining))
          if (files.length > 0) {
            processFiles(files)
          }
        }
      } finally {
        cleanup()
      }
    })
    input.addEventListener('cancel', cleanup)
    input.addEventListener('error', cleanup)
    setTimeout(cleanup, 60000)
    try {
      document.body.appendChild(input)
    } catch (e) {
    }
    try {
      input.click()
    } catch (e) {
      cleanup()
      uni.showToast({ title: '无法打开文件选择器', icon: 'none' })
    }
    return
  }
  uni.chooseImage({
    count: 3 - imageList.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      safeShowLoading('上传中...')
      try {
        const files = res.tempFilePaths || (res.tempFiles && res.tempFiles.map((f: any) => f.path)) || []
        const rawFiles = res.tempFiles || []
        if (files.length === 0) {
          uni.showToast({ title: '未选择图片', icon: 'none' })
          return
        }
        const uploaded = await Promise.all(
          files.map((filePath: string, idx: number) =>
            uploadImage(filePath, 'image', rawFiles[idx] || undefined),
          ),
        )
        imageList.value = [...imageList.value, ...uploaded].slice(0, 3)
      } catch (error: any) {
        uni.showToast({ title: error.message || '图片上传失败', icon: 'none' })
      } finally {
        safeHideLoading()
      }
    },
    fail: (err) => {
      if (err && err.errMsg && err.errMsg.toLowerCase().indexOf('cancel') === -1) {
        uni.showToast({ title: err.errMsg || '选择图片失败', icon: 'none' })
      }
    },
  })
}

function previewImage(index: number) {
  uni.previewImage({
    urls: imageList.value.map((item) => toAbsoluteFileUrl(item)),
    current: toAbsoluteFileUrl(imageList.value[index]),
  })
}

function removeImage(index: number) {
  imageList.value.splice(index, 1)
}

async function submitTask() {
  if (!(await ensureLogin())) return
  if (!form.pickup || !form.delivery) {
    uni.showToast({ title: '请先完成地图选点', icon: 'none' })
    return
  }
  if (!form.itemType) {
    uni.showToast({ title: '请选择物品类型', icon: 'none' })
    return
  }
  if (imageList.value.length === 0) {
    uni.showToast({ title: '请至少上传 1 张图片', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await http.post('/task/publish', {
      pickup_address: form.pickup.address,
      delivery_address: form.delivery.address,
      pickup_lat: form.pickup.latitude,
      pickup_lng: form.pickup.longitude,
      delivery_lat: form.delivery.latitude,
      delivery_lng: form.delivery.longitude,
      type: form.itemType,
      task_type: form.itemType,
      urgency: form.urgency === '加急' ? 1 : 0,
      fee_total: feePreview.value,
      tip: Number(form.tip || 0),
      remark: form.remark.trim(),
      images: imageList.value,
      images_json: JSON.stringify(imageList.value),
    })
    uni.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: '/pages/order/published' })
    }, 400)
  } catch (error: any) {
    uni.showToast({ title: error.message || '发布失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page-shell">
    <view class="card">
      <view class="section-title">发布任务</view>
      <view class="section-desc">支持地图选点、1-3 张图片上传、物品类型、时效和小费配置</view>

      <view class="field-label">取件地址</view>
      <view class="picker-like" @tap="pickLocation('pickup')">
        {{ form.pickup?.address || '点击使用 uni.chooseLocation 选择取件点' }}
      </view>

      <view class="field-label">送达地址</view>
      <view class="picker-like" @tap="pickLocation('delivery')">
        {{ form.delivery?.address || '点击使用 uni.chooseLocation 选择送达点' }}
      </view>

      <view class="field-label">物品类型</view>
      <picker :value="ITEM_TYPES.indexOf(form.itemType)" :range="ITEM_TYPES" @change="form.itemType = ITEM_TYPES[$event.detail.value]">
        <view class="picker-like">{{ form.itemType }}</view>
      </picker>

      <view class="field-label">时效</view>
      <view class="grid-2">
        <view class="picker-like" :class="{ active: form.urgency === '普通' }" @tap="form.urgency = '普通'">普通</view>
        <view class="picker-like" :class="{ active: form.urgency === '加急' }" @tap="form.urgency = '加急'">加急</view>
      </view>

      <view class="field-label">小费</view>
      <input v-model="form.tip" class="input" type="digit" placeholder="可选，默认 0" />

      <view class="field-label">备注</view>
      <textarea v-model="form.remark" class="textarea" maxlength="200" placeholder="如：易碎、请尽快联系我" />

      <view class="field-label">上传图片（1-3张）</view>
      <view class="thumb-list">
        <view class="upload-box" @tap="chooseImages">+</view>
        <view v-for="(item, index) in imageList" :key="item" class="image-wrapper">
          <image class="thumb-image" :src="toAbsoluteFileUrl(item)" mode="aspectFill" @tap="previewImage(index)" />
          <view class="delete-dot" @tap.stop="removeImage(index)">x</view>
        </view>
      </view>

      <view class="fee-card">
        <view class="row-between">
          <text class="muted">配送费预估</text>
          <text class="primary">{{ formatMoney(feePreview) }}</text>
        </view>
        <view class="row-between fee-total">
          <text class="muted">总额（含小费）</text>
          <text class="success">{{ formatMoney(Number(feePreview) + Number(form.tip || 0)) }}</text>
        </view>
      </view>

      <view class="btn-primary submit-btn" @tap="submitTask">
        {{ submitting ? '提交中...' : '确认发布任务' }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.active {
  border-color: #2563eb;
  color: #2563eb;
  background: #eff6ff;
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

.image-wrapper {
  position: relative;
  flex-shrink: 0;
}

.delete-dot {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.7);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
}

.fee-card {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #f9fafb;
}

.fee-total {
  margin-top: 18rpx;
}

.submit-btn {
  margin-top: 28rpx;
}

.field-label:not(:first-child) {
  margin-top: 24rpx;
}
</style>
