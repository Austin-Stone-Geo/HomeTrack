import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

let channelCount = 0;

/**
 * Runs a Supabase query and re-runs it whenever any of the given tables
 * change for this household, so everyone in the home sees edits live. It
 * also re-runs when the screen comes back into view, so it stays fresh even
 * if the live connection drops.
 *
 * `load` should be stable between renders (wrap it in useCallback).
 */
export function useLiveQuery<T>(
  load: () => Promise<T>,
  options: { householdId: string; tables: string[]; initial: T },
) {
  const { householdId, tables, initial } = options;
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      const result = await loadRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load when the screen comes into view, and whenever the query changes.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [load, reload]),
  );

  const tableKey = tables.join(',');
  useEffect(() => {
    if (!supabase || !tableKey) return;
    const client = supabase;
    const channel = client.channel(`live-${tableKey}-${householdId}-${++channelCount}`);
    for (const table of tableKey.split(',')) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        () => {
          reload();
        },
      );
    }
    channel.subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [householdId, tableKey, reload]);

  return { data, loading, error, reload };
}

/** Throws the Supabase error, if any, so callers can use try/catch. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
