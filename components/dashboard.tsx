'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { LoadingScreen } from '@/components/ui'
import { BarChart } from '@/components/bar-chart'
import { signOut } from 'next-auth/react'

type DashboardData = {
  stats: {
    productCount: number
    stockValue: number
    todaySales: number
    todayProfit: number
    totalSales: number
    totalProfit: number
    creditOutstanding: number
    unpaidCreditCustomers: number
  }
  recentSales: {
    id: string
    total: number
    createdAt: string
    user: { name: string }
    items: { id: string; product: { name: string }; quantity: number }[]
  }[]
  recentPayments: {
    id: string
    amount: number
    date: string
    user: { name: string }
    creditSale: { customer: { fullName: string } }
  }[]
  charts: {
    sales30: { label: string; value: number }[]
    profit30: { label: string; value: number }[]
    payments30: { label: string; value: number }[]
  }
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 truncate" dir="ltr">{value}</p>
        </div>
      </div>
    </div>
  )
}

const ICONS = {
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  bank: 'M3 10h18M7 15h2m4 0h2m-8 4h10a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2zm10-6a3 3 0 11-6 0 3 3 0 016 0z',
  cart: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  chart: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512a9.025 9.025 0 015.488 5.488z',
  coin: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  trendingUp: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  alert: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
}

export default function DashboardPage() {
  const { t, formatMoney, formatDateTime, formatNumber } = useI18n()
  const [data, setData] = useState<DashboardData | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.status === 401) { signOut(); return }
      const body = await res.json()
      if (!res.ok || !body?.stats || !body?.charts) {
        console.error('Failed to load dashboard', res.status, body)
        return
      }
      setData(body)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  if (!data) return <LoadingScreen />

  const s = data.stats

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t('dashboard')}</h1>
        <p className="mt-1 text-sm text-slate-500">{new Date().toLocaleDateString()}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('totalProducts')} value={formatNumber(s.productCount)} icon={ICONS.box} accent="bg-indigo-50 text-indigo-600" />
        <StatCard label={t('totalStockValue')} value={formatMoney(s.stockValue)} icon={ICONS.bank} accent="bg-emerald-50 text-emerald-600" />
        <StatCard label={t('todaysSales')} value={formatMoney(s.todaySales)} icon={ICONS.cart} accent="bg-amber-50 text-amber-600" />
        <StatCard label={t('totalSales')} value={formatMoney(s.totalSales)} icon={ICONS.chart} accent="bg-sky-50 text-sky-600" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('todaysProfit')} value={formatMoney(s.todayProfit)} icon={ICONS.trendingUp} accent="bg-emerald-50 text-emerald-600" />
        <StatCard label={t('totalProfit')} value={formatMoney(s.totalProfit)} icon={ICONS.coin} accent="bg-violet-50 text-violet-600" />
        <StatCard label={t('totalCreditOutstanding')} value={formatMoney(s.creditOutstanding)} icon={ICONS.alert} accent="bg-rose-50 text-rose-600" />
        <StatCard label={t('customersWithUnpaidCredit')} value={formatNumber(s.unpaidCreditCustomers)} icon={ICONS.users} accent="bg-orange-50 text-orange-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{t('salesOverview')} — {t('last30Days')}</h3>
          <BarChart data={data.charts.sales30} color="#6366f1" formatValue={formatMoney} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{t('profitOverview')} — {t('last30Days')}</h3>
          <BarChart data={data.charts.profit30} color="#10b981" formatValue={formatMoney} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{t('creditPaymentsOverview')} — {t('last30Days')}</h3>
          <BarChart data={data.charts.payments30} color="#f59e0b" formatValue={formatMoney} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700">{t('recentSales')}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentSales.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">{t('noSales')}</p>
            ) : (
              data.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {sale.items.map((i) => i.product.name).join(', ') || t('sale')}
                    </p>
                    <p className="text-xs text-slate-400">{sale.user.name} · {formatDateTime(sale.createdAt)}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900" dir="ltr">{formatMoney(sale.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700">{t('recentPayments')}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentPayments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">{t('noPayments')}</p>
            ) : (
              data.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{p.creditSale.customer.fullName}</p>
                    <p className="text-xs text-slate-400">{p.user.name} · {formatDateTime(p.date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600" dir="ltr">{formatMoney(p.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
