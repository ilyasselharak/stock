'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import { Button, EmptyState, Input, LoadingScreen, Modal, SearchInput } from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'
import {
  analyzeInventory,
  type ExtraItem,
  type InventoryLine,
  type InventoryProduct,
} from '@/lib/inventory-analysis'

type Draft = {
  startedAt: string
  counts: Record<string, number>
  extras: ExtraItem[]
}

type Filter = 'all' | 'notCounted' | 'counted' | 'differences'

const STORAGE_KEY = 'inventory-count'

function newDraft(): Draft {
  return { startedAt: new Date().toISOString(), counts: {}, extras: [] }
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      if (d && typeof d.counts === 'object' && Array.isArray(d.extras)) return d
    }
  } catch {}
  return newDraft()
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n)
}

export default function InventoryManager() {
  const { t, formatMoney, formatDateTime } = useI18n()
  const { toast } = useToast()
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [extraForm, setExtraForm] = useState({ name: '', quantity: '1' })
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory')
      if (res.status === 401) { signOut(); return }
      const data = await res.json()
      setProducts(data.products || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setDraft(loadDraft())
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    if (!draft) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch {}
  }, [draft])

  const emptyCounts = useMemo<Record<string, number>>(() => ({}), [])
  const emptyExtras = useMemo<ExtraItem[]>(() => [], [])
  const counts = draft?.counts ?? emptyCounts
  const extras = draft?.extras ?? emptyExtras

  function setCount(id: string, value: number) {
    setDraft((d) => (d ? { ...d, counts: { ...d.counts, [id]: Math.max(0, value) } } : d))
  }

  function clearCount(id: string) {
    setDraft((d) => {
      if (!d) return d
      const next = { ...d.counts }
      delete next[id]
      return { ...d, counts: next }
    })
  }

  function increment(id: string, by: number) {
    setCount(id, (counts[id] ?? 0) + by)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.sku.toLowerCase().includes(q) &&
        !(p.brand || '').toLowerCase().includes(q)
      )
        return false
      const isCounted = p.id in counts
      if (filter === 'notCounted') return !isCounted
      if (filter === 'counted') return isCounted
      if (filter === 'differences') return isCounted && counts[p.id] !== p.quantity
      return true
    })
  }, [products, counts, search, filter])

  // Enter in the search box counts one unit: exact SKU match first (barcode scanners
  // type the SKU then Enter), otherwise the single remaining result.
  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    const q = search.trim().toLowerCase()
    if (!q) return
    const exact = products.find((p) => p.sku.toLowerCase() === q)
    const target = exact ?? (filtered.length === 1 ? filtered[0] : null)
    if (!target) {
      toast(t('noProducts'), 'error')
      return
    }
    const next = (counts[target.id] ?? 0) + 1
    setCount(target.id, next)
    toast(`${target.name} → ${next}`, 'info')
    setSearch('')
  }

  function addExtra(e: React.FormEvent) {
    e.preventDefault()
    const name = extraForm.name.trim()
    const quantity = Math.max(0, parseInt(extraForm.quantity) || 0)
    if (!name) return
    setDraft((d) =>
      d ? { ...d, extras: [...d.extras, { id: crypto.randomUUID(), name, quantity }] } : d
    )
    setExtraForm({ name: '', quantity: '1' })
  }

  function updateExtra(id: string, quantity: number) {
    setDraft((d) =>
      d ? { ...d, extras: d.extras.map((x) => (x.id === id ? { ...x, quantity: Math.max(0, quantity) } : x)) } : d
    )
  }

  function removeExtra(id: string) {
    setDraft((d) => (d ? { ...d, extras: d.extras.filter((x) => x.id !== id) } : d))
  }

  function reset() {
    setDraft(newDraft())
    setResetOpen(false)
    setAnalysisOpen(false)
    fetchProducts()
  }

  const analysis = useMemo(() => analyzeInventory(products, counts, extras), [products, counts, extras])

  async function exportPdf() {
    if (!draft) return
    setExporting(true)
    try {
      const res = await fetch('/api/inventory/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error || 'Error', 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventaire-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setExporting(false)
    }
  }

  const countedCount = analysis.countedProducts
  const progress = products.length ? Math.round((countedCount / products.length) * 100) : 0

  return (
    <div>
      <PageHeader
        title={t('inventory')}
        subtitle={`${countedCount} / ${products.length} ${t('productsCounted')}${draft ? ` · ${t('startedAt')} ${formatDateTime(draft.startedAt)}` : ''}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setResetOpen(true)} className="flex-1 sm:flex-none">
              {t('resetCount')}
            </Button>
            <Button onClick={() => setAnalysisOpen(true)} disabled={loading} className="flex-1 sm:flex-none">
              {t('finishCount')}
            </Button>
          </div>
        }
      />

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1" onKeyDown={onSearchKeyDown}>
          <SearchInput value={search} onChange={setSearch} placeholder={t('scanHint')} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'notCounted', 'counted', 'differences'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t(f)}
            </button>
          ))}
        </div>
      </div>

      {loading || !draft ? (
        <LoadingScreen />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState message={t('noProducts')} />
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filtered.map((p) => {
            const isCounted = p.id in counts
            const value = counts[p.id] ?? 0
            const diff = value - p.quantity
            return (
              <div
                key={p.id}
                className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${isCounted ? '' : 'bg-slate-50/60'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {p.sku}
                    {p.brand ? ` · ${p.brand}` : ''} · {t('currentStock')}: <span className="font-semibold text-slate-700">{p.quantity}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex min-w-[4.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      !isCounted
                        ? 'bg-slate-100 text-slate-500'
                        : diff === 0
                          ? 'bg-emerald-50 text-emerald-600'
                          : diff > 0
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {!isCounted ? t('notCountedOne') : diff === 0 ? '✓' : signed(diff)}
                  </span>

                  <div className="flex items-center rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => (isCounted ? increment(p.id, -1) : setCount(p.id, 0))}
                      className="h-10 w-10 text-lg font-semibold text-slate-500 hover:bg-slate-50 rounded-s-xl transition"
                      aria-label="-1"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={value}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCount(p.id, parseInt(e.target.value) || 0)}
                      className={`h-10 w-16 border-x border-slate-200 text-center text-sm font-semibold outline-none focus:bg-indigo-50 ${
                        isCounted ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => increment(p.id, 1)}
                      className="h-10 w-10 text-lg font-semibold text-indigo-600 hover:bg-indigo-50 rounded-e-xl transition"
                      aria-label="+1"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => clearCount(p.id)}
                    disabled={!isCounted}
                    title={t('clearCount')}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:invisible transition"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l5 5m-5-5l5-5" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Items found on the shelf that don't exist in the system */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('extraItems')}</h2>
        <p className="mb-4 text-sm text-slate-500">{t('extraItemsHint')}</p>
        <form onSubmit={addExtra} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input label={t('name')} value={extraForm.name} onChange={(v) => setExtraForm((f) => ({ ...f, name: v }))} required />
          </div>
          <div className="sm:w-28">
            <Input label={t('quantity')} type="number" min="0" value={extraForm.quantity} onChange={(v) => setExtraForm((f) => ({ ...f, quantity: v }))} />
          </div>
          <Button type="submit">+ {t('addItem')}</Button>
        </form>
        {extras.length > 0 && (
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {extras.map((x) => (
              <div key={x.id} className="flex items-center gap-3 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{x.name}</p>
                <div className="flex items-center rounded-xl border border-slate-200">
                  <button type="button" onClick={() => updateExtra(x.id, x.quantity - 1)} className="h-9 w-9 font-semibold text-slate-500 hover:bg-slate-50 rounded-s-xl">−</button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={x.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateExtra(x.id, parseInt(e.target.value) || 0)}
                    className="h-9 w-14 border-x border-slate-200 text-center text-sm font-semibold outline-none"
                  />
                  <button type="button" onClick={() => updateExtra(x.id, x.quantity + 1)} className="h-9 w-9 font-semibold text-indigo-600 hover:bg-indigo-50 rounded-e-xl">+</button>
                </div>
                <button
                  type="button"
                  onClick={() => removeExtra(x.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  title={t('delete')}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={analysisOpen} onClose={() => setAnalysisOpen(false)} title={t('analysis')} wide>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t('productsCounted')} value={`${analysis.countedProducts} / ${analysis.totalProducts}`} />
            <Stat label={t('unitsExpected')} value={String(analysis.expectedUnits)} />
            <Stat label={t('unitsCounted')} value={String(analysis.countedUnits)} />
            <Stat label={t('matched')} value={String(analysis.matched.length)} tone="good" />
            <Stat label={t('differences')} value={String(analysis.surplus.length + analysis.shortage.length)} tone={analysis.surplus.length + analysis.shortage.length ? 'bad' : 'good'} />
            <Stat label={t('valueDifference')} value={formatMoney(analysis.valueDiff)} tone={analysis.valueDiff < 0 ? 'bad' : analysis.valueDiff > 0 ? 'warn' : 'good'} />
          </div>

          <DiffSection title={t('shortage')} lines={analysis.shortage} tone="bad" empty={t('none')} />
          <DiffSection title={t('surplus')} lines={analysis.surplus} tone="warn" empty={t('none')} />

          <Section title={`${t('notCounted')} (${analysis.notCounted.length})`}>
            {analysis.notCounted.length === 0 ? (
              <p className="text-sm text-slate-400">{t('allCounted')}</p>
            ) : (
              <SimpleTable
                head={[t('name'), t('sku'), t('currentStock')]}
                rows={analysis.notCounted.map((l) => [l.name, l.sku, String(l.quantity)])}
              />
            )}
          </Section>

          <Section title={`${t('extraItems')} (${analysis.extras.length})`}>
            {analysis.extras.length === 0 ? (
              <p className="text-sm text-slate-400">{t('none')}</p>
            ) : (
              <SimpleTable head={[t('name'), t('countedQty')]} rows={analysis.extras.map((x) => [x.name, String(x.quantity)])} />
            )}
          </Section>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setAnalysisOpen(false)}>{t('close')}</Button>
            <Button onClick={exportPdf} loading={exporting}>{t('exportPdf')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t('resetCount')}>
        <p className="text-sm text-slate-600">{t('resetCountConfirm')}</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>{t('cancel')}</Button>
          <Button variant="danger" onClick={reset}>{t('resetCount')}</Button>
        </div>
      </Modal>
    </div>
  )
}

const toneText = { good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-rose-600', neutral: 'text-slate-900' }

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: keyof typeof toneText }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneText[tone]}`}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  )
}

function SimpleTable({ head, rows, tones }: { head: string[]; rows: string[][]; tones?: (string | undefined)[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${i === 0 ? 'text-start' : 'text-end'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={`px-3 py-2 ${ci === 0 ? 'text-start font-medium text-slate-900' : `text-end ${tones?.[ci] ?? 'text-slate-600'}`}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiffSection({ title, lines, tone, empty }: { title: string; lines: InventoryLine[]; tone: 'warn' | 'bad'; empty: string }) {
  const { t, formatMoney } = useI18n()
  const color = toneText[tone]
  return (
    <Section title={`${title} (${lines.length})`}>
      {lines.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <SimpleTable
          head={[t('name'), t('currentStock'), t('countedQty'), t('difference'), t('valueDifference')]}
          rows={lines.map((l) => [l.name, String(l.quantity), String(l.counted), signed(l.diff), formatMoney(l.valueDiff)])}
          tones={[undefined, undefined, undefined, `font-semibold ${color}`, color]}
        />
      )}
    </Section>
  )
}
