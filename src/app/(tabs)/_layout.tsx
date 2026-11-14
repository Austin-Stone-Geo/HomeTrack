import { useCallback, useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { useRequiredHousehold } from '@/lib/household';
import { fetchTasks } from '@/lib/inventory';
import { syncReminders } from '@/lib/reminders';
import type { Task } from '@/lib/types';
import { useLiveQuery } from '@/lib/use-live-query';

export default function TabsLayout() {
  const { household, member } = useRequiredHousehold();

  // Keep this phone's task reminders in step with the household's tasks.
  const load = useCallback(() => fetchTasks(household.id), [household.id]);
  const { data: tasks, loading } = useLiveQuery(load, {
    householdId: household.id,
    tables: ['tasks'],
    initial: [] as Task[],
  });
  useEffect(() => {
    if (!loading) syncReminders(tasks, member.id);
  }, [tasks, loading, member.id]);

  return <AppTabs />;
}
