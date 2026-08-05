'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import { Button, EmptyState, Input, LoadingScreen, Modal, Pagination, Select, StatusBadge } from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'

type Payment = {
  id: string
  amount: number
  remaining: number
  date: string
  user: { name: string }
}

type CreditSaleItem = {
  id: string
  productId: string
  productName: string
  quantity: number
  price: number
  total: number
}

type CreditSale = {
  id: string
  productName: string
  totalPrice: number
  initialPayment: number
  monthlyAmount: number
  amountPaid: number
  status: string
  createdAt: string
  customer: { fullName: string; phone: string }
  createdByUser: { name: string }
  payments: Payment[]
  items: CreditSaleItem[]
}

type Customer = { id: string; fullName: string }
type Product = { id: string; name: string; sku: string; brand: string | null; basePrice: number; quantity: number }
type CartItem = { productId: string; productName: string; quantity: number; price: number }

const PER_PAGE = 10

function ProductSearch({
  products,
  value,
  onSelect,
  label,
}: {
  products: Product[]
  value: string
  onSelect: (id: string) => void
  label: string
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = products.find((p) => p.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.brand || '').toLowerCase().includes(q)
        )
      : products
    return list.slice(0, 30)
  }, [products, query])

  return (
    <div className="relative">
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={selected && !query ? `${selected.name} (${selected.sku})` : query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (value) onSelect('')
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('searchByNameSku')}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">{t('noProducts')}</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(p.id)
                  setQuery('')
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50"
              >
                <span className="min-w-0 truncate text-slate-800">
                  {p.name}
                  <span className="text-slate-400"> ({p.sku})</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {t('currentStock')}: {p.quantity}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function PaymentsManager() {
  const { t, formatMoney, formatDateTime } = useI18n()
  const { toast } = useToast()
  const [creditSales, setCreditSales] = useState<CreditSale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ customerId: '', initialPayment: '0', monthlyAmount: '' })
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedQty, setSelectedQty] = useState('1')
  const [selectedPrice, setSelectedPrice] = useState('')

  const [payModal, setPayModal] = useState<CreditSale | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [paySaving, setPaySaving] = useState(false)
  const [detail, setDetail] = useState<CreditSale | null>(null)

  const fetchData = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/creditsales?page=${p}`)
      if (res.status === 401) { signOut(); return }
      const data = await res.json()
      setCreditSales(data.creditSales)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCustomers = useCallback(async () => {
    const res = await fetch('/api/customers?page=1&limit=500')
    if (res.ok) {
      const data = await res.json()
      setCustomers(data.customers || [])
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products?page=1&limit=500')
    if (res.ok) {
      const data = await res.json()
      setProducts(data.products || [])
    }
  }, [])

  useEffect(() => {
    fetchData(page)
    fetchCustomers()
    fetchProducts()
  }, [])

  function openCreate() {
    setForm({ customerId: customers[0]?.id || '', initialPayment: '0', monthlyAmount: '' })
    setCart([])
    setSelectedProduct('')
    setSelectedQty('1')
    setSelectedPrice('')
    setCreateOpen(true)
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

  function handleSelectProduct(id: string) {
    setSelectedProduct(id)
    const p = products.find((x) => x.id === id)
    if (p) setSelectedPrice(String(p.basePrice))
  }

  function addToCart() {
    if (!selectedProduct) {
      toast(t('productRequired'), 'error')
      return
    }
    const p = products.find((x) => x.id === selectedProduct)!
    const qty = parseInt(selectedQty) || 1
    const price = parseFloat(selectedPrice) || p.basePrice
    if (qty > p.quantity) {
      toast(`${t('notEnoughStock')}: ${p.quantity}`, 'error')
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: i.quantity + qty } : i
        )
      }
      return [...prev, { productId: p.id, productName: p.name, quantity: qty, price }]
    })
    setSelectedProduct('')
    setSelectedQty('1')
    setSelectedPrice('')
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  async function createCreditSale(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) {
      toast(t('noItems'), 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/creditsales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          items: cart.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            price: i.price,
          })),
          initialPayment: parseFloat(form.initialPayment) || 0,
          monthlyAmount: parseFloat(form.monthlyAmount),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Error', 'error')
        return
      }
      toast(t('creditSaleCreated'))
      setCreateOpen(false)
      fetchData(page)
    } finally {
      setSaving(false)
    }
  }

  function openPay(cs: CreditSale) {
    setPayModal(cs)
    setPayAmount('')
  }

  function numberOfPayments(cs: CreditSale) {
    return cs.payments.length
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payModal) return
    setPaySaving(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditSaleId: payModal.id, amount: parseFloat(payAmount) }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Error', 'error')
        return
      }
      toast(t('paymentCreated'))
      setPayModal(null)
      fetchData(page)
    } finally {
      setPaySaving(false)
    }
  }


  return (
    <div>
      <PageHeader
        title={t('creditSales')}
        action={<Button onClick={openCreate} className="w-full sm:w-auto">+ {t('addCreditSale')}</Button>}
      />

      {loading ? (
        <LoadingScreen />
      ) : creditSales.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState message={t('emptyState')} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t('customer')}</th>
                  <th className="px-4 py-3">{t('productName')}</th>
                  <th className="px-4 py-3">{t('totalPrice')}</th>
                  <th className="px-4 py-3">{t('amountPaid')}</th>
                  <th className="px-4 py-3">{t('remaining')}</th>
                  <th className="px-4 py-3">{t('monthlyAmount')}</th>
                  <th className="px-4 py-3">{t('numberOfPayments')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditSales.map((cs) => {
                  const remaining = cs.totalPrice - cs.amountPaid
                  return (
                    <tr key={cs.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{cs.customer.fullName}</p>
                        <p className="text-xs text-slate-400" dir="ltr">{cs.customer.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{cs.productName}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(cs.totalPrice)}</td>
                      <td className="px-4 py-3 text-emerald-600">{formatMoney(cs.amountPaid)}</td>
                      <td className={`px-4 py-3 font-semibold ${remaining > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {formatMoney(remaining)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatMoney(cs.monthlyAmount)}</td>
                      <td className="px-4 py-3 text-slate-600">{numberOfPayments(cs)}</td>
                      <td className="px-4 py-3"><StatusBadge status={cs.status} t={t} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setDetail(cs)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                            title={t('paymentHistory')}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openPay(cs)}
                            disabled={remaining <= 0}
                            className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 transition"
                          >
                            {t('recordPayment')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {creditSales.length > PER_PAGE && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
        </div>
      )}

      {/* Create credit sale */}
      <Modal open={createOpen} onClose={() => { if (!saving) setCreateOpen(false) }} title={t('addCreditSale')} wide>
        <form onSubmit={createCreditSale} className="space-y-4">
          <Select label={t('selectCustomer')} value={form.customerId} onChange={(v) => setForm((f) => ({ ...f, customerId: v }))}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
          </Select>

          {/* Product picker */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('products')}</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_110px_auto]">
              <ProductSearch products={products} value={selectedProduct} onSelect={handleSelectProduct} label={t('selectProduct2')} />
              <Input label="" type="number" min="1" value={selectedQty} onChange={setSelectedQty} placeholder={t('quantity')} />
              <Input label="" type="number" step="0.01" min="0" value={selectedPrice} onChange={setSelectedPrice} placeholder={t('sellingPrice')} />
              <div className="flex items-end">
                <Button onClick={addToCart} className="w-full">{t('addItem')}</Button>
              </div>
            </div>
            {cart.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="px-3 py-2 text-left">{t('productName')}</th>
                      <th className="px-3 py-2 text-left">{t('quantity')}</th>
                      <th className="px-3 py-2 text-left">{t('price')}</th>
                      <th className="px-3 py-2 text-left">{t('total')}</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((i) => (
                      <tr key={i.productId}>
                        <td className="px-3 py-2 font-medium text-slate-800">{i.productName}</td>
                        <td className="px-3 py-2 text-slate-600">{i.quantity}</td>
                        <td className="px-3 py-2 text-slate-600">{formatMoney(i.price)}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{formatMoney(i.price * i.quantity)}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => removeFromCart(i.productId)} className="rounded p-1 text-slate-400 hover:text-rose-600 transition">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{t('totalPrice')}</span>
              <span className="font-semibold text-slate-900">{formatMoney(cartTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">{t('remaining')} ({t('initialPayment')})</span>
              <span className="font-semibold text-rose-600">{formatMoney(Math.max(0, cartTotal - (parseFloat(form.initialPayment) || 0)))}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={t('monthlyAmount')} type="number" step="0.01" min="0" value={form.monthlyAmount} onChange={(v) => setForm((f) => ({ ...f, monthlyAmount: v }))} required />
            <Input label={t('initialPayment')} type="number" step="0.01" min="0" value={form.initialPayment} onChange={(v) => setForm((f) => ({ ...f, initialPayment: v }))} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>{t('cancel')}</Button>
            <Button type="submit" loading={saving}>{t('save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Payment modal */}
      <Modal open={!!payModal} onClose={() => { if (!paySaving) setPayModal(null) }} title={t('recordPayment')}>
        {payModal && (
          <form onSubmit={recordPayment} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">{t('customer')}</span><span className="font-medium text-slate-800">{payModal.customer.fullName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('totalPrice')}</span><span className="font-medium text-slate-800">{formatMoney(payModal.totalPrice)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('amountPaid')}</span><span className="font-medium text-emerald-600">{formatMoney(payModal.amountPaid)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-slate-500">{t('remaining')}</span><span className="font-semibold text-rose-600">{formatMoney(Math.max(0, payModal.totalPrice - payModal.amountPaid))}</span></div>
            </div>
            <Input
              label={t('paymentAmount')}
              type="number"
              step="0.01"
              min="0.01"
              max={payModal.totalPrice - payModal.amountPaid}
              value={payAmount}
              onChange={setPayAmount}
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setPayModal(null)} disabled={paySaving}>{t('cancel')}</Button>
              <Button type="submit" loading={paySaving}>{t('save')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <DetailModal creditSale={detail} onClose={() => setDetail(null)} t={t} formatMoney={formatMoney} formatDateTime={formatDateTime} />
    </div>
  )
}

function DetailModal({
  creditSale,
  onClose,
  t,
  formatMoney,
  formatDateTime,
}: {
  creditSale: CreditSale | null
  onClose: () => void
  t: (k: string) => string
  formatMoney: (n: number) => string
  formatDateTime: (d: string) => string
}) {
  if (!creditSale) return null
  const remaining = creditSale.totalPrice - creditSale.amountPaid
  return (
    <Modal open={!!creditSale} onClose={onClose} title={`${t('paymentHistory')} — ${creditSale.customer.fullName}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-4 text-sm grid grid-cols-2 gap-2">
          <div><p className="text-xs text-slate-500">{t('totalPrice')}</p><p className="font-semibold text-slate-900">{formatMoney(creditSale.totalPrice)}</p></div>
          <div><p className="text-xs text-slate-500">{t('amountPaid')}</p><p className="font-semibold text-emerald-600">{formatMoney(creditSale.amountPaid)}</p></div>
          <div><p className="text-xs text-slate-500">{t('remaining')}</p><p className="font-semibold text-rose-600">{formatMoney(remaining)}</p></div>
          <div><p className="text-xs text-slate-500">{t('monthlyAmount')}</p><p className="font-semibold text-slate-900">{formatMoney(creditSale.monthlyAmount)}</p></div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">{t('products')} ({creditSale.items?.length ?? 0})</p>
          {creditSale.items && creditSale.items.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2 text-left">{t('productName')}</th>
                    <th className="px-3 py-2 text-left">{t('quantity')}</th>
                    <th className="px-3 py-2 text-left">{t('price')}</th>
                    <th className="px-3 py-2 text-left">{t('total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditSale.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{it.productName}</td>
                      <td className="px-3 py-2 text-slate-600">{it.quantity}</td>
                      <td className="px-3 py-2 text-slate-600">{formatMoney(it.price)}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message={t('noData')} />
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">{t('paymentHistory')} ({creditSale.payments.length})</p>
          {creditSale.payments.length === 0 ? (
            <EmptyState message={t('noPayments')} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2 text-left">{t('date')}</th>
                    <th className="px-3 py-2 text-left">{t('amount')}</th>
                    <th className="px-3 py-2 text-left">{t('remainingBalance')}</th>
                    <th className="px-3 py-2 text-left">{t('user')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditSale.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-slate-500">{formatDateTime(p.date)}</td>
                      <td className="px-3 py-2 font-medium text-emerald-600">{formatMoney(p.amount)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatMoney(p.remaining)}</td>
                      <td className="px-3 py-2 text-slate-500">{p.user.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
