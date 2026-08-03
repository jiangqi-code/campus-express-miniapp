<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { http } from '@/utils/request'
import { scrollToFirstError } from '@/utils/experience'
import { parseIdCard } from '@/utils/idCard'
import CouponWelcomeModal from '@/components/CouponWelcomeModal.vue'

const authStore = useAuthStore()
const currentTab = ref<'login' | 'register'>('login')
const loading = ref(false)
const codeSending = ref(false)
const countdown = ref(0)
const showLoginPassword = ref(false)
const showRegisterPassword = ref(false)
const verifiedPhone = ref('')
const welcomeCoupons = ref<any[]>([])
let countdownTimer: ReturnType<typeof setInterval> | undefined

const PHONE_RE = /^1[3-9]\d{9}$/
const STUDENT_ID_RE = /^[A-Za-z0-9]{6,20}$/
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,32}$/

const errors = reactive({ account: '', loginPassword: '', student_id: '', phone: '', nickname: '', password: '', code: '', id_card: '' })


const loginForm = reactive({
  account: '',
  password: '',
})

const registerForm = reactive({
  student_id: '',
  phone: '',
  password: '',
  nickname: '',
  code: '',
  birth_date: '',
  id_card: '',
})

const titleText = computed(() => (currentTab.value === 'login' ? '欢迎回来' : '创建校园跑腿账号'))

function goHomeByRole() {
  uni.reLaunch({ url: '/pages/index/index' })
}

function validateLogin() {
  const account = loginForm.account.trim()
  errors.account = !account
    ? '请输入手机号或学号'
    : PHONE_RE.test(account) || STUDENT_ID_RE.test(account)
      ? ''
      : '手机号或学号格式不正确'
  errors.loginPassword = loginForm.password ? '' : '请输入密码'
  return !errors.account && !errors.loginPassword
}

function validateRegister() {
  errors.student_id = STUDENT_ID_RE.test(registerForm.student_id.trim()) ? '' : '学号需为6-20位字母或数字'
  errors.phone = PHONE_RE.test(registerForm.phone.trim()) ? '' : '请输入正确的11位手机号'
  errors.nickname = registerForm.nickname.trim() ? '' : '请输入昵称'
  errors.password = PASSWORD_RE.test(registerForm.password) ? '' : '密码需为8-32位，且包含字母和数字'
  errors.code = /^\d{6}$/.test(registerForm.code) ? '' : '验证码必须是6位数字'
  errors.id_card = registerForm.id_card && !parseIdCard(registerForm.id_card).isValid ? '身份证号格式或校验位不正确' : ''
  return !errors.student_id && !errors.phone && !errors.nickname && !errors.password && !errors.code && !errors.id_card
}

watch(() => registerForm.phone, () => {
  if (registerForm.phone.trim() !== verifiedPhone.value) verifiedPhone.value = ''
})
watch(() => registerForm.id_card, value => {
  const parsed=parseIdCard(value)
  errors.id_card=value&&!parsed.isValid?'身份证号格式或校验位不正确':''
  if(parsed.isValid)registerForm.birth_date=parsed.birthDate
})
function chooseBirthDate(event:any){registerForm.birth_date=event.detail.value}

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

function startCountdown(seconds = 60) {
  countdown.value = seconds
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = undefined
    }
  }, 1000)
}

async function sendCode() {
  if (loading.value || codeSending.value || countdown.value > 0) return
  const phone = registerForm.phone.trim()
  errors.phone = PHONE_RE.test(phone) ? '' : '请输入正确的11位手机号'
  if (errors.phone) return
  codeSending.value = true
  try {
    const result = await http.post<any>('/auth/send-code', { phone }, false)
    startCountdown(Number(result?.resendAfter || 60))
    uni.showToast({ title: result?.mockCode ? `模拟验证码 ${result.mockCode}` : '验证码已发送', icon: 'none' })
  } catch (error: any) {
    uni.showToast({ title: error.message || '验证码发送失败', icon: 'none' })
  } finally {
    codeSending.value = false
  }
}

async function onLogin() {
  if (loading.value) return
  if (!validateLogin()) { scrollToFirstError(); return }
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
  if (loading.value) return
  if (!validateRegister()) { scrollToFirstError(); return }
  loading.value = true
  try {
    const verification = await http.post<any>('/auth/verify-code', {
      phone: registerForm.phone.trim(),
      code: registerForm.code,
    }, false)
    if (!verification?.verified) throw new Error('验证码校验失败')
    verifiedPhone.value = registerForm.phone.trim()
    await authStore.register({
      student_id: registerForm.student_id.trim(),
      phone: registerForm.phone.trim(),
      password: registerForm.password.trim(),
      nickname: registerForm.nickname.trim(),
      birthDate: registerForm.birth_date || undefined,
      idCard: registerForm.id_card.trim() || undefined,
    })
    const welcome=await http.post<any>('/coupons/welcome',{})
    welcomeCoupons.value=(welcome?.data??welcome)?.coupons??[]
    uni.showToast({ title: '注册成功', icon: 'success' })
    if(!welcomeCoupons.value.length)goHomeByRole()
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
        <input v-model="loginForm.account" class="input" placeholder="手机号 / 学号" @input="errors.account = ''" />
        <view v-if="errors.account" class="field-error">{{ errors.account }}</view>
        <view class="field-label">密码</view>
        <view class="password-field">
          <input v-model="loginForm.password" class="input" :password="!showLoginPassword" placeholder="请输入密码" @input="errors.loginPassword = ''" />
          <view class="password-toggle" @tap="showLoginPassword = !showLoginPassword">{{ showLoginPassword ? '隐藏' : '显示' }}</view>
        </view>
        <view v-if="errors.loginPassword" class="field-error">{{ errors.loginPassword }}</view>
        <view class="btn-primary submit-btn" :class="{ disabled: loading }" @tap="onLogin">
          {{ loading ? '登录中...' : '立即登录' }}
        </view>
      </template>

      <template v-else>
        <view class="field-label">学号</view>
        <input v-model="registerForm.student_id" class="input" maxlength="20" placeholder="6-20位字母或数字" @input="errors.student_id = ''" />
        <view v-if="errors.student_id" class="field-error">{{ errors.student_id }}</view>
        <view class="field-label">手机号</view>
        <input v-model="registerForm.phone" class="input" type="number" maxlength="11" placeholder="请输入11位手机号" @input="errors.phone = ''" />
        <view v-if="errors.phone" class="field-error">{{ errors.phone }}</view>
        <view class="field-label">手机验证码</view>
        <view class="code-row">
          <input v-model="registerForm.code" class="input code-input" type="number" maxlength="6" placeholder="6位验证码" @input="errors.code = ''" />
          <button class="code-button" :disabled="countdown > 0 || codeSending || loading" @tap="sendCode">
            {{ countdown > 0 ? `${countdown}s` : codeSending ? '发送中' : '获取验证码' }}
          </button>
        </view>
        <view v-if="errors.code" class="field-error">{{ errors.code }}</view>
        <view class="field-label">昵称</view>
        <input v-model="registerForm.nickname" class="input" placeholder="请输入昵称" @input="errors.nickname = ''" />
        <view v-if="errors.nickname" class="field-error">{{ errors.nickname }}</view>
        <view class="field-label">出生日期</view>
        <picker mode="date" :value="registerForm.birth_date" :end="new Date().toISOString().slice(0,10)" @change="chooseBirthDate">
          <view class="input picker-value" :class="{placeholder:!registerForm.birth_date}">{{registerForm.birth_date||'请选择出生日期'}}</view>
        </picker>
        <view class="field-label">身份证号（选填）</view>
        <input v-model="registerForm.id_card" class="input" maxlength="18" placeholder="输入后自动解析生日" @input="errors.id_card=''" />
        <view v-if="errors.id_card" class="field-error">{{errors.id_card}}</view>
        <view class="field-label">密码</view>
        <view class="password-field">
          <input v-model="registerForm.password" class="input" :password="!showRegisterPassword" placeholder="8-32位，包含字母和数字" @input="errors.password = ''" />
          <view class="password-toggle" @tap="showRegisterPassword = !showRegisterPassword">{{ showRegisterPassword ? '隐藏' : '显示' }}</view>
        </view>
        <view v-if="errors.password" class="field-error">{{ errors.password }}</view>
        <view class="btn-primary submit-btn" :class="{ disabled: loading }" @tap="onRegister">
          {{ loading ? '提交中...' : '完成注册' }}
        </view>
      </template>
    </view>
    <CouponWelcomeModal v-if="welcomeCoupons.length" :items="welcomeCoupons" @close="goHomeByRole" @claimed="()=>uni.reLaunch({url:'/pages/coupon/index'})" />
  </view>
</template>

<style lang="scss" scoped>
.auth-page {
  display: flex;
  align-items: center;
  padding-top: max(32rpx, env(safe-area-inset-top));
  padding-bottom: max(32rpx, env(safe-area-inset-bottom));
}

.hero {
  width: 100%;
  max-width: 680rpx;
  margin: auto;
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

.field-error { margin-top: 8rpx; color: #f53f3f; font-size: 22rpx; }
.password-field { position: relative; }
.password-field .input { padding-right: 116rpx; }
.password-toggle {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  width: 108rpx;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: #165dff;
  font-size: 24rpx;
}
.code-row { display: grid; grid-template-columns: minmax(0, 1fr) 210rpx; gap: 16rpx; }
.code-button {
  height: 84rpx;
  border-radius: 16rpx;
  background: #eef3ff;
  color: #165dff;
  font-size: 24rpx;
  font-weight: 600;
}
.code-button[disabled] { opacity: 0.55; }
.picker-value{display:flex;align-items:center}.placeholder{color:#9ca3af}

@media screen and (max-width: 375px) {
  .auth-page { padding-right: 20rpx; padding-left: 20rpx; }
  .hero { border: 0; padding: 24rpx; box-shadow: none; }
  .code-row { grid-template-columns: minmax(0, 1fr) 190rpx; }
}
</style>
