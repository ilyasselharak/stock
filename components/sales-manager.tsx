'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import { Button, EmptyState, Input, LoadingScreen, Modal, Pagination } from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'

type Product = { id: string; name: string; sku: string; brand: string | null; basePrice: number; quantity: number; imageUrl: string | null }
type SaleItem = {
  productId: string
  quantity: number
  price: number
  product?: Product
  total: number
  profit: number
}
type Sale = {
  id: string
  total: number
  profit: number
  createdAt: string
  user: { name: string }
  items: { id: string; product: { name: string; sku: string; imageUrl: string | null }; quantity: number; price: number; total: number; profit: number }[]
}

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

export default function SalesManager() {
  const { t, formatMoney, formatDateTime } = useI18n()
  const { toast } = useToast()
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [period, setPeriod] = useState('all')

  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cart, setCart] = useState<SaleItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedQty, setSelectedQty] = useState('1')
  const [selectedPrice, setSelectedPrice] = useState('')
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [editSaleOpen, setEditSaleOpen] = useState(false)
  const [editingSaleId, setEditingSaleId] = useState('')
  const [editingCart, setEditingCart] = useState<SaleItem[]>([])

  const fetchSales = useCallback(async (p: number, per: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales?page=${p}&period=${per}`)
      if (res.status === 401) { signOut(); return }
      const data = await res.json()
      setSales(data.sales)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
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
    fetchSales(page, period)
  }, [period])

  useEffect(() => {
    fetchProducts()
  }, [])

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
          i.productId === p.id
            ? { ...i, quantity: i.quantity + qty, price, total: price * (i.quantity + qty), profit: (price - p.basePrice) * (i.quantity + qty) }
            : i
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          quantity: qty,
          price,
          product: p,
          total: price * qty,
          profit: (price - p.basePrice) * qty,
        },
      ]
    })
    setSelectedQty('1')
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  const totals = useMemo(() => {
    return cart.reduce(
      (acc, i) => ({ total: acc.total + i.total, profit: acc.profit + i.profit }),
      { total: 0, profit: 0 }
    )
  }, [cart])

  async function submitSale() {
    if (cart.length === 0) {
      toast(t('noItems'), 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Error', 'error')
        return
      }
      toast(t('saleCreated'))
      setNewSaleOpen(false)
      setCart([])
      setSelectedProduct('')
      setSelectedPrice('')
      fetchSales(page, period)
      fetchProducts()
    } finally {
      setSaving(false)
    }
  }

  async function openEditSale(sale: Sale) {
    try {
      const res = await fetch(`/api/sales/${sale.id}`)
      if (!res.ok) {
        toast(t('saleNotFound'), 'error')
        return
      }
      const data = await res.json()
      const cart: SaleItem[] = data.items.map((item: { productId: string; quantity: number; price: number; total: number; profit: number; product: { id: string; name: string; sku: string; brand: string | null; basePrice: number; quantity: number; imageUrl: string | null } }) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        profit: item.profit,
        product: {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          brand: item.product.brand,
          basePrice: item.product.basePrice,
          quantity: item.product.quantity,
          imageUrl: item.product.imageUrl,
        },
      }))
      setEditingSaleId(sale.id)
      setEditingCart(cart)
      setEditSaleOpen(true)
    } catch {
      toast(t('saleNotFound'), 'error')
    }
  }

  async function putSale() {
    if (editingCart.length === 0) {
      toast(t('noItems'), 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/sales/${editingSaleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editingCart.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Error', 'error')
        return
      }
      toast(t('saleUpdated'))
      setEditSaleOpen(false)
      setEditingSaleId('')
      setEditingCart([])
      fetchSales(page, period)
      fetchProducts()
    } catch {
      toast('Error', 'error')
    } finally {
      setSaving(false)
    }
  }

  function updateEditingItem(itemId: string, field: 'quantity' | 'price', value: string) {
    setEditingCart((prev) =>
      prev.map((i) => {
        if (i.productId !== itemId) return i
        const quantity = field === 'quantity' ? parseInt(value) || 1 : i.quantity
        const price = field === 'price' ? parseFloat(value) || 0 : i.price
        const base = i.product?.basePrice ?? 0
        return {
          ...i,
          quantity,
          price,
          total: quantity * price,
          profit: (price - base) * quantity,
        }
      })
    )
  }

  function removeEditingItem(productId: string) {
    setEditingCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  function addEditingItem() {
    if (!selectedProduct) {
      toast(t('productRequired'), 'error')
      return
    }
    const p = products.find((x) => x.id === selectedProduct)
    if (!p) return
    const qty = parseInt(selectedQty) || 1
    const price = parseFloat(selectedPrice) || p.basePrice
    setEditingCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id
            ? { ...i, quantity: i.quantity + qty, price, total: price * (i.quantity + qty), profit: (price - p.basePrice) * (i.quantity + qty) }
            : i
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          quantity: qty,
          price,
          product: p,
          total: price * qty,
          profit: (price - p.basePrice) * qty,
        },
      ]
    })
  }

  const editingTotals = useMemo(() => {
    return editingCart.reduce(
      (acc, i) => ({ total: acc.total + i.total, profit: acc.profit + i.profit }),
      { total: 0, profit: 0 }
    )
  }, [editingCart])

  return (
    <div>
      <PageHeader
        title={t('sales')}
        action={
          <Button onClick={() => { setCart([]); setSelectedProduct(''); setSelectedPrice(''); setSelectedQty('1'); setNewSaleOpen(true) }} className="w-full sm:w-auto">
            + {t('newSale')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'today', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setPage(1) }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              period === p ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t(p === 'all' ? 'all' : p)}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingScreen />
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState message={t('noSales')} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t('date')}</th>
                  <th className="px-4 py-3">{t('itemCount')}</th>
                  <th className="px-4 py-3">{t('total')}</th>
                  <th className="px-4 py-3">{t('profit')}</th>
                  <th className="px-4 py-3">{t('user')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(s.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{s.items.length}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(s.total)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{formatMoney(s.profit)}</td>
                    <td className="px-4 py-3 text-slate-500">{s.user.name}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetailSale(s)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sales.length > PER_PAGE && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
        </div>
      )}

      {/* New sale modal */}
      <Modal open={newSaleOpen} onClose={() => { if (!saving) setNewSaleOpen(false) }} title={t('newSale')} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_110px_auto]">
            <ProductSearch products={products} value={selectedProduct} onSelect={handleSelectProduct} label={t('selectProduct')} />
            <Input label={t('quantity')} type="number" min="1" value={selectedQty} onChange={setSelectedQty} />
            <Input label={t('sellingPrice')} type="number" step="0.01" min="0" value={selectedPrice} onChange={setSelectedPrice} />
            <div className="flex items-end">
              <Button onClick={addToCart} className="w-full">{t('addItem')}</Button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
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
                      <td className="px-3 py-2 font-medium text-slate-800">{i.product?.name}</td>
                      <td className="px-3 py-2 text-slate-600">{i.quantity}</td>
                      <td className="px-3 py-2 text-slate-600">{formatMoney(i.price)}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{formatMoney(i.total)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeFromCart(i.productId)} className="rounded p-1 text-slate-400 hover:text-rose-600 transition">
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

          <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">{t('total')}</span>
              <span className="font-semibold text-slate-900">{formatMoney(totals.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t('profit')}</span>
              <span className="font-semibold text-emerald-600">{formatMoney(totals.profit)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setNewSaleOpen(false)} disabled={saving}>{t('cancel')}</Button>
            <Button onClick={submitSale} loading={saving}>{t('completeSale')}</Button>
          </div>
        </div>
      </Modal>

      {/* Sale detail modal */}
      <Modal open={!!detailSale} onClose={() => setDetailSale(null)} title={`${t('sale')} — ${detailSale ? formatDateTime(detailSale.createdAt) : ''}`}>
        {detailSale && (
          <div className="space-y-4">
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
                  {detailSale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{item.product.name}</td>
                      <td className="px-3 py-2 text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-2 text-slate-600">{formatMoney(item.price)}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">{t('total')}</span>
                <span className="font-semibold text-slate-900">{formatMoney(detailSale.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('profit')}</span>
                <span className="font-semibold text-emerald-600">{formatMoney(detailSale.profit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('user')}</span>
                <span className="font-medium text-slate-800">{detailSale.user.name}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDetailSale(null)}>{t('close')}</Button>
              <Button onClick={() => { openEditSale(detailSale); setDetailSale(null) }}>{t('edit')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit sale modal */}
      <Modal open={editSaleOpen} onClose={() => { if (!saving) setEditSaleOpen(false) }} title={t('editSale')} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_110px_auto]">
            <ProductSearch products={products} value={selectedProduct} onSelect={handleSelectProduct} label={t('selectProduct')} />
            <Input label={t('quantity')} type="number" min="1" value={selectedQty} onChange={setSelectedQty} />
            <Input label={t('sellingPrice')} type="number" step="0.01" min="0" value={selectedPrice} onChange={setSelectedPrice} />
            <div className="flex items-end">
              <Button onClick={addEditingItem} className="w-full">{t('addItem')}</Button>
            </div>
          </div>

          {editingCart.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
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
                  {editingCart.map((i) => (
                    <tr key={i.productId}>
                      <td className="px-3 py-2 font-medium text-slate-800">{i.product?.name}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="1"
                          value={String(i.quantity)}
                          onChange={(v) => updateEditingItem(i.productId, 'quantity', v)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={String(i.price)}
                          onChange={(v) => updateEditingItem(i.productId, 'price', v)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">{formatMoney(i.total)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeEditingItem(i.productId)} className="rounded p-1 text-slate-400 hover:text-rose-600 transition">
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

          <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">{t('total')}</span>
              <span className="font-semibold text-slate-900">{formatMoney(editingTotals.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t('profit')}</span>
              <span className="font-semibold text-emerald-600">{formatMoney(editingTotals.profit)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditSaleOpen(false)} disabled={saving}>{t('cancel')}</Button>
            <Button onClick={putSale} loading={saving}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
