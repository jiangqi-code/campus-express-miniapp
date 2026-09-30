export type UserRole = 'user' | 'runner' | 'merchant' | 'admin'
export type RunnerAuthStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'

export interface LocationPoint {
  address: string
  latitude: number
  longitude: number
  name?: string
}

export interface UserProfile {
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

export type ForumPostStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN'

export interface ForumCategory {
  id: number
  code: string
  name: string
  icon?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface ForumAuthor {
  id: number
  nickname?: string | null
  avatar?: string | null
  credit_score?: number
}

export interface ForumPost {
  id: number
  author_id: number
  title: string
  content: string
  images: string[]
  location_name?: string | null
  status: ForumPostStatus
  audit_note?: string | null
  is_pinned?: boolean
  created_at: string
  updated_at?: string
  author: ForumAuthor
  category: ForumCategory
  like_count: number
  favorite_count: number
  comment_count: number
  is_liked: boolean
  is_favorited: boolean
}

export interface ForumComment {
  id: number
  post_id: number
  author_id: number
  content: string
  status: 'APPROVED' | 'HIDDEN'
  created_at: string
  author: ForumAuthor
}

export interface Merchant {
  id: number
  name: string
  description?: string | null
  logo?: string | null
  address: string
  phone?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED'
  is_open: boolean
  menu_item_count?: number
}

export interface MenuItem {
  id: number
  merchant_id: number
  name: string
  description?: string | null
  image?: string | null
  price: number
  stock: number
  is_active: boolean
  sort_order: number
}

export interface FoodOrder {
  id: number
  merchant_id: number
  runner_id?: number | null
  status: 'PENDING_PAYMENT' | 'PAID' | 'ACCEPTED' | 'PICKED' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED'
  delivery_address: string
  contact_phone?: string | null
  remark?: string | null
  item_amount: number
  delivery_fee: number
  total_amount: number
  created_at: string
  merchant?: Merchant
  runner?: ForumAuthor
  user?: ForumAuthor
  items: Array<{ id: number; menu_item_id?: number | null; item_name: string; unit_price: number; quantity: number }>
}
