'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Visão Geral', icon: '⬛' },
  { href: '/transgressoes', label: 'Transgressões', icon: '📈' },
  { href: '/benchmark', label: 'Benchmark', icon: '🔬' },
  { href: '/evolucao', label: 'Evolução', icon: '🌡️' },
  { href: '/ranking', label: 'Ranking', icon: '🏆' },
  { href: '/mapa', label: 'Mapa', icon: '🗺️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-[#111113] border-r border-white/5 flex flex-col z-40">
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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[#00C65A]/10 text-[#00C65A] font-medium'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
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
  );
}
