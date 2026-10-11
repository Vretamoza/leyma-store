import { persistentAtom } from '@nanostores/persistent';
import { addLine, parseBag, removeLine, setQuantity, type AddResult, type BagLine, type Customer } from '@leyma/core';

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** La bolsa vive en localStorage y se comparte entre el contador del header, la ficha y /bolsa. */
export const $bag = persistentAtom<BagLine[]>('leyma:bag', [], {
  encode: JSON.stringify,
  decode: (value) => parseBag(safeParse(value)),
});

export const $customer = persistentAtom<Customer>('leyma:customer', {}, {
  encode: JSON.stringify,
  decode: (value) => {
    const raw = safeParse(value) as Customer | null;
    return {
      name: typeof raw?.name === 'string' ? raw.name.slice(0, 80) : '',
      city: typeof raw?.city === 'string' ? raw.city.slice(0, 120) : '',
    };
  },
});

export function addToBag(line: Omit<BagLine, 'quantity'>, quantity: number, stock?: number): AddResult {
  const result = addLine($bag.get(), line, quantity, stock);
  if (result.added > 0) $bag.set(result.lines);
  return result;
}

export function changeQuantity(variantId: string, quantity: number, stock?: number) {
  $bag.set(setQuantity($bag.get(), variantId, quantity, stock));
}

export function removeFromBag(variantId: string) {
  $bag.set(removeLine($bag.get(), variantId));
}
