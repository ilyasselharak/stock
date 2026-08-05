'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { fr, ar } from './translations'

export type Lang = 'fr' | 'ar'

type I18nContextType = {
  lang: Lang
  dir: 'ltr' | 'rtl'
  t: (key: string) => string
  setLang: (lang: Lang) => void
  formatMoney: (n: number) => string
  formatDate: (d: string | Date) => string
  formatDateTime: (d: string | Date) => string
  formatNumber: (n: number) => string
}

const translations: Record<Lang, Record<string, string>> = { fr, ar }

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    const saved = (localStorage.getItem('lang') as Lang) || 'fr'
    setLangState(saved)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = l
  }, [])

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key: string) => translations[lang][key] ?? translations.fr[key] ?? key,
    [lang]
  )

  const formatMoney = useCallback(
    (n: number) => {
      const num = n || 0
      return new Intl.NumberFormat(lang === 'ar' ? 'ar-MA' : 'fr-MA', {
        style: 'currency',
        currency: 'MAD',
        maximumFractionDigits: 2,
      }).format(num)
    },
    [lang]
  )

  const formatDate = useCallback(
    (d: string | Date) => {
      const date = typeof d === 'string' ? new Date(d) : d
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date)
    },
    [lang]
  )

  const formatDateTime = useCallback(
    (d: string | Date) => {
      const date = typeof d === 'string' ? new Date(d) : d
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    },
    [lang]
  )

  const formatNumber = useCallback(
    (n: number) => {
      return new Intl.NumberFormat(lang === 'ar' ? 'ar-MA' : 'fr-FR').format(n || 0)
    },
    [lang]
  )

  return (
    <I18nContext.Provider
      value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, setLang, formatMoney, formatDate, formatDateTime, formatNumber }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
