'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import { Button, ConfirmDialog, EmptyState, Input, LoadingScreen, Modal, Pagination, SearchInput, StatusBadge } from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'

type Customer = {
  id: string
  fullName: string
  phone: string
  address: string | null
  notes: string | null
  createdAt: string
  balance: number
  lastPaymentDate: string | null
  creditSales: { id: string; totalPrice: number; amountPaid: number; status: string }[]
}


export default function CustomersManager() {
  const { t, formatMoney, formatDate } = useI18n()
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', address: '', notes: '' })

  const fetchCustomers = useCallback(async (q: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q) params.set('q', q)
      const res = await fetch(`/api/customers?${params}`)
      if (res.status === 401) { signOut(); return }
      const data = await res.json()
      setCustomers(data.customers)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const delay = setTimeout(() => {
      setPage(1)
      fetchCustomers(search, 1)
    }, 300)
    return () => clearTimeout(delay)
  }, [search])

  useEffect(() => {
    fetchCustomers(search, page)
  }, [page])

  function openCreate() {
    setEditing(null)
    setForm({ fullName: '', phone: '', address: '', notes: '' })
    setModalOpen(true)
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ fullName: c.fullName, phone: c.phone, address: c.address || '', notes: c.notes || '' })
    setModalOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(editing ? `/api/customers?id=${editing.id}` : '/api/customers', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Error', 'error')
        return
      }
      toast(editing ? t('customerUpdated') : t('customerCreated'))
      setModalOpen(false)
      fetchCustomers(search, page)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    const res = await fetch(`/api/customers?id=${deleting.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      toast(t('customerDeleted'))
      setDeleting(null)
      fetchCustomers(search, page)
    } else {
      toast(data.error || 'Error', 'error')
    }
    setDeleteLoading(false)
  }

  return (
    <div>
      <PageHeader
        title={t('creditCustomers')}
        action={<Button onClick={openCreate} className="w-full sm:w-auto">+ {t('addCustomer')}</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder={t('searchCustomers')} />
      </div>

      {loading ? (
        <LoadingScreen />
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState message={t('noCustomers')} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {customers.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
                    {c.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{c.fullName}</p>
                    <p className="text-xs text-slate-500" dir="ltr">{c.phone}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition" title={t('edit')}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeleting(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition" title={t('delete')}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {c.address && <p className="mt-3 text-xs text-slate-500">{c.address}</p>}
              {c.notes && <p className="mt-1 text-xs text-slate-400 italic">{c.notes}</p>}

              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t('creditBalance')}</span>
                  <span className={`text-sm font-bold ${c.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatMoney(c.balance)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t('lastPaymentDate')}</span>
                  <span className={`text-sm font-medium ${c.lastPaymentDate ? 'text-slate-700' : 'text-slate-400'}`} dir="ltr">
                    {c.lastPaymentDate ? formatDate(c.lastPaymentDate) : '—'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.creditSales.slice(0, 3).map((cs) => (
                    <StatusBadge key={cs.id} status={cs.status} t={t} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {customers.length > 0 && totalPages > 1 && <div className="mt-4"><Pagination page={page} totalPages={totalPages} onPage={setPage} /></div>}

      <Modal open={modalOpen} onClose={() => { if (!saving) setModalOpen(false) }} title={editing ? t('editCustomer') : t('addCustomer')}>
        <form onSubmit={submit} className="space-y-4">
          <Input label={t('fullName')} value={form.fullName} onChange={(v) => setForm((f) => ({ ...f, fullName: v }))} required />
          <Input label={t('phone')} value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} required dir="ltr" />
          <Input label={t('address')} value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
          <Input label={t('notes')} value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
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
        message={`${t('confirmDelete')} ${deleting?.fullName ?? ''}`}
      />
    </div>
  )
}
