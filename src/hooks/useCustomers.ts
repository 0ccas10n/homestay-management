// ─── useCustomers ────────────────────────────────────────────────────────────────
//
// Fetches all customers from the API.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { customersApi } from '@/services/api';
import type { Customer } from '@/types/index';
import { ApiError } from '@/services/api';

interface UseCustomersReturn {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCustomers(): UseCustomersReturn {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customersApi.getAll();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  return { customers, loading, error, refetch };
}
