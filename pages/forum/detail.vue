<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import type { ForumComment, ForumPost } from '@/types/models'
import { toAbsoluteFileUrl } from '@/utils/format'
import { http } from '@/utils/request'

const authStore = useAuthStore()
const postId = ref(0)
const post = ref<ForumPost | null>(null)
const comments = ref<ForumComment[]>([])
const loading = ref(true)
const submittingComment = ref(false)
const togglingLike = ref(false)
const togglingFavorite = ref(false)
const commentText = ref('')

const isOwnPost = computed(() => String(post.value?.author_id || '') === String(authStore.profile?.id || ''))
const imageUrls = computed(() => (post.value?.images || []).map(toAbsoluteFileUrl))

function unwrap(result: any) {
  return result?.data ?? result ?? {}
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function displayName(author: any) {
  return author?.nickname || '校园同学'
}

function statusLabel(status?: string) {
  const map: Record<string, string> = { PENDING: '审核中', APPROVED: '已通过', REJECTED: '未通过', HIDDEN: '已隐藏' }
  return map[status || ''] || status || ''
}

async function fetchDetail() {
  if (!postId.value) return
  loading.value = true
  try {
    const data = unwrap(await http.get<any>(`/forum/posts/${postId.value}`))
    post.value = data.post || null
    comments.value = Array.isArray(data.comments) ? data.comments : []
  } catch (error: any) {
    uni.showToast({ title: error?.message || '信息加载失败', icon: 'none' })
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function previewImages(index: number) {
  if (!imageUrls.value.length) return
  uni.previewImage({ urls: imageUrls.value, current: imageUrls.value[index] })
}

async function toggleLike() {
  if (!post.value || togglingLike.value) return
  togglingLike.value = true
  const liked = !post.value.is_liked
  try {
    const result = unwrap(liked ? await http.post(`/forum/posts/${post.value.id}/like`) : await http.delete(`/forum/posts/${post.value.id}/like`))
    post.value.is_liked = liked
    post.value.like_count = Number(result.like_count ?? post.value.like_count + (liked ? 1 : -1))
  } catch (error: any) {
    uni.showToast({ title: error?.message || '操作失败', icon: 'none' })
  } finally {
    togglingLike.value = false
  }
}

async function toggleFavorite() {
  if (!post.value || togglingFavorite.value) return
  togglingFavorite.value = true
  const favorited = !post.value.is_favorited
  try {
    const result = unwrap(favorited ? await http.post(`/forum/posts/${post.value.id}/favorite`) : await http.delete(`/forum/posts/${post.value.id}/favorite`))
    post.value.is_favorited = favorited
    post.value.favorite_count = Number(result.favorite_count ?? post.value.favorite_count + (favorited ? 1 : -1))
  } catch (error: any) {
    uni.showToast({ title: error?.message || '操作失败', icon: 'none' })
  } finally {
    togglingFavorite.value = false
  }
}

async function submitComment() {
  if (!post.value || submittingComment.value) return
  const content = commentText.value.trim()
  if (!content) return
  submittingComment.value = true
  try {
    const result = unwrap(await http.post<any>(`/forum/posts/${post.value.id}/comments`, { content }))
    if (result.comment) {
      comments.value.push(result.comment)
      post.value.comment_count += 1
    }
    commentText.value = ''
    uni.showToast({ title: '评论已发布', icon: 'success' })
  } catch (error: any) {
    uni.showToast({ title: error?.message || '评论发布失败', icon: 'none' })
  } finally {
    submittingComment.value = false
  }
}

async function deleteComment(comment: ForumComment) {
  const result = await new Promise<UniApp.ShowModalRes>((resolve) => {
    uni.showModal({ title: '删除评论', content: '删除后将不再对其他用户展示。', confirmColor: '#c64040', success: resolve })
  })
  if (!result.confirm) return
  try {
    await http.delete(`/forum/comments/${comment.id}`)
    comments.value = comments.value.filter((item) => item.id !== comment.id)
    if (post.value) post.value.comment_count = Math.max(0, post.value.comment_count - 1)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '删除失败', icon: 'none' })
  }
}

async function deletePost() {
  if (!post.value) return
  const result = await new Promise<UniApp.ShowModalRes>((resolve) => {
    uni.showModal({ title: '删除信息', content: '删除后该信息将不再公开展示。', confirmColor: '#c64040', success: resolve })
  })
  if (!result.confirm) return
  try {
    await http.delete(`/forum/posts/${post.value.id}`)
    uni.showToast({ title: '已删除', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '删除失败', icon: 'none' })
  }
}

onLoad(async (options) => {
  postId.value = Number(options?.id || 0)
  await authStore.bootstrap()
  await fetchDetail()
})

onPullDownRefresh(() => {
  void fetchDetail()
})
</script>

<template>
  <view class="page-shell detail-page">
    <view v-if="loading" class="loading-card">
      <view class="loading-line short" /><view class="loading-line" /><view class="loading-line medium" />
    </view>

    <template v-else-if="post">
      <view v-if="post.status !== 'APPROVED'" class="review-notice" :class="`notice-${post.status.toLowerCase()}`">
        <view class="notice-title">{{ statusLabel(post.status) }}</view>
        <view v-if="post.status === 'PENDING'">该信息仅你和管理员可见，审核通过后将公开展示。</view>
        <view v-else-if="post.audit_note">审核说明：{{ post.audit_note }}</view>
        <view v-else>该信息当前不可公开展示。</view>
      </view>

      <view class="post-card">
        <view class="post-meta">
          <view class="category-pill"><text v-if="post.category?.icon">{{ post.category.icon }}</text>{{ post.category?.name || '校园信息' }}</view>
          <view v-if="isOwnPost" class="delete-link" @tap="deletePost">删除</view>
        </view>
        <view class="post-title">{{ post.title }}</view>
        <view class="author-row">
          <image v-if="post.author?.avatar" class="author-avatar" :src="toAbsoluteFileUrl(post.author.avatar)" mode="aspectFill" />
          <view v-else class="author-avatar avatar-fallback">{{ displayName(post.author).slice(0, 1) }}</view>
          <view>
            <view class="author-name">{{ displayName(post.author) }}</view>
            <view class="post-time">{{ formatTime(post.created_at) }}</view>
          </view>
        </view>
        <view class="post-content">{{ post.content }}</view>
        <view v-if="post.images?.length" class="image-grid" :class="`image-count-${Math.min(post.images.length, 3)}`">
          <image v-for="(image, index) in post.images" :key="image" :src="toAbsoluteFileUrl(image)" class="content-image" mode="aspectFill" @tap="previewImages(index)" />
        </view>
        <view v-if="post.location_name" class="location-chip">⌖ {{ post.location_name }}</view>
        <view v-if="post.status === 'APPROVED'" class="engagement-bar">
          <view class="engagement-button" :class="{ active: post.is_liked }" @tap="toggleLike">{{ post.is_liked ? '♥' : '♡' }} {{ post.like_count }}</view>
          <view class="engagement-button">◌ {{ post.comment_count }}</view>
          <view class="engagement-button" :class="{ active: post.is_favorited }" @tap="toggleFavorite">{{ post.is_favorited ? '★' : '☆' }} 收藏</view>
        </view>
      </view>

      <view v-if="post.status === 'APPROVED'" class="comments-section">
        <view class="section-heading"><text>评论</text><text class="comment-total">{{ comments.length }}</text></view>
        <view v-if="comments.length === 0" class="comment-empty">还没有评论，说点什么吧。</view>
        <view v-for="comment in comments" :key="comment.id" class="comment-item">
          <image v-if="comment.author?.avatar" class="comment-avatar" :src="toAbsoluteFileUrl(comment.author.avatar)" mode="aspectFill" />
          <view v-else class="comment-avatar avatar-fallback">{{ displayName(comment.author).slice(0, 1) }}</view>
          <view class="comment-body">
            <view class="comment-top"><text class="comment-name">{{ displayName(comment.author) }}</text><text class="comment-time">{{ formatTime(comment.created_at) }}</text></view>
            <view class="comment-content">{{ comment.content }}</view>
          </view>
          <view v-if="String(comment.author_id) === String(authStore.profile?.id || '')" class="comment-delete" @tap="deleteComment(comment)">删除</view>
        </view>
      </view>
    </template>

    <view v-if="post?.status === 'APPROVED'" class="comment-composer">
      <input v-model="commentText" class="composer-input" maxlength="300" confirm-type="send" placeholder="说点友善的话…" @confirm="submitComment" />
      <view class="send-button" :class="{ disabled: !commentText.trim() || submittingComment }" @tap="submitComment">{{ submittingComment ? '发送中' : '发送' }}</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.detail-page { padding-top: 22rpx; padding-bottom: 162rpx; }.loading-card, .post-card { border: 2rpx solid #e2eaf2; border-radius: 26rpx; padding: 28rpx; background: #fff; box-shadow: 0 10rpx 26rpx rgba(25, 53, 79, .05); }.loading-line { height: 28rpx; margin-top: 20rpx; border-radius: 999rpx; background: linear-gradient(90deg, #edf1f5, #f7f9fb, #edf1f5); background-size: 200% 100%; animation: shimmer 1.2s infinite; }.loading-line.short { width: 30%; margin-top: 0; }.loading-line.medium { width: 65%; } @keyframes shimmer { to { background-position: -200% 0; } }
.review-notice { margin-bottom: 18rpx; border-radius: 20rpx; padding: 20rpx 22rpx; font-size: 24rpx; line-height: 1.55; }.notice-title { margin-bottom: 4rpx; font-size: 27rpx; font-weight: 750; }.notice-pending { background: #fff6e1; color: #8d650e; }.notice-rejected, .notice-hidden { background: #fff0f0; color: #b44040; }
.post-meta, .author-row, .engagement-bar, .section-heading, .comment-item, .comment-top { display: flex; align-items: center; }.post-meta { justify-content: space-between; }.category-pill { display: inline-flex; gap: 6rpx; align-items: center; border-radius: 10rpx; padding: 7rpx 12rpx; background: #eaf3ff; color: #276297; font-size: 21rpx; font-weight: 750; }.delete-link { color: #c34040; font-size: 23rpx; }.post-title { margin-top: 18rpx; color: #172c43; font-size: 42rpx; font-weight: 800; letter-spacing: -.04em; line-height: 1.3; }.author-row { gap: 12rpx; margin-top: 24rpx; }.author-avatar, .comment-avatar { width: 58rpx; height: 58rpx; flex: 0 0 auto; border-radius: 50%; background: #e7edf5; }.avatar-fallback { display: flex; align-items: center; justify-content: center; background: #dcebff; color: #2860a2; font-size: 24rpx; font-weight: 750; }.author-name { color: #38536e; font-size: 24rpx; font-weight: 700; }.post-time { margin-top: 3rpx; color: #96a5b5; font-size: 21rpx; }.post-content { margin-top: 26rpx; color: #344d65; font-size: 29rpx; line-height: 1.8; white-space: pre-wrap; word-break: break-word; }.image-grid { display: grid; gap: 10rpx; margin-top: 22rpx; }.image-count-1 { grid-template-columns: 1fr; }.image-count-2 { grid-template-columns: repeat(2, 1fr); }.image-count-3 { grid-template-columns: repeat(3, 1fr); }.content-image { width: 100%; aspect-ratio: 1 / 1; border-radius: 14rpx; background: #eef2f6; }.image-count-1 .content-image { aspect-ratio: 4 / 3; }.location-chip { display: inline-flex; margin-top: 20rpx; border-radius: 10rpx; padding: 10rpx 13rpx; background: #f3f7fb; color: #5d7894; font-size: 23rpx; }.engagement-bar { gap: 10rpx; margin-top: 26rpx; padding-top: 20rpx; border-top: 2rpx solid #eaf0f5; }.engagement-button { display: inline-flex; min-height: 56rpx; align-items: center; border-radius: 12rpx; padding: 0 16rpx; background: #f6f8fb; color: #657990; font-size: 23rpx; }.engagement-button.active { background: #e9f1ff; color: #165dff; font-weight: 750; }
.comments-section { margin-top: 24rpx; border-top: 2rpx solid #e1e9f1; padding: 26rpx 8rpx 0; }.section-heading { gap: 10rpx; color: #203950; font-size: 31rpx; font-weight: 800; }.comment-total { color: #95a5b4; font-size: 22rpx; }.comment-empty { padding: 52rpx 0; color: #94a3b4; font-size: 25rpx; text-align: center; }.comment-item { align-items: flex-start; gap: 14rpx; padding: 24rpx 0; border-bottom: 2rpx solid #ecf1f5; }.comment-avatar { width: 50rpx; height: 50rpx; }.comment-body { min-width: 0; flex: 1; }.comment-top { gap: 10rpx; }.comment-name { color: #42617e; font-size: 23rpx; font-weight: 750; }.comment-time { color: #a0adba; font-size: 20rpx; }.comment-content { margin-top: 8rpx; color: #42596f; font-size: 26rpx; line-height: 1.55; word-break: break-word; }.comment-delete { color: #ad7780; font-size: 20rpx; }
.comment-composer { position: fixed; z-index: 10; right: 0; bottom: 0; left: 0; display: flex; align-items: center; gap: 14rpx; border-top: 2rpx solid #dfe8f0; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,.98); }.composer-input { min-width: 0; flex: 1; height: 68rpx; border-radius: 15rpx; padding: 0 18rpx; background: #f3f6fa; color: #304a63; font-size: 25rpx; }.send-button { display: flex; height: 68rpx; align-items: center; justify-content: center; border-radius: 15rpx; padding: 0 20rpx; background: #165dff; color: #fff; font-size: 24rpx; font-weight: 750; }.send-button.disabled { opacity: .55; pointer-events: none; }
</style>
