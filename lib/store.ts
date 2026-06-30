import { supabase } from './supabase'

// Remove near-white background from an image using canvas (client-side only)
async function removeWhiteBackground(file: File, tolerance = 40): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < d.data.length; i += 4) {
        const r = d.data[i], g = d.data[i+1], b = d.data[i+2]
        if (r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance) d.data[i+3] = 0
      }
      ctx.putImageData(d, 0, 0)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('处理失败')), 'image/png')
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}

export type Role = 'admin' | 'wholesaler' | 'salesperson' | 'buyer'

export interface User {
  id: string
  name: string
  role: Role
  phone: string
  email?: string
  wholesalerId?: string
  commissionRate?: number
}

export interface Wholesaler {
  id: string
  name: string
  contact?: string
  status: 'active' | 'suspended'
  createdAt: string
}

export interface Invite {
  code: string
  tempPassword: string
  wholesalerId: string
  expiresAt: string
  used: boolean
  usedBy?: string
  createdAt: string
}

export interface Category {
  id: string
  name: string
  wholesalerId?: string
}

export interface Product {
  id: string
  name: string
  categoryId: string
  price: number
  unit: string
  stock: number
  image?: string
  sku?: string
  barcode?: string
  description?: string
  videoUrl?: string
  boxQty?: number // 装箱数：每箱含多少个"包装数"单位
  subcategory?: string
  wholesalerId?: string
}

export type OrderUnit = 'pack' | 'box'

export interface CartItem {
  productId: string
  quantity: number
  orderUnit: OrderUnit // 'pack' = 按包装数下单，'box' = 按箱下单
}

export interface Order {
  id: string
  orderNo: string
  buyerId: string
  buyerName: string
  salesId?: string
  wholesalerId?: string
  items: OrderItem[]
  totalAmount: number
  status: 'pending_review' | 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled'
  createdAt: string
  remark?: string
}

export interface OrderItem {
  productId: string
  productName: string
  price: number
  quantity: number
  unit: string
  orderUnit?: OrderUnit  // 'pack' or 'box' — which unit the quantity refers to
  boxQty?: number        // snapshot of box size at time of order (for display)
}

const STATUS_LABELS: Record<Order['status'], string> = {
  pending_review: '待业务员审核',
  pending: '待批发商确认',
  confirmed: '已确认',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
}

export function getStatusLabel(status: Order['status']) {
  return STATUS_LABELS[status]
}

// localStorage helpers (for cart and current user only)
function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}
function save(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function toUser(r: Record<string, any>): User {
  return {
    id: r.id, name: r.name, role: r.role as Role, phone: r.phone,
    email: r.email || undefined,
    wholesalerId: r.wholesaler_id || undefined,
    commissionRate: r.commission_rate != null ? Number(r.commission_rate) : undefined,
  }
}

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    categoryId: row.category_id as string,
    price: Number(row.price),
    unit: row.unit as string,
    stock: Number(row.stock),
    sku: row.sku as string | undefined,
    barcode: row.barcode as string | undefined,
    description: row.description as string | undefined,
    image: row.image as string | undefined,
    videoUrl: row.video_url as string | undefined,
    boxQty: row.box_qty != null ? Number(row.box_qty) : undefined,
    subcategory: row.subcategory as string | undefined,
    wholesalerId: row.wholesaler_id as string | undefined,
  }
}

export const store = {
  // Current user (localStorage only — session state)
  getCurrentUser(): User | null { return load('yg_current_user', null) },
  setCurrentUser(user: User | null) { save('yg_current_user', user) },

  // Users
  async getUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*')
    return (data || []).map(toUser)
  },
  async loginByPhone(phoneOrEmail: string, password: string): Promise<User | null> {
    const val = phoneOrEmail.trim()
    const isEmail = val.includes('@')
    const field = isEmail ? 'email' : 'phone'
    const { data } = await supabase.from('users').select('*').eq(field, val).eq('password', password).maybeSingle()
    if (!data) return null
    return toUser(data)
  },
  async registerBuyer(name: string, phone: string, password: string, code: string, tempPassword: string, email?: string): Promise<{ ok: boolean; msg: string }> {
    const { data: inv } = await supabase.from('invites').select('*').eq('code', code.trim()).maybeSingle()
    if (!inv) return { ok: false, msg: '商家号不存在，请向批发商索取' }
    if (inv.temp_password !== tempPassword.trim()) return { ok: false, msg: '临时密码错误' }
    if (inv.used) return { ok: false, msg: '该商家号已被使用，请向批发商索取新的' }
    if (new Date(inv.expires_at).getTime() < Date.now()) return { ok: false, msg: '商家号已过期（超过2天），请向批发商索取新的' }
    if (phone.trim()) {
      const { data: ex } = await supabase.from('users').select('id').eq('phone', phone.trim()).maybeSingle()
      if (ex) return { ok: false, msg: '该手机号已注册' }
    }
    if (email?.trim()) {
      const { data: ex } = await supabase.from('users').select('id').eq('email', email.trim()).maybeSingle()
      if (ex) return { ok: false, msg: '该邮箱已注册' }
    }
    const id = `u${Date.now()}`
    const row: Record<string, any> = { id, name, password, role: 'buyer', wholesaler_id: inv.wholesaler_id }
    if (phone.trim()) row.phone = phone.trim()
    if (email?.trim()) row.email = email.trim().toLowerCase()
    const { error } = await supabase.from('users').insert(row)
    if (error) return { ok: false, msg: '注册失败，请重试' }
    await supabase.from('invites').update({ used: true, used_by: id }).eq('code', inv.code)
    return { ok: true, msg: '' }
  },

  // Wholesaler logo — remove white background via canvas, upload to Storage
  async uploadWholesalerLogo(wholesalerId: string, file: File): Promise<string> {
    const clean = await removeWhiteBackground(file)
    const path = `logos/${wholesalerId}.png`
    const { error } = await supabase.storage.from('product-images').upload(path, clean, { upsert: true, contentType: 'image/png' })
    if (error) throw new Error('Logo 上传失败: ' + error.message)
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    await supabase.from('wholesalers').update({ logo: data.publicUrl }).eq('id', wholesalerId)
    return data.publicUrl
  },
  async getWholesalerLogo(wholesalerId: string): Promise<string | null> {
    const { data } = await supabase.from('wholesalers').select('logo').eq('id', wholesalerId).maybeSingle()
    return data?.logo || null
  },

  // Image upload to Supabase Storage (returns public URL)
  async uploadProductImage(wholesalerId: string, barcode: string, blob: Blob): Promise<string> {
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${wholesalerId}/${barcode}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, blob, { upsert: true, contentType: blob.type })
    if (error) throw new Error('图片上传失败: ' + error.message)
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  },

  // Invites (merchant access codes — issued by wholesaler, valid 2 days)
  async createInvite(wholesalerId: string): Promise<Invite> {
    const code = 'M' + Math.floor(100000 + Math.random() * 900000)
    const tempPassword = String(Math.floor(1000 + Math.random() * 9000))
    const expiresAt = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString()
    const row = { code, temp_password: tempPassword, wholesaler_id: wholesalerId, expires_at: expiresAt, used: false, used_by: null }
    await supabase.from('invites').insert(row)
    return { code, tempPassword, wholesalerId, expiresAt, used: false, createdAt: new Date().toISOString() }
  },
  async getInvites(wholesalerId: string): Promise<Invite[]> {
    const { data } = await supabase.from('invites').select('*').eq('wholesaler_id', wholesalerId).order('created_at', { ascending: false })
    return (data || []).map(r => ({ code: r.code, tempPassword: r.temp_password, wholesalerId: r.wholesaler_id, expiresAt: r.expires_at, used: r.used, usedBy: r.used_by || undefined, createdAt: r.created_at }))
  },

  // Wholesalers (tenants — managed by platform admin)
  async getWholesalers(): Promise<Wholesaler[]> {
    const { data } = await supabase.from('wholesalers').select('*').order('created_at', { ascending: false })
    return (data || []).map(r => ({ id: r.id, name: r.name, contact: r.contact || undefined, status: (r.status || 'active') as Wholesaler['status'], createdAt: r.created_at }))
  },
  async addWholesaler(name: string, contact: string, phone: string, password: string): Promise<{ ok: boolean; msg: string }> {
    const { data: existing } = await supabase.from('users').select('id').eq('phone', phone.trim()).maybeSingle()
    if (existing) return { ok: false, msg: '该登录手机号已被占用' }
    const wid = `w${Date.now()}`
    const { error: e1 } = await supabase.from('wholesalers').insert({ id: wid, name, contact: contact || phone.trim(), status: 'active' })
    if (e1) return { ok: false, msg: '创建批发商失败' }
    const uid = `u${Date.now()}`
    const { error: e2 } = await supabase.from('users').insert({ id: uid, name, role: 'wholesaler', phone: phone.trim(), password, wholesaler_id: wid })
    if (e2) return { ok: false, msg: '创建登录账号失败' }
    return { ok: true, msg: '' }
  },
  async updateWholesalerStatus(id: string, status: Wholesaler['status']) {
    await supabase.from('wholesalers').update({ status }).eq('id', id)
  },

  // Categories (scoped by wholesaler)
  async getCategories(wholesalerId?: string): Promise<Category[]> {
    let q = supabase.from('categories').select('*')
    if (wholesalerId) q = q.eq('wholesaler_id', wholesalerId)
    const { data } = await q
    return (data || []).map(r => ({ id: r.id, name: r.name, wholesalerId: r.wholesaler_id || undefined }))
  },
  async addCategory(name: string, wholesalerId: string): Promise<Category> {
    const cat = { id: `c${Date.now()}`, name, wholesaler_id: wholesalerId }
    await supabase.from('categories').insert(cat)
    return { id: cat.id, name, wholesalerId }
  },

  // Products (scoped by wholesaler)
  async getProducts(wholesalerId?: string, search?: string, limit = 100, offset = 0, categoryId?: string): Promise<Product[]> {
    let q = supabase.from('products').select('*').order('name').range(offset, offset + limit - 1)
    if (wholesalerId) q = q.eq('wholesaler_id', wholesalerId)
    if (categoryId) q = q.eq('category_id', categoryId)
    if (search) q = q.or(`name.ilike.%${search}%,barcode.ilike.%${search}%`)
    const { data } = await q
    return (data || []).map(toProduct)
  },
  async countProducts(wholesalerId?: string, categoryId?: string): Promise<number> {
    let q = supabase.from('products').select('*', { count: 'exact', head: true })
    if (wholesalerId) q = q.eq('wholesaler_id', wholesalerId)
    if (categoryId) q = q.eq('category_id', categoryId)
    const { count } = await q
    return count || 0
  },
  async addProduct(p: Omit<Product, 'id'>, wholesalerId: string, sku?: string): Promise<Product> {
    // Dedup: SKU first, then EAN barcode
    if (sku) {
      const { data: existing } = await supabase.from('products').select('id').eq('wholesaler_id', wholesalerId).eq('sku', sku).maybeSingle()
      if (existing) {
        const upd: Record<string, unknown> = { name: p.name, category_id: p.categoryId, price: p.price, unit: p.unit, stock: p.stock, description: p.description, barcode: p.barcode || null, box_qty: p.boxQty || null, subcategory: p.subcategory || null }
        if (p.image) upd.image = p.image
        await supabase.from('products').update(upd).eq('id', existing.id)
        return { ...p, sku, id: existing.id, wholesalerId }
      }
    } else if (p.barcode) {
      const { data: existing } = await supabase.from('products').select('id').eq('wholesaler_id', wholesalerId).eq('barcode', p.barcode).maybeSingle()
      if (existing) {
        const upd: Record<string, unknown> = { name: p.name, category_id: p.categoryId, price: p.price, unit: p.unit, stock: p.stock, description: p.description, box_qty: p.boxQty || null, subcategory: p.subcategory || null }
        if (p.image) upd.image = p.image
        await supabase.from('products').update(upd).eq('id', existing.id)
        return { ...p, id: existing.id, wholesalerId }
      }
    }
    const product = { id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`, name: p.name, category_id: p.categoryId, price: p.price, unit: p.unit, stock: p.stock, sku: sku || null, barcode: p.barcode || null, description: p.description, image: p.image, video_url: p.videoUrl || null, box_qty: p.boxQty || null, subcategory: p.subcategory || null, wholesaler_id: wholesalerId }
    await supabase.from('products').insert(product)
    return { ...p, sku, id: product.id, wholesalerId }
  },
  async updateProduct(id: string, updates: Partial<Product>) {
    const row: Record<string, unknown> = {}
    if (updates.name !== undefined) row.name = updates.name
    if (updates.categoryId !== undefined) row.category_id = updates.categoryId
    if (updates.price !== undefined) row.price = updates.price
    if (updates.unit !== undefined) row.unit = updates.unit
    if (updates.stock !== undefined) row.stock = updates.stock
    if (updates.sku !== undefined) row.sku = updates.sku
    if (updates.barcode !== undefined) row.barcode = updates.barcode
    if (updates.description !== undefined) row.description = updates.description
    if (updates.image !== undefined) row.image = updates.image
    if (updates.videoUrl !== undefined) row.video_url = updates.videoUrl
    if (updates.boxQty !== undefined) row.box_qty = updates.boxQty || null
    if (updates.subcategory !== undefined) row.subcategory = updates.subcategory || null
    await supabase.from('products').update(row).eq('id', id)
  },
  async deleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id)
  },

  // Cart (localStorage)
  getCart(): CartItem[] { return load('yg_cart', []) },
  saveCart(cart: CartItem[]) { save('yg_cart', cart) },
  addToCart(productId: string, quantity: number, orderUnit: OrderUnit = 'pack') {
    const cart = this.getCart()
    const idx = cart.findIndex(i => i.productId === productId && i.orderUnit === orderUnit)
    if (idx >= 0) cart[idx].quantity += quantity
    else cart.push({ productId, quantity, orderUnit })
    this.saveCart(cart)
  },
  updateCartItem(productId: string, quantity: number, orderUnit: OrderUnit = 'pack') {
    if (quantity <= 0) this.saveCart(this.getCart().filter(i => !(i.productId === productId && i.orderUnit === orderUnit)))
    else this.saveCart(this.getCart().map(i => (i.productId === productId && i.orderUnit === orderUnit) ? { ...i, quantity } : i))
  },
  clearCart() { save('yg_cart', []) },

  // Orders (scoped by wholesaler)
  async getOrders(wholesalerId?: string): Promise<Order[]> {
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (wholesalerId) q = q.eq('wholesaler_id', wholesalerId)
    const { data: orders } = await q
    if (!orders || orders.length === 0) return []
    const orderIds = orders.map(o => o.id)
    const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds)
    return orders.map(o => ({
      id: o.id,
      orderNo: o.order_no,
      buyerId: o.buyer_id,
      buyerName: o.buyer_name,
      salesId: o.sales_id,
      wholesalerId: o.wholesaler_id,
      totalAmount: Number(o.total_amount),
      status: o.status as Order['status'],
      createdAt: o.created_at,
      remark: o.remark,
      items: (items || []).filter(i => i.order_id === o.id).map(i => ({
        productId: i.product_id,
        productName: i.product_name,
        price: Number(i.price),
        quantity: i.quantity,
        unit: i.unit,
      }))
    }))
  },
  async getOrdersByBuyer(buyerId: string): Promise<Order[]> {
    const { data: orders } = await supabase.from('orders').select('*').eq('buyer_id', buyerId).order('created_at', { ascending: false })
    if (!orders || orders.length === 0) return []
    const orderIds = orders.map(o => o.id)
    const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds)
    return orders.map(o => ({
      id: o.id, orderNo: o.order_no, buyerId: o.buyer_id, buyerName: o.buyer_name,
      salesId: o.sales_id, wholesalerId: o.wholesaler_id, totalAmount: Number(o.total_amount),
      status: o.status as Order['status'], createdAt: o.created_at, remark: o.remark,
      items: (items || []).filter(i => i.order_id === o.id).map(i => ({
        productId: i.product_id, productName: i.product_name, price: Number(i.price), quantity: i.quantity, unit: i.unit,
      }))
    }))
  },
  async createOrder(buyerId: string, buyerName: string, cartItems: CartItem[], products: Product[], wholesalerId: string, remark?: string, salesId?: string): Promise<Order> {
    const orderItems: OrderItem[] = cartItems.map(item => {
      const p = products.find(p => p.id === item.productId)!
      const isBox = item.orderUnit === 'box' && p.boxQty
      const unitPrice = isBox ? p.price * p.boxQty! : p.price
      const unitLabel = isBox ? '箱' : p.unit
      return { productId: item.productId, productName: p.name, price: unitPrice, quantity: item.quantity, unit: unitLabel, orderUnit: item.orderUnit, boxQty: p.boxQty }
    })
    const totalAmount = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const id = `o${Date.now()}`
    const orderNo = `YG${Date.now()}`
    await supabase.from('orders').insert({
      id, order_no: orderNo, buyer_id: buyerId, buyer_name: buyerName,
      sales_id: salesId || null, wholesaler_id: wholesalerId, total_amount: totalAmount,
      status: 'pending_review', remark: remark || null,
    })
    const itemRows = orderItems.map((i, idx) => ({
      id: `oi${Date.now()}${idx}`,
      order_id: id,
      product_id: i.productId,
      product_name: i.productName,
      price: i.price,
      quantity: i.quantity,
      unit: i.unit,
    }))
    await supabase.from('order_items').insert(itemRows)
    this.clearCart()
    return { id, orderNo, buyerId, buyerName, salesId, wholesalerId, items: orderItems, totalAmount, status: 'pending_review', createdAt: new Date().toISOString(), remark }
  },
  async updateOrderStatus(id: string, status: Order['status']) {
    await supabase.from('orders').update({ status }).eq('id', id)
  },
}
