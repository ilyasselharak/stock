'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'

export function MobileNav({ role, name }: { role: string; name: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="no-print sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-900">Stock Manager</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-900 truncate max-w-[110px]">{name}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{role === 'ADMIN' ? 'Admin' : 'Staff'}</p>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-2xl">
            <Sidebar role={role} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
