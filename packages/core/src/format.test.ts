import { describe, expect, it } from 'vitest';
import { formatCOP } from './format';

describe('formatCOP', () => {
  it('formatea pesos colombianos sin decimales ni espacio', () => {
    expect(formatCOP(45000)).toBe('$45.000');
    expect(formatCOP(5000)).toBe('$5.000');
    expect(formatCOP(1250000)).toBe('$1.250.000');
    expect(formatCOP(0)).toBe('$0');
  });
});
