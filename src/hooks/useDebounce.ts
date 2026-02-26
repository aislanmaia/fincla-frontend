import { useState, useEffect } from 'react';

/**
 * Retorna um valor debounced: só atualiza após `delay` ms sem mudanças.
 * Útil para campos de busca que disparam requisições à API.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
