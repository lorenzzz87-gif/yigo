import { supabase } from './supabase'

export type Role = 'admin' | 'buyer' | 'salesperson'

export interface User {
  id: string
  name: string
  role: Role
  phone: string
}

export interface Category {
  id: string
  name: string
}

export interface Product {
  id: string
  name: string
  categoryId: string
  price: number
  unit: string
  stock: number
  image?: string
  barcode?: string
  description?: string
}

export interface CartItem {
  productId: string
  quantity: number
}

export interface Order {
  id: string
  orderNo: string
  buyerId: string
  buyerName: string
  salesId?: string
  items: OrderItem[]
  totalAmount: number
  status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled'
  createdAt: string
  remark?: string
}

export interface OrderItem {
  productId: string
  productName: string
  price: number
  quantity: number
  unit: string
}

const STATUS_LABELS: Record<Order['status'], string> = {
  pending: '待确认',
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

// Map DB row → Product
function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    categoryId: row.category_id as string,
    price: Number(row.price),
    unit: row.unit as string,
    stock: Number(row.stock),
    barcode: row.barcode as string | undefined,
    description: row.description as string | undefined,
    image: row.image as string | undefined,
  }
}

export const store = {
  // Current user (localStorage only — session state)
  getCurrentUser(): User | null { return load('yg_current_user', null) },
  setCurrentUser(user: User | null) { save('yg_current_user', user) },

  // Users
  async getUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*')
    return (data || []).map(r => ({ id: r.id, name: r.name, role: r.role as Role, phone: r.phone }))
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    const { data } = await supabase.from('categories').select('*')
    return (data || []).map(r => ({ id: r.id, name: r.name }))
  },
  async addCategory(name: string): Promise<Category> {
    const cat = { id: `c${Date.now()}`, name }
    await supabase.from('categories').insert(cat)
    return cat
  },

  // Products
  async getProducts(): Promise<Product[]> {
    const { data } = await supabase.from('products').select('*')
    return (data || []).map(toProduct)
  },
  async addProduct(p: Omit<Product, 'id'>): Promise<Product> {
    const product = { id: `p${Date.now()}`, name: p.name, category_id: p.categoryId, price: p.price, unit: p.unit, stock: p.stock, barcode: p.barcode, description: p.description, image: p.image }
    await supabase.from('products').insert(product)
    return { ...p, id: product.id }
  },
  async updateProduct(id: string, updates: Partial<Product>) {
    const row: Record<string, unknown> = {}
    if (updates.name !== undefined) row.name = updates.name
    if (updates.categoryId !== undefined) row.category_id = updates.categoryId
    if (updates.price !== undefined) row.price = updates.price
    if (updates.unit !== undefined) row.unit = updates.unit
    if (updates.stock !== undefined) row.stock = updates.stock
    if (updates.barcode !== undefined) row.barcode = updates.barcode
    if (updates.description !== undefined) row.description = updates.description
    if (updates.image !== undefined) row.image = updates.image
    await supabase.from('products').update(row).eq('id', id)
  },
  async deleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id)
  },
  async findByBarcode(barcode: string): Promise<Product | undefined> {
    const { data } = await supabase.from('products').select('*').eq('barcode', barcode).single()
    return data ? toProduct(data) : undefined
  },

  // Cart (localStorage)
  getCart(): CartItem[] { return load('yg_cart', []) },
  saveCart(cart: CartItem[]) { save('yg_cart', cart) },
  addToCart(productId: string, quantity: number) {
    const cart = this.getCart()
    const idx = cart.findIndex(i => i.productId === productId)
    if (idx >= 0) cart[idx].quantity += quantity
    else cart.push({ productId, quantity })
    this.saveCart(cart)
  },
  updateCartItem(productId: string, quantity: number) {
    if (quantity <= 0) this.saveCart(this.getCart().filter(i => i.productId !== productId))
    else this.saveCart(this.getCart().map(i => i.productId === productId ? { ...i, quantity } : i))
  },
  clearCart() { save('yg_cart', []) },

  // Orders
  async getOrders(): Promise<Order[]> {
    const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (!orders || orders.length === 0) return []
    const orderIds = orders.map(o => o.id)
    const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds)
    return orders.map(o => ({
      id: o.id,
      orderNo: o.order_no,
      buyerId: o.buyer_id,
      buyerName: o.buyer_name,
      salesId: o.sales_id,
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
    const all = await this.getOrders()
    return all.filter(o => o.buyerId === buyerId)
  },
  async createOrder(buyerId: string, buyerName: string, cartItems: CartItem[], products: Product[], remark?: string, salesId?: string): Promise<Order> {
    const orderItems: OrderItem[] = cartItems.map(item => {
      const p = products.find(p => p.id === item.productId)!
      return { productId: item.productId, productName: p.name, price: p.price, quantity: item.quantity, unit: p.unit }
    })
    const totalAmount = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const id = `o${Date.now()}`
    const orderNo = `YG${Date.now()}`
    await supabase.from('orders').insert({
      id, order_no: orderNo, buyer_id: buyerId, buyer_name: buyerName,
      sales_id: salesId || null, total_amount: totalAmount,
      status: 'pending', remark: remark || null,
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
    return { id, orderNo, buyerId, buyerName, salesId, items: orderItems, totalAmount, status: 'pending', createdAt: new Date().toISOString(), remark }
  },
  async updateOrderStatus(id: string, status: Order['status']) {
    await supabase.from('orders').update({ status }).eq('id', id)
  },
}
