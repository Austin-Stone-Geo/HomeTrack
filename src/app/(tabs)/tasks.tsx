import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  Button,
  ButtonRow,
  ChoiceChips,
  EmptyState,
  ErrorText,
  Screen,
  SectionLabel,
} from '@/components/screen';
import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { useRequiredHousehold } from '@/lib/household';
import { createTask, fetchMembers, fetchSpaces, fetchTasks } from '@/lib/inventory';
import { groupTasks, TaskTemplates, todayString } from '@/lib/tasks';
import type { Member, Space, Task } from '@/lib/types';
import { useLiveQuery } from '@/lib/use-live-query';

export default function TasksScreen() {
  const { household, member, isAdult } = useRequiredHousehold();
  const [whose, setWhose] = useState<'mine' | 'everyone'>('everyone');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tasks, members, spaces] = await Promise.all([
      fetchTasks(household.id),
      fetchMembers(household.id),
      fetchSpaces(household.id),
    ]);
    return { tasks, members, spaces };
  }, [household.id]);
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useLiveQuery(load, {
    householdId: household.id,
    tables: ['tasks'],
    initial: { tasks: [] as Task[], members: [] as Member[], spaces: [] as Space[] },
  });

  const nameOf = (id: string | null) => {
    if (!id) return 'Anyone';
    const m = data.members.find((x) => x.id === id);
    return m?.id === member.id ? 'You' : (m?.display_name ?? 'Someone');
  };
  const visible =
    whose === 'mine'
      ? data.tasks.filter((t) => t.assigned_to === member.id || t.assigned_to === null)
      : data.tasks;
  const groups = groupTasks(visible);
  const existingTitles = new Set(data.tasks.map((t) => t.title.toLowerCase()));
  const templates = TaskTemplates.filter((t) => !existingTitles.has(t.title.toLowerCase()));

  async function addTemplate(template: (typeof TaskTemplates)[number]) {
    setError(null);
    try {
      await createTask(household.id, {
        title: template.title,
        repeat_every: template.repeat_every,
        repeat_unit: template.repeat_unit,
        due_on: todayString(),
        space_id: data.spaces.find((s) => s.name === template.space)?.id ?? null,
        assigned_to: null,
        remind_at: '09:00:00',
        notes: null,
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen title="Tasks" subtitle="Chores and upkeep that come around again.">
      {isAdult ? (
        <ButtonRow>
          <Button
            label="Add task"
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new' } })}
          />
        </ButtonRow>
      ) : null}
      {data.tasks.length > 0 ? (
        <ChoiceChips
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'mine', label: 'Mine' },
          ]}
          value={whose}
          onChange={setWhose}
        />
      ) : null}
      <ErrorText>{error ?? loadError}</ErrorText>

      {groups.map((group) => (
        <GroupSection key={group.label} label={group.label}>
          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              who={nameOf(task.assigned_to)}
              canEdit={isAdult}
              onDone={reload}
            />
          ))}
        </GroupSection>
      ))}
      {!loading && visible.length === 0 ? (
        <EmptyState>{whose === 'mine' ? 'Nothing on your plate.' : 'No tasks yet.'}</EmptyState>
      ) : null}

      {isAdult && templates.length > 0 ? (
        <>
          <SectionLabel>Quick add</SectionLabel>
          <ThemedText type="small" themeColor="textSecondary">
            Tap one to add it, due today with a 9 AM reminder. You can change it after.
          </ThemedText>
          <ButtonRow>
            {templates.map((t) => (
              <Button
                key={t.title}
                small
                kind="secondary"
                label={`+ ${t.title}`}
                onPress={() => addTemplate(t)}
              />
            ))}
          </ButtonRow>
        </>
      ) : null}
    </Screen>
  );
}

function GroupSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </>
  );
}
