import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type UserPlan = 'free' | 'premium';

/**
 * Canonical premium gate — matches user_profiles.plan (updated by stripe-webhook).
 */
export function useUserPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<UserPlan>('free');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPlan('free');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[useUserPlan] fetch error:', error);
    } else {
      setPlan(data?.plan === 'premium' ? 'premium' : 'free');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, refresh]);

  return {
    plan,
    isPremium: plan === 'premium',
    loading,
    refresh,
  };
}
