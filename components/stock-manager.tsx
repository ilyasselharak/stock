'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import { Button, EmptyState, Input, LoadingScreen, Modal, Pagination, ProductPicker, Select } from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'

type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
type Location = 'STORE' | 'WAREHOUSE'

type Movement = {
  id: string
  product: { id: string; name: string; sku: string } | null
  quantity: number
  type: MovementType
  // Null on movements recorded before the warehouse existed (all were in the stores).
  location: Location | null
  reason: string | null
  date: string
  user: { name: string } | null
}

type Product = { id: string; name: string; sku: string; brand: string | null; quantity: number; warehouseQuantity: number }

const PER_PAGE = 15

export default function StockManager({ isAdmin }: { isAdmin: boolean }) {
  const { t, formatDateTime } = useI18n()
  const { toast } = useToast()
  const [movements, setMovements] = useState<Movement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    productId: '',
    type: 'TRANSFER' as MovementType,
    // For TRANSFER: the destination (STORE = warehouse → stores).
    location: 'STORE' as Location,
    quantity: '',
    reason: '',
  })

  const fetchMovements = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stock?page=${p}`)
      if (res.status === 401) { signOut(); return }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.error || 'Error', 'error'); return }
      setMovements(data.movements)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products?page=1&limit=500')
    const data = await res.json()
    setProducts(data.products || [])
  }, [])

  useEffect(() => {
    fetchMovements(page)
    fetchProducts()
  }, [page])

  function openModal() {
    setForm({ productId: '', type: 'TRANSFER', location: 'STORE', quantity: '', reason: '' })
    setModalOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          type: form.type,
          location: form.location,
          quantity: parseInt(form.quantity),
          reason: form.reason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Error', 'error')
        return
      }
      toast(t('stockUpdated'))
      setModalOpen(false)
      fetchMovements(page)
      fetchProducts()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('stock')}
        subtitle={`${total} ${t('stockHistory')}`}
        action={
          isAdmin ? (
            <Button onClick={openModal} className="w-full sm:w-auto">+ {t('updateStock')}</Button>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingScreen />
      ) : movements.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState message={t('noStock')} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t('productName')}</th>
                  <th className="px-4 py-3">{t('sku')}</th>
                  <th className="px-4 py-3">{t('type')}</th>
                  <th className="px-4 py-3">{t('location')}</th>
                  <th className="px-4 py-3">{t('quantity')}</th>
                  <th className="px-4 py-3">{t('reason')}</th>
                  <th className="px-4 py-3">{t('user')}</th>
                  <th className="px-4 py-3">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{m.product?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{m.product?.sku ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.type === 'IN'
                            ? 'bg-emerald-100 text-emerald-700'
                            : m.type === 'OUT'
                              ? 'bg-rose-100 text-rose-700'
                              : m.type === 'TRANSFER'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {t(m.type.toLowerCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {m.type === 'TRANSFER'
                        ? t(m.location === 'WAREHOUSE' ? 'transferToWarehouse' : 'transferToStores')
                        : t(m.location === 'WAREHOUSE' ? 'warehouse' : 'stores')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{m.quantity}</td>
                    <td className="px-4 py-3 text-slate-500">{m.reason || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{m.user?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(m.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PER_PAGE && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { if (!saving) setModalOpen(false) }} title={t('updateStock')}>
        <form onSubmit={submit} className="space-y-4">
          <ProductPicker
            products={products}
            value={form.productId}
            onSelect={(v) => setForm((f) => ({ ...f, productId: v }))}
            label={t('productName')}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label={t('type')} value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v as MovementType }))}>
              <option value="TRANSFER">{t('transfer')}</option>
              <option value="IN">{t('stockIn')}</option>
              <option value="OUT">{t('stockOut')}</option>
              <option value="ADJUSTMENT">{t('adjustment')}</option>
            </Select>
            <Select
              label={form.type === 'TRANSFER' ? t('direction') : t('location')}
              value={form.location}
              onChange={(v) => setForm((f) => ({ ...f, location: v as Location }))}
            >
              <option value="STORE">{form.type === 'TRANSFER' ? t('transferToStores') : t('stores')}</option>
              <option value="WAREHOUSE">{form.type === 'TRANSFER' ? t('transferToWarehouse') : t('warehouse')}</option>
            </Select>
          </div>

          <Input
            label={t('quantity')}
            type="number"
            min={form.type === 'ADJUSTMENT' ? '0' : '1'}
            value={form.quantity}
            onChange={(v) => setForm((f) => ({ ...f, quantity: v }))}
            required
            hint={(() => {
              const p = products.find((x) => x.id === form.productId)
              return p ? `${t('stores')}: ${p.quantity} · ${t('warehouse')}: ${p.warehouseQuantity ?? 0}` : undefined
            })()}
          />

          <Input
            label={t('reason')}
            value={form.reason}
            onChange={(v) => setForm((f) => ({ ...f, reason: v }))}
            placeholder={form.type === 'ADJUSTMENT' ? 'Inventaire / casse / perte...' : form.type === 'TRANSFER' ? 'Réassort magasins...' : 'Livraison / retour...'}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>{t('cancel')}</Button>
            <Button type="submit" loading={saving}>{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
