'use client';

import { useEffect, useState } from 'react';

interface Props {
  urls: string[];
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  /** rendered once every url has failed */
  fallback: React.ReactNode;
}

/** <img> that walks a list of sources on error, then shows a fallback */
export default function Headshot({ urls, alt, style, className, fallback }: Props) {
  const [idx, setIdx] = useState(0);
  const key = urls.join('|');
  useEffect(() => setIdx(0), [key]);
  if (idx >= urls.length) return <>{fallback}</>;
  return (
    <img
      key={urls[idx]}
      src={urls[idx]}
      alt={alt}
      referrerPolicy='no-referrer'
      draggable={false}
      onError={() => setIdx(i => i + 1)}
      className={className}
      style={style}
    />
  );
}
