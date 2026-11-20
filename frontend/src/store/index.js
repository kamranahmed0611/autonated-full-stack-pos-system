import { create } from 'zustand'
import api from '../utils/api'

// ── Auth Store ──
export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('pos_user') || 'null'),
  token: localStorage.getItem('pos_token') || null,

  login: (user, token) => {
    localStorage.setItem('pos_user', JSON.stringify(user))
    localStorage.setItem('pos_token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('pos_user')
    localStorage.removeItem('pos_token')
    set({ user: null, token: null })
  },
}))

// ── Shift Store (Blind Shift Protocol) ──
export const useShiftStore = create((set, get) => ({
  activeShift: null,
  loading: false,

  fetchCurrentShift: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get('/shifts/current')
      set({ activeShift: data.active ? data.shift : null, loading: false })
      return data.shift
    } catch (err) {
      set({ activeShift: null, loading: false })
      return null
    }
  },

  openShift: async (openingFloat) => {
    const { data } = await api.post('/shifts/open', { opening_float: openingFloat })
    set({ activeShift: data.shift })
    return data.shift
  },

  closeShiftBlind: async (payload) => {
    const { data } = await api.post('/shifts/close-blind', payload)
    set({ activeShift: null })
    return data
  }
}))

// ── Cart Store (Universal Billing & Nearest Rs. 5 Rounding) ──
export const useCartStore = create((set, get) => ({
  items: [],
  customer: null,
  discountVal: 0,
  discountType: 'percent',
  taxRate: 0,
  paymentMethod: 'cash',
  paidAmount: '',
  notes: '',

  // Add standard or loose commodity item
  addItem: (product, customUnitType = null, initialQty = 1) => {
    const items = get().items
    const isLoose = Boolean(product.is_loose)
    const isWeighable = Boolean(product.is_weighable)

    // Unit selection: if loose and sale_unit chosen, use subunit_sale_price
    const selectedUnit = customUnitType || (isLoose ? product.sale_unit : (product.unit || 'pcs'))
    const isSubunit = isLoose && selectedUnit === product.sale_unit
    const activePrice = isSubunit ? (product.subunit_sale_price || product.price) : product.price

    // Unique cart line ID depends on product + selected unit
    const lineId = `${product.id}_${selectedUnit}`
    const existing = items.find(i => i.lineId === lineId)

    if (existing) {
      const newQty = existing.qty + initialQty
      // For packaged goods, verify stock limit
      if (!isLoose && !isWeighable && product.stock > 0 && newQty > product.stock) {
        return false
      }
      set({
        items: items.map(i => i.lineId === lineId ? { ...i, qty: newQty } : i)
      })
    } else {
      if (!isLoose && !isWeighable && product.stock <= 0 && product.id !== 'ad-hoc-item') {
        return false
      }
      set({
        items: [
          ...items,
          {
            lineId,
            id: product.id,
            product_id: product.id,
            name: product.name,
            icon: product.icon || '',
            barcode: product.barcode,
            price: activePrice,
            stock: product.stock,
            unit: product.unit || 'pcs',
            unit_type: selectedUnit,
            is_loose: isLoose,
            is_weighable: isWeighable,
            base_unit: product.base_unit,
            sale_unit: product.sale_unit,
            unit_conversion_ratio: product.unit_conversion_ratio || 1.0,
            subunit_sale_price: product.subunit_sale_price || 0,
            qty: initialQty,
            discount_amount: 0,
            tax_rate: product.tax_rate || 0
          }
        ]
      })
    }
    return true
  },

  // Add ad-hoc unbarcoded emergency item
  addAdHocItem: (name, price, qty = 1) => {
    const items = get().items
    const uniqueId = `ad-hoc-${Date.now()}`
    set({
      items: [
        ...items,
        {
          lineId: uniqueId,
          id: 'ad-hoc-item',
          product_id: 'ad-hoc-item',
          name: name || 'Custom Item',
          icon: '',
          barcode: '000000000000',
          price: parseFloat(price) || 0,
          stock: 999999,
          unit: 'pcs',
          unit_type: 'pcs',
          is_loose: false,
          is_weighable: false,
          qty: parseFloat(qty) || 1,
          discount_amount: 0,
          tax_rate: 0
        }
      ]
    })
  },

  setQty: (lineId, qty) => {
    const numQty = parseFloat(qty)
    if (isNaN(numQty) || numQty <= 0) {
      set({ items: get().items.filter(i => i.lineId !== lineId) })
    } else {
      set({ items: get().items.map(i => i.lineId === lineId ? { ...i, qty: numQty } : i) })
    }
  },

  removeItem: (lineId) => set({ items: get().items.filter(i => i.lineId !== lineId) }),

  clearCart: () => set({
    items: [],
    customer: null,
    discountVal: 0,
    paidAmount: '',
    notes: ''
  }),

  setCustomer: (c) => set({ customer: c }),
  setDiscount: (val, type) => set({ discountVal: val, discountType: type }),
  setTaxRate: (r) => set({ taxRate: r }),
  setPaymentMethod: (m) => set({ paymentMethod: m }),
  setPaidAmount: (val) => set({ paidAmount: val }),
  setNotes: (n) => set({ notes: n }),

  // Computed Totals with Pakistani Retail Nearest Rs. 5 Rounding
  get totals() {
    const { items, discountVal, discountType, taxRate, paymentMethod, paidAmount } = get()
    const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0)

    const dv = parseFloat(discountVal) || 0
    const discAmt = discountType === 'flat'
      ? Math.min(dv, subtotal)
      : (subtotal * dv / 100)

    const taxable = Math.max(0, subtotal - discAmt)
    const taxAmt = taxable * (parseFloat(taxRate) || 0) / 100
    const rawTotal = taxable + taxAmt

    // Pakistani Retail Nearest Rs. 5 Cash Rounding
    let roundedGrand = rawTotal
    let roundOffAmount = 0.0

    if (paymentMethod === 'cash') {
      roundedGrand = Math.round(rawTotal / 5) * 5
      roundOffAmount = parseFloat((roundedGrand - rawTotal).toFixed(2))
    } else {
      roundedGrand = parseFloat(rawTotal.toFixed(2))
    }

    const paidNum = parseFloat(paidAmount) || 0
    const changeDue = paymentMethod === 'cash' && paidNum > roundedGrand ? (paidNum - roundedGrand) : 0

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      discAmt: parseFloat(discAmt.toFixed(2)),
      taxAmt: parseFloat(taxAmt.toFixed(2)),
      rawGrand: parseFloat(rawTotal.toFixed(2)),
      grand: roundedGrand,
      roundOffAmount,
      itemCount: items.reduce((s, i) => s + i.qty, 0),
      linesCount: items.length,
      changeDue: parseFloat(changeDue.toFixed(2))
    }
  }
}))
