<script setup lang="ts">
import { computed, nextTick, onErrorCaptured, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const currentTab = ref<'login' | 'register'>('login')
const loading = ref(false)

// #region debug-point A:auth-page-setup
const __dbg = (hypothesisId: string, msg: string, data: Record<string, unknown> = {}) =>
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'auth-page-blank',
      runId: 'pre-fix',
      hypothesisId,
      location: 'src/pages/auth/index.vue',
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => undefined)

__dbg('A', 'auth page setup entered', {
  href: typeof location !== 'undefined' ? location.href : '',
})
if (typeof window !== 'undefined') {
  window.__AUTH_DEBUG_STAGE = 'auth-setup'
}

onErrorCaptured((error, _instance, info) => {
  __dbg('A', 'vue error captured in auth page', {
    info,
    error: String((error as Error)?.stack || (error as Error)?.message || error),
  })
  return false
})

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.__AUTH_DEBUG_STAGE = 'auth-mounted'
  }
  const pageBody = typeof document !== 'undefined' ? document.querySelector('uni-page-body') : null
  const appRoot = typeof document !== 'undefined' ? document.querySelector('#app') : null

  __dbg('B', 'auth page mounted', {
    path: typeof location !== 'undefined' ? location.hash : '',
    pageBodyExists: Boolean(pageBody),
    appChildCount: appRoot?.childNodes?.length ?? 0,
    pageBodyHeight: pageBody instanceof HTMLElement ? pageBody.getBoundingClientRect().height : -1,
    pageBodyText: pageBody?.textContent?.trim()?.slice(0, 80) ?? '',
  })

  nextTick(() => {
    if (typeof window !== 'undefined') {
      window.__AUTH_DEBUG_STAGE = 'auth-next-tick'
    }
    const pageBodyAfterTick = typeof document !== 'undefined' ? document.querySelector('uni-page-body') : null
    __dbg('B', 'auth page nextTick', {
      pageBodyHtml: pageBodyAfterTick?.innerHTML?.slice(0, 200) ?? '',
      documentTitle: typeof document !== 'undefined' ? document.title : '',
    })
  })
})
// #endregion

const loginForm = reactive({
  account: '',
  password: '',
})

const registerForm = reactive({
  student_id: '',
  phone: '',
  password: '',
  nickname: '',
})

const titleText = computed(() => (currentTab.value === 'login' ? '欢迎回来' : '创建校园跑腿账号'))

function goHomeByRole() {
  uni.reLaunch({ url: '/pages/task/hall' })
}

async function onLogin() {
  if (!loginForm.account.trim() || !loginForm.password.trim()) {
    uni.showToast({ title: '请输入账号和密码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await authStore.login(loginForm.account.trim(), loginForm.password.trim())
    await authStore.fetchProfile().catch(() => undefined)
    uni.showToast({ title: '登录成功', icon: 'success' })
    goHomeByRole()
  } catch (error: any) {
    uni.showToast({ title: error.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function onRegister() {
  if (
    !registerForm.student_id.trim() ||
    !registerForm.phone.trim() ||
    !registerForm.password.trim() ||
    !registerForm.nickname.trim()
  ) {
    uni.showToast({ title: '请完整填写注册信息', icon: 'none' })
    return
  }
  if (registerForm.password.trim().length < 6) {
    uni.showToast({ title: '密码至少 6 位', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await authStore.register({
      student_id: registerForm.student_id.trim(),
      phone: registerForm.phone.trim(),
      password: registerForm.password.trim(),
      nickname: registerForm.nickname.trim(),
    })
    uni.showToast({ title: '注册成功，请登录', icon: 'success' })
    currentTab.value = 'login'
    loginForm.account = registerForm.phone.trim() || registerForm.student_id.trim()
    loginForm.password = registerForm.password.trim()
  } catch (error: any) {
    uni.showToast({ title: error.message || '注册失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="page-shell auth-page">
    <view class="hero card">
      <view class="section-title">校园跑腿</view>
      <view class="section-desc">{{ titleText }}</view>

      <view class="tabs">
        <view
          class="tab-item"
          :class="{ active: currentTab === 'login' }"
          @tap="currentTab = 'login'"
        >
          登录
        </view>
        <view
          class="tab-item"
          :class="{ active: currentTab === 'register' }"
          @tap="currentTab = 'register'"
        >
          注册
        </view>
      </view>

      <template v-if="currentTab === 'login'">
        <view class="field-label">账号</view>
        <input v-model="loginForm.account" class="input" placeholder="手机号 / 学号" />
        <view class="field-label">密码</view>
        <input v-model="loginForm.password" class="input" password placeholder="请输入密码" />
        <view class="btn-primary submit-btn" @tap="onLogin">
          {{ loading ? '登录中...' : '立即登录' }}
        </view>
      </template>

      <template v-else>
        <view class="field-label">学号</view>
        <input v-model="registerForm.student_id" class="input" placeholder="请输入学号" />
        <view class="field-label">手机号</view>
        <input v-model="registerForm.phone" class="input" type="number" placeholder="请输入手机号" />
        <view class="field-label">昵称</view>
        <input v-model="registerForm.nickname" class="input" placeholder="请输入昵称" />
        <view class="field-label">密码</view>
        <input v-model="registerForm.password" class="input" password placeholder="至少 6 位" />
        <view class="btn-primary submit-btn" @tap="onRegister">
          {{ loading ? '提交中...' : '完成注册' }}
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.auth-page {
  display: flex;
  align-items: center;
}

.hero {
  width: 100%;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  padding: 12rpx;
  margin: 28rpx 0;
  background: #f3f4f6;
  border-radius: 20rpx;
}

.tab-item {
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  color: #6b7280;
  font-weight: 600;

  &.active {
    background: #ffffff;
    color: #2563eb;
  }
}

.submit-btn {
  margin-top: 32rpx;
}

.field-label:not(:first-child) {
  margin-top: 24rpx;
}
</style>
