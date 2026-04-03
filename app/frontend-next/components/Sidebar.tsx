'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { href: '/', label: 'Visão Geral', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/transgressoes', label: 'Transgressões', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { href: '/benchmark', label: 'Benchmark', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/evolucao', label: 'Evolução', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/ranking', label: 'Ranking', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
  { href: '/mapa', label: 'Mapa', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
];

const PAGE_LABELS: Record<string, string> = {
  '/': 'Visão Geral',
  '/transgressoes': 'Transgressões',
  '/benchmark': 'Benchmark',
  '/evolucao': 'Evolução',
  '/ranking': 'Ranking',
  '/mapa': 'Mapa',
};

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-[#111113] border-b border-white/5 flex items-center px-4 z-50">
        <button
          onClick={() => setOpen(!open)}
          className="text-zinc-400 hover:text-zinc-100 mr-3"
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
        <span className="text-xs text-zinc-500 uppercase tracking-widest">TCC</span>
        <span className="text-xs text-zinc-500 mx-1.5">/</span>
        <span className="text-sm text-zinc-100 font-medium">
          {PAGE_LABELS[pathname] ?? 'Dashboard'}
        </span>
      </div>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-56 bg-[#111113] border-r border-white/5 flex flex-col z-50 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">TCC</p>
          <p className="text-sm font-semibold text-zinc-100 leading-tight mt-0.5">
            REN 1000/2021
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-[#00C65A]/10 text-[#00C65A] font-medium'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
              >
                <NavIcon d={icon} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5">
          <p className="text-xs text-zinc-600">ANEEL · 2011–2023</p>
        </div>
      </aside>
    </>
  );
}

/** Breadcrumb for desktop topbar */
export function Breadcrumb() {
  const pathname = usePathname();
  const label = PAGE_LABELS[pathname] ?? 'Dashboard';

  return (
    <div className="hidden md:flex items-center h-10 px-6 border-b border-white/5 bg-[#111113]/50 backdrop-blur-sm text-xs text-zinc-500">
      <span>Dashboard</span>
      <span className="mx-1.5">/</span>
      <span className="text-zinc-200 font-medium">{label}</span>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-zinc-600">ANEEL · REN 1.000/2021</span>
        <span className="px-2 py-0.5 rounded bg-[#00C65A]/10 text-[#00C65A] text-[10px] font-semibold">
          Dados 2011–2025
        </span>
      </div>
    </div>
  );
}
