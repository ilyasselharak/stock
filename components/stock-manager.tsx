'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import { Button, EmptyState, Input, LoadingScreen, Modal, Pagination, Select } from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'

type Movement = {
  id: string
  product: { id: string; name: string; sku: string }
  quantity: number
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  reason: string | null
  date: string
  user: { name: string }
}

type Product = { id: string; name: string; sku: string; quantity: number }

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
    type: 'IN' as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: '',
    reason: '',
  })

  const fetchMovements = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stock?page=${p}`)
      if (res.status === 401) { signOut(); return }
      const data = await res.json()
      setMovements(data.movements)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products?page=1&limit=100')
    const data = await res.json()
    setProducts(data.products || [])
  }, [])

  useEffect(() => {
    fetchMovements(page)
    fetchProducts()
  }, [])

  function openModal() {
    setForm({ productId: products[0]?.id || '', type: 'IN', quantity: '', reason: '' })
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
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t('productName')}</th>
                  <th className="px-4 py-3">{t('sku')}</th>
                  <th className="px-4 py-3">{t('type')}</th>
                  <th className="px-4 py-3">{t('quantity')}</th>
                  <th className="px-4 py-3">{t('reason')}</th>
                  <th className="px-4 py-3">{t('user')}</th>
                  <th className="px-4 py-3">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{m.product.name}</td>
                    <td className="px-4 py-3 text-slate-500">{m.product.sku}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.type === 'IN'
                            ? 'bg-emerald-100 text-emerald-700'
                            : m.type === 'OUT'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {t(m.type.toLowerCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{m.quantity}</td>
                    <td className="px-4 py-3 text-slate-500">{m.reason || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{m.user.name}</td>
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
          <Select
            label={t('productName')}
            value={form.productId}
            onChange={(v) => setForm((f) => ({ ...f, productId: v }))}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — {t('currentStock')}: {p.quantity}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label={t('type')} value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v as 'IN' | 'OUT' | 'ADJUSTMENT' }))}>
              <option value="IN">{t('stockIn')}</option>
              <option value="OUT">{t('stockOut')}</option>
              <option value="ADJUSTMENT">{t('adjustment')}</option>
            </Select>
            <Input
              label={t('quantity')}
              type="number"
              min="1"
              value={form.quantity}
              onChange={(v) => setForm((f) => ({ ...f, quantity: v }))}
              required
            />
          </div>

          <Input
            label={t('reason')}
            value={form.reason}
            onChange={(v) => setForm((f) => ({ ...f, reason: v }))}
            placeholder={form.type === 'ADJUSTMENT' ? 'Inventaire / casse / perte...' : 'Livraison / retour...'}
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
