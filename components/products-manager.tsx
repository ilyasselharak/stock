'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingScreen,
  Modal,
  Pagination,
  SearchInput,
} from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'

type Product = {
  id: string
  name: string
  brand: string | null
  sku: string
  basePrice: number
  quantity: number
  imageUrl: string | null
  createdAt: string
}

const PER_PAGE = 10

export default function ProductsManager({ isAdmin }: { isAdmin: boolean }) {
  const { t, formatMoney } = useI18n()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    sku: '',
    brand: '',
    basePrice: '',
    quantity: '',
    imageUrl: '',
    imageBase64: '',
    imageError: '',
  })

  const fetchProducts = useCallback(async (q: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q) params.set('q', q)
      const res = await fetch(`/api/products?${params}`)
      if (res.status === 401) { signOut(); return }
      const data = await res.json()
      setProducts(data.products)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const delay = setTimeout(() => {
      setPage(1)
      fetchProducts(search, 1)
    }, 300)
    return () => clearTimeout(delay)
  }, [search])

  useEffect(() => {
    fetchProducts(search, page)
  }, [page])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', sku: '', brand: '', basePrice: '', quantity: '', imageUrl: '', imageBase64: '', imageError: '' })
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      sku: p.sku,
      brand: p.brand || '',
      basePrice: String(p.basePrice),
      quantity: String(p.quantity),
      imageUrl: p.imageUrl || '',
      imageBase64: '',
      imageError: '',
    })
    setModalOpen(true)
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setForm((f) => ({ ...f, imageError: 'Image too large (max 2MB)' }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setForm((f) => ({ ...f, imageBase64: reader.result as string, imageError: '' }))
    }
    reader.readAsDataURL(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = editing
        ? {
            name: form.name,
            sku: form.sku,
            brand: form.brand || null,
            basePrice: parseFloat(form.basePrice),
            quantity: parseInt(form.quantity) || 0,
            image: form.imageBase64 || null,
            imageUrl: form.imageBase64 ? undefined : form.imageUrl || null,
          }
        : {
            name: form.name,
            sku: form.sku,
            brand: form.brand || null,
            basePrice: parseFloat(form.basePrice),
            image: form.imageBase64 || null,
          }
      const res = await fetch(editing ? `/api/products/${editing.id}` : '/api/products', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) { toast(t('noPermission'), 'error'); return }
        toast(data.error || 'Error', 'error')
        return
      }
      toast(editing ? t('productUpdated') : t('productCreated'))
      setModalOpen(false)
      fetchProducts(search, page)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    const res = await fetch(`/api/products?${new URLSearchParams({ id: deleting.id })}`, { method: 'DELETE' })
    if (res.ok) {
      toast(t('productDeleted'))
      setDeleting(null)
      fetchProducts(search, page)
    } else {
      const data = await res.json()
      toast(data.error || 'Error', 'error')
    }
    setDeleteLoading(false)
  }

  return (
    <div>
      <PageHeader
        title={t('productsTitle')}
        subtitle={`${total} ${t('products')}`}
        action={
          isAdmin ? (
            <Button onClick={openCreate} className="w-full sm:w-auto">+ {t('addProduct')}</Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder={t('searchByNameSku')} />
      </div>

      {loading ? (
        <LoadingScreen />
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState message={search ? t('noProducts') : t('emptyState')} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t('productImage')}</th>
                  <th className="px-4 py-3">{t('name')}</th>
                  <th className="px-4 py-3">{t('brand')}</th>
                  <th className="px-4 py-3">{t('sku')}</th>
                  <th className="px-4 py-3">{t('basePrice')}</th>
                  <th className="px-4 py-3">{t('currentStock')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.brand || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMoney(p.basePrice)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${p.quantity === 0 ? 'bg-rose-50 text-rose-600' : p.quantity <= 5 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {p.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          disabled={!isAdmin}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-40 transition"
                          title={t('edit')}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleting(p)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                            title={t('delete')}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PER_PAGE && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { if (!saving) setModalOpen(false) }} title={editing ? t('editProduct') : t('addProduct')}>
        <form onSubmit={submit} className="space-y-4">
          <Input label={t('name')} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required placeholder={t('searchProductName')} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={t('brand')} value={form.brand} onChange={(v) => setForm((f) => ({ ...f, brand: v }))} placeholder={t('brand')} />
            <Input label={t('sku')} value={form.sku} onChange={(v) => setForm((f) => ({ ...f, sku: v }))} required placeholder="SKU-001" />
          </div>
          {editing && isAdmin && (
            <Input label={t('stockQuantity')} type="number" min="0" value={form.quantity} onChange={(v) => setForm((f) => ({ ...f, quantity: v }))} />
          )}
          <Input label={t('basePrice')} type="number" step="0.01" min="0" value={form.basePrice} onChange={(v) => setForm((f) => ({ ...f, basePrice: v }))} required hint={`${t('profit')} = (${t('sellingPrice')} - ${t('basePrice')}) × ${t('quantity')}`} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('productImage')} ({t('optional')})</label>
            {(form.imageBase64 || form.imageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageBase64 || form.imageUrl} alt="preview" className="mb-2 h-20 w-20 rounded-lg object-cover" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="block w-full text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {form.imageError && <p className="mt-1 text-xs text-rose-500">{form.imageError}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>{t('cancel')}</Button>
            <Button type="submit" loading={saving}>{t('save')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        message={`${t('confirmDelete')} ${deleting?.name ?? ''}`}
      />
    </div>
  )
}