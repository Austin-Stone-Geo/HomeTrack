import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Household, Member } from '@/lib/types';

/**
 * Where the person is in getting started:
 * - not-configured: the app has no Supabase URL and key yet
 * - signed-out: needs to sign in
 * - no-household: signed in, but hasn't created or joined a household
 * - ready: signed in with a household
 */
export type AppStatus = 'loading' | 'not-configured' | 'signed-out' | 'no-household' | 'ready';

type HouseholdContextValue = {
  status: AppStatus;
  session: Session | null;
  household: Household | null;
  member: Member | null;
  /** Owners and adults can change things; kids can tick lists and do chores. */
  isAdult: boolean;
  /** Re-read the person's household, e.g. after creating or joining one. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(!isSupabaseConfigured);
  const [household, setHousehold] = useState<Household | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [householdLoaded, setHouseholdLoaded] = useState(false);

  // Track the signed-in session.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setHousehold(null);
      setMember(null);
      setHouseholdLoaded(true);
      return;
    }
    // v1 uses the first household the person joined.
    const { data, error } = await supabase
      .from('members')
      .select('*, households(*)')
      .eq('user_id', userId)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (error) console.warn('Could not load household', error.message);
    const { households, ...memberRow } = (data ?? {}) as Member & { households?: Household };
    setMember(data ? (memberRow as Member) : null);
    setHousehold(households ?? null);
    setHouseholdLoaded(true);
  }, [userId]);

  useEffect(() => {
    setHouseholdLoaded(false);
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const status: AppStatus = !isSupabaseConfigured
    ? 'not-configured'
    : !sessionLoaded
      ? 'loading'
      : !session
        ? 'signed-out'
        : !householdLoaded
          ? 'loading'
          : household
            ? 'ready'
            : 'no-household';

  const isAdult = member?.role === 'owner' || member?.role === 'adult';
  const value = useMemo(
    () => ({ status, session, household, member, isAdult, refresh, signOut }),
    [status, session, household, member, isAdult, refresh, signOut],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('useHousehold must be used inside HouseholdProvider');
  return value;
}

/** The current household; only call this on screens that require one. */
export function useRequiredHousehold() {
  const { household, member, isAdult } = useHousehold();
  if (!household || !member) throw new Error('No household loaded');
  return { household, member, isAdult };
}
