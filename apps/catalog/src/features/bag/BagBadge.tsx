import { useEffect, useRef, useState } from 'react';
import { bagUnits } from '@leyma/core';
import { useBag } from './useBag';

/** Contador del header: rebota un instante cuando se agrega algo. */
export default function BagBadge() {
  const { lines } = useBag();
  const count = bagUnits(lines);
  const previous = useRef(count);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (count > previous.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 350);
      previous.current = count;
      return () => clearTimeout(t);
    }
    previous.current = count;
  }, [count]);

  if (count === 0) return null;
  return (
    <span
      className={`absolute right-1 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-primary px-[5px] text-[11px] font-semibold text-bg md:static md:h-5 md:min-w-5 md:rounded-[10px] md:px-1.5 md:text-xs ${bump ? 'bag-bump' : ''}`}
    >
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{count === 1 ? '1 producto en la bolsa' : `${count} productos en la bolsa`}</span>
    </span>
  );
}
