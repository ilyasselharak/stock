'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import { Button, ConfirmDialog, EmptyState, Input, LoadingScreen, Modal, Select } from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'

type User = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'STAFF'
  active: boolean
  createdAt: string
}

export default function UsersManager({ currentUserId }: { currentUserId: string }) {
  const { t, formatDateTime } = useI18n()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' as 'ADMIN' | 'STAFF', active: true })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (res.status === 401) { signOut(); return }
      if (res.status === 403) { toast(t('noPermission'), 'error'); return }
      setUsers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', email: '', password: '', role: 'STAFF', active: true })
    setModalOpen(true)
  }

  function openEdit(u: User) {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, active: u.active })
    setModalOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: {
        name: string
        email: string
        role: 'ADMIN' | 'STAFF'
        active: boolean
        password?: string
      } = {
        name: form.name,
        email: form.email,
        role: form.role,
        active: form.active,
      }
      if (form.password) body.password = form.password
      const res = await fetch(editing ? `/api/users?id=${editing.id}` : '/api/users', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Error', 'error')
        return
      }
      toast(editing ? t('userUpdated') : t('userCreated'))
      setModalOpen(false)
      fetchUsers()
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    const res = await fetch(`/api/users?id=${deleting.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      toast(t('userDeleted'))
      setDeleting(null)
      fetchUsers()
    } else {
      toast(data.error || 'Error', 'error')
    }
    setDeleteLoading(false)
  }

  return (
    <div>
      <PageHeader
        title={t('staffManagement')}
        action={<Button onClick={openCreate} className="w-full sm:w-auto">+ {t('addUser')}</Button>}
      />

      {loading ? (
        <LoadingScreen />
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState message={t('allUsers')} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t('name')}</th>
                  <th className="px-4 py-3">{t('email')}</th>
                  <th className="px-4 py-3">{t('role')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                  <th className="px-4 py-3">{t('created')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.name}
                      {u.id === currentUserId && <span className="ml-2 text-xs text-indigo-500">(vous)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                        {t(u.role.toLowerCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {u.active ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition" title={t('edit')}>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {u.role !== 'ADMIN' && u.id !== currentUserId && (
                          <button onClick={() => setDeleting(u)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition" title={t('delete')}>
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
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { if (!saving) setModalOpen(false) }} title={editing ? t('editUser') : t('addUser')}>
        <form onSubmit={submit} className="space-y-4">
          <Input label={t('name')} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
          <Input label={t('email')} type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
          <Input
            label={t('password')}
            type="password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            required={!editing}
            hint={editing ? 'Laisser vide pour conserver' : 'Min 6 caractères'}
          />
          <Select label={t('role')} value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v as 'ADMIN' | 'STAFF' }))}>
            <option value="STAFF">{t('staff')}</option>
            <option value="ADMIN">{t('admin')}</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            {t('active')}
          </label>
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
