'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { EmptyState, LoadingScreen } from '@/components/ui'
import { PageHeader } from '@/components/page-header'
import { signOut } from 'next-auth/react'

type ReportData = {
  summary: {
    totalRevenue: number
    totalProfit: number
    totalSales: number
    totalPayments: number
    creditOutstanding: number
    stockValue: number
  }
  topProducts: { id: string; name: string; sold: number; revenue: number; profit: number }[]
  lowStock: { id: string; name: string; sku: string; quantity: number }[]
  recentSales: { id: string; total: number; profit: number; createdAt: string; user: { name: string } }[]
  recentPayments: { id: string; amount: number; date: string; user: { name: string }; creditSale: { customer: { fullName: string } } }[]
}

export default function ReportsManager() {
  const { t, formatMoney, formatDateTime, formatNumber } = useI18n()
  const [data, setData] = useState<ReportData | null>(null)
  const [period, setPeriod] = useState('all')

  const fetchData = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/reports?period=${p}`)
      if (res.status === 401) { signOut(); return }
      setData(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [period])

  if (!data) return <LoadingScreen />
  const s = data.summary

  return (
    <div className="space-y-6">
      <PageHeader title={t('reportsTitle')} />

      <div className="flex flex-wrap gap-2">
        {(['all', 'today', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${period === p ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {t(p === 'all' ? 'all' : p)}
          </button>
        ))}
        <button
          onClick={() => {
            window.open(`/api/reports/export?period=${period}`, '_blank')
          }}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {t('exportPdf')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Summary label={t('totalRevenue')} value={formatMoney(s.totalRevenue)} />
        <Summary label={t('totalProfit')} value={formatMoney(s.totalProfit)} />
        <Summary label={t('totalSales')} value={formatNumber(s.totalSales)} />
        <Summary label={t('totalPayments')} value={formatMoney(s.totalPayments)} />
        <Summary label={t('totalCreditOutstanding')} value={formatMoney(s.creditOutstanding)} />
        <Summary label={t('stockValue')} value={formatMoney(s.stockValue)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700">{t('topProducts')}</h3>
          </div>
          {data.topProducts.length === 0 ? (
            <EmptyState message={t('noData')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-4 py-2 text-left">{t('productName')}</th>
                    <th className="px-4 py-2 text-left">{t('quantitySold')}</th>
                    <th className="px-4 py-2 text-left">{t('totalRevenue')}</th>
                    <th className="px-4 py-2 text-left">{t('profit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.sold}</td>
                      <td className="px-4 py-2.5 text-slate-700">{formatMoney(p.revenue)}</td>
                      <td className="px-4 py-2.5 text-emerald-600">{formatMoney(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700">{t('lowStock')}</h3>
          </div>
          {data.lowStock.length === 0 ? (
            <EmptyState message={t('noData')} />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.quantity === 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                    {p.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-700">{t('recentSales')}</h3>
        </div>
        {data.recentSales.length === 0 ? (
          <EmptyState message={t('noSales')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-4 py-2 text-left">{t('date')}</th>
                  <th className="px-4 py-2 text-left">{t('total')}</th>
                  <th className="px-4 py-2 text-left">{t('profit')}</th>
                  <th className="px-4 py-2 text-left">{t('user')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-4 py-2.5 text-slate-500">{formatDateTime(sale.createdAt)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{formatMoney(sale.total)}</td>
                    <td className="px-4 py-2.5 text-emerald-600">{formatMoney(sale.profit)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{sale.user.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg sm:text-xl font-bold text-slate-900" dir="ltr">{value}</p>
    </div>
  )
}
