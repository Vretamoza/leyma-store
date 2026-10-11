import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import type { BagLine } from '@leyma/core';
import { $bag } from './store';

/** La bolsa guardada solo existe en el navegador: hasta montar se devuelve vacía (evita desajustes de hidratación). */
export function useBag(): { lines: BagLine[]; ready: boolean } {
  const lines = useStore($bag);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return { lines: ready ? lines : [], ready };
}
