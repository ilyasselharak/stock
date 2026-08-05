'use client'

import { useI18n } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'

export default function SettingsManager() {
  const { t, lang, setLang, formatMoney } = useI18n()

  return (
    <div className="space-y-6">
      <PageHeader title={t('settingsTitle')} subtitle={t('settingsDescription')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700">{t('languagePref')}</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => setLang('fr')}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${lang === 'fr' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              Français
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${lang === 'ar' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              العربية
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700">{t('currency')}</h3>
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">{t('currency')}: <span className="font-semibold text-slate-900">MAD / DH</span></p>
            <p className="mt-2 text-sm text-slate-500">{t('mad')} — {formatMoney(1234.5)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
