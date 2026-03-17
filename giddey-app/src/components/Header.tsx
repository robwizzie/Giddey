'use client';

import Link from 'next/link';

interface HeaderProps {
  talent?: number;
  chem?: number;
  total?: number;
}

export default function Header({ talent, chem, total }: HeaderProps) {
  return (
    <header className='w-full bg-[#1a1a1a] border-b border-white/10 px-4 py-3 shrink-0'>
      <div className='flex items-center justify-between'>
        <Link href='/' className='flex items-center gap-2 no-underline'>
          <img src='/logo.png' alt='Giddey' className='w-9 h-9 rounded-lg' />
          <span className='text-xl font-black tracking-tight text-white'>GIDDEY</span>
        </Link>
        {talent !== undefined && (
          <div className='flex items-center gap-2'>
            {([
              { label: 'Talent', value: talent, color: '#f97316' },
              { label: 'Chem', value: chem, color: '#4ade80' },
              { label: 'Total', value: total, color: '#ffffff' },
            ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
              <div key={label} className='bg-[#333] rounded-md px-2.5 py-1 text-center min-w-[44px]'>
                <div className='text-base font-bold leading-none' style={{ color }}>{value}</div>
                <div className='text-[9px] text-white/50 uppercase tracking-wide mt-0.5'>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
