export type UserRole = 'user' | 'runner' | 'admin'
export type RunnerAuthStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'

export interface LocationPoint {
  address: string
  latitude: number
  longitude: number
  name?: string
}

export interface UserProfile {
  birthDate?: string
  idCard?: string
  id: string
  nickname: string
  phone: string
  studentId?: string
  avatar?: string
  role: UserRole
  creditScore?: number
  walletBalance?: number
}

export interface TaskItem {
  id: string
  pickup_address?: string
  delivery_address?: string
  pickup_lat?: number
  pickup_lng?: number
  delivery_lat?: number
  delivery_lng?: number
  task_type?: string
  type?: string
  fee_total?: number
  tip?: number
  remark?: string
  status?: string
  created_at?: string
  images?: string[]
  item_image?: string
  publisher?: Record<string, any>
  runner?: Record<string, any>
  order_id?: string
  distance?: number
}

export interface OrderItem {
  id: string
  order_id?: string
  task_id?: string
  pickup_address?: string
  delivery_address?: string
  amount?: number
  fee_total?: number
  tip?: number
  status?: string
  created_at?: string
  task?: TaskItem
  runner?: Record<string, any>
  publisher?: Record<string, any>
  pickup_photo_url?: string
  delivery_photo_url?: string
}

export interface MessageItem {
  id: number
  title: string
  content: string
  type: string
  is_read: boolean
  created_at: string
  related_id?: number | string | null
  conversation_id?: string | null
  sender_name?: string | null
  sender_avatar?: string | null
}
