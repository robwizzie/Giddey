'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full bg-black/60 backdrop-blur-sm border-b border-white/10 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline">
          {/* Logo */}
          <img src="/logo.svg" alt="Giddey" className="w-9 h-9 rounded-lg" />
          <span className="text-xl font-black tracking-tight text-white">
            GIDDEY
          </span>
        </Link>
        <Link
          href="/how-to-play"
          className="text-xs font-semibold text-white/60 hover:text-white/90 transition-colors no-underline uppercase tracking-wider"
        >
          How to Play
        </Link>
      </div>
    </header>
  );
}
