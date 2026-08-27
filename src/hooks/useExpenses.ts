// ─── useExpenses ───────────────────────────────────────────────────────────────────
//
// Fetches and manages expenses from the API.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { expensesApi } from '@/services/api';
import type { Expense } from '@/types/index';
import { ApiError } from '@/services/api';

interface UseExpensesReturn {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createExpense: (data: Parameters<typeof expensesApi.create>[0]) => Promise<Expense>;
}

export function useExpenses(): UseExpensesReturn {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await expensesApi.get();
      setExpenses(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const createExpense = useCallback(async (data: Parameters<typeof expensesApi.create>[0]) => {
    const created = await expensesApi.create(data);
    setExpenses(prev => [created, ...prev]);
    return created;
  }, []);

  return { expenses, loading, error, refetch, createExpense };
}
