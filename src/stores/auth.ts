import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { STORAGE_KEYS } from '@/config'
import type { RunnerAuthStatus, UserProfile, UserRole } from '@/types/models'
import { http } from '@/utils/request'
import { getStorage, removeStorage, setStorage } from '@/utils/storage'

function normalizeRole(value: unknown): UserRole {
  const text = String(value ?? '').trim().toLowerCase()
  if (text === 'runner') return 'runner'
  if (text === 'admin') return 'admin'
  return 'user'
}

function normalizeRunnerAuthStatus(value: unknown): RunnerAuthStatus {
  const text = String(value ?? '').trim().toUpperCase()
  if (text === 'APPROVED') return 'APPROVED'
  if (text === 'REJECTED') return 'REJECTED'
  if (text === 'PENDING') return 'PENDING'
  return 'NONE'
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const role = ref<UserRole>('user')
  const profile = ref<UserProfile | null>(null)
  const runnerAuthStatus = ref<RunnerAuthStatus>('NONE')

  const isLogin = computed(() => Boolean(token.value))

  async function bootstrap() {
    token.value = await getStorage(STORAGE_KEYS.token, '')
    role.value = normalizeRole(await getStorage(STORAGE_KEYS.role, 'user'))
    profile.value = await getStorage<UserProfile | null>(STORAGE_KEYS.profile, null)
  }

  async function persist() {
    await Promise.all([
      setStorage(STORAGE_KEYS.token, token.value),
      setStorage(STORAGE_KEYS.role, role.value),
      setStorage(STORAGE_KEYS.profile, profile.value),
    ])
  }

  async function login(account: string, password: string) {
    const result = await http.post<any>('/auth/login', { account, password }, false)
    const user = result?.user ?? result?.data?.user ?? result?.data ?? {}
    token.value = String(result?.token ?? result?.data?.token ?? '').trim()
    role.value = normalizeRole(user?.role ?? result?.role)
    profile.value = {
      id: String(user?.id ?? user?.user_id ?? ''),
      nickname: String(user?.nickname ?? '同学'),
      phone: String(user?.phone ?? ''),
      studentId: String(user?.student_id ?? user?.studentId ?? ''),
      avatar: String(user?.avatar ?? user?.avatar_url ?? ''),
      role: role.value,
      creditScore: Number(user?.credit_score ?? user?.creditScore ?? 0),
    }
    await persist()
    return result
  }

  async function register(payload: { student_id: string; phone: string; password: string; nickname: string; birth_date?:string; id_card?:string }) {
    return http.post('/auth/register', payload, false)
  }

  async function fetchProfile() {
    const result = await http.get<any>('/auth/me')
    const user = result?.user ?? result?.data?.user ?? result?.data ?? result ?? {}
    profile.value = {
      id: String(user?.id ?? user?.user_id ?? profile.value?.id ?? ''),
      nickname: String(user?.nickname ?? profile.value?.nickname ?? '同学'),
      phone: String(user?.phone ?? profile.value?.phone ?? ''),
      studentId: String(user?.student_id ?? user?.studentId ?? profile.value?.studentId ?? ''),
      avatar: String(user?.avatar ?? user?.avatar_url ?? profile.value?.avatar ?? ''),
      role: normalizeRole(user?.role ?? role.value),
      creditScore: Number(user?.credit_score ?? user?.creditScore ?? profile.value?.creditScore ?? 0),
      walletBalance: Number(user?.wallet_balance ?? user?.walletBalance ?? profile.value?.walletBalance ?? 0),
      birthDate: String(user?.birth_date ?? user?.birthDate ?? profile.value?.birthDate ?? ''),
      idCard: String(user?.id_card ?? user?.idCard ?? profile.value?.idCard ?? ''),
    }
    role.value = profile.value.role
    await persist()
    return profile.value
  }

  async function fetchRunnerAuth() {
    try {
      const result = await http.get<any>('/user/auth-status')
      runnerAuthStatus.value = normalizeRunnerAuthStatus(
        result?.data?.authStatus ?? result?.authStatus ?? result?.status ?? result?.data?.status,
      )
    } catch {
      runnerAuthStatus.value = 'NONE'
    }
    return runnerAuthStatus.value
  }

  async function switchRole(nextRole: UserRole) {
    await http.put('/user/switch-role', { role: nextRole.toUpperCase() })
    role.value = nextRole
    if (profile.value) profile.value.role = nextRole
    await persist()
  }

  async function logout() {
    token.value = ''
    role.value = 'user'
    profile.value = null
    runnerAuthStatus.value = 'NONE'
    await Promise.all([
      removeStorage(STORAGE_KEYS.token),
      removeStorage(STORAGE_KEYS.role),
      removeStorage(STORAGE_KEYS.profile),
    ])
  }

  return {
    token,
    role,
    profile,
    runnerAuthStatus,
    isLogin,
    bootstrap,
    login,
    register,
    fetchProfile,
    fetchRunnerAuth,
    switchRole,
    logout,
  }
})
