import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ConfirmButton } from '@/components/confirm-button';
import {
  Button,
  ButtonRow,
  ChoiceChips,
  ErrorText,
  Loading,
  Screen,
  SectionLabel,
  TextField,
} from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useRequiredHousehold } from '@/lib/household';
import {
  createTask,
  deleteTask,
  fetchMembers,
  fetchRecentCompletions,
  fetchSpaces,
  fetchTask,
  updateTask,
  type TaskInput,
} from '@/lib/inventory';
import { todayString } from '@/lib/tasks';
import type { Member, RepeatUnit, Space } from '@/lib/types';

type Unit = RepeatUnit | 'once';

type Form = {
  title: string;
  every: string;
  unit: Unit;
  dueOn: string;
  assignedTo: string;
  remindAt: string;
  spaceId: string;
  notes: string;
};

const Units: { value: Unit; label: string }[] = [
  { value: 'once', label: 'One time' },
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
];

const Presets: { label: string; every: string; unit: Unit }[] = [
  { label: 'Weekly', every: '1', unit: 'week' },
  { label: 'Every 2 weeks', every: '2', unit: 'week' },
  { label: 'Monthly', every: '1', unit: 'month' },
  { label: 'Every 3 months', every: '3', unit: 'month' },
  { label: 'Every 6 months', every: '6', unit: 'month' },
  { label: 'Yearly', every: '1', unit: 'year' },
];

const ReminderTimes = [
  { value: 'none', label: 'No reminder' },
  { value: '07:00:00', label: '7 AM' },
  { value: '09:00:00', label: '9 AM' },
  { value: '12:00:00', label: 'Noon' },
  { value: '18:00:00', label: '6 PM' },
  { value: '20:00:00', label: '8 PM' },
];

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { household } = useRequiredHousehold();
  const [members, setMembers] = useState<Member[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [history, setHistory] = useState<{ id: string; user_id: string | null; done_at: string }[]>(
    [],
  );
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, s, task, done] = await Promise.all([
          fetchMembers(household.id),
          fetchSpaces(household.id),
          isNew ? Promise.resolve(null) : fetchTask(id),
          isNew ? Promise.resolve([]) : fetchRecentCompletions(id),
        ]);
        if (cancelled) return;
        setMembers(m);
        setSpaces(s);
        setHistory(done);
        if (!isNew && !task) {
          setError('This task was removed.');
          return;
        }
        setForm(
          task
            ? {
                title: task.title,
                every: task.repeat_every ? String(task.repeat_every) : '1',
                unit: task.repeat_unit ?? 'once',
                dueOn: task.due_on,
                assignedTo: task.assigned_to ?? 'anyone',
                remindAt: task.remind_at ?? 'none',
                spaceId: task.space_id ?? 'none',
                notes: task.notes ?? '',
              }
            : {
                title: '',
                every: '1',
                unit: 'week',
                dueOn: todayString(),
                assignedTo: 'anyone',
                remindAt: '09:00:00',
                spaceId: 'none',
                notes: '',
              },
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [household.id, id, isNew]);

  if (!form) {
    return error ? (
      <Screen pushed>
        <ErrorText>{error}</ErrorText>
      </Screen>
    ) : (
      <Loading />
    );
  }

  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const memberName = (userId: string | null) =>
    members.find((m) => m.user_id === userId)?.display_name || 'Someone';

  async function save() {
    if (!form) return;
    setError(null);
    const every = Number(form.every);
    if (!form.title.trim()) return setError('Give the task a name.');
    if (form.unit !== 'once' && (!Number.isInteger(every) || every < 1 || every > 365))
      return setError('"Repeat every" needs a whole number from 1 to 365.');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(form.dueOn.trim()) ||
      Number.isNaN(Date.parse(form.dueOn.trim()))
    )
      return setError('Write the due date as YYYY-MM-DD, like 2026-12-01.');

    const input: TaskInput = {
      title: form.title.trim(),
      repeat_every: form.unit === 'once' ? null : every,
      repeat_unit: form.unit === 'once' ? null : form.unit,
      due_on: form.dueOn.trim(),
      assigned_to: form.assignedTo === 'anyone' ? null : form.assignedTo,
      remind_at: form.remindAt === 'none' ? null : form.remindAt,
      space_id: form.spaceId === 'none' ? null : form.spaceId,
      notes: form.notes.trim() || null,
    };
    setBusy(true);
    try {
      if (isNew) await createTask(household.id, input);
      else await updateTask(id, input);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const presetValue =
    Presets.find((p) => p.every === form.every && p.unit === form.unit)?.label ?? null;

  return (
    <Screen pushed>
      <Stack.Screen options={{ title: isNew ? 'Add task' : form.title || 'Task' }} />
      <TextField
        label="Task"
        value={form.title}
        onChangeText={(title) => set({ title })}
        placeholder="Replace the furnace filter"
        autoFocus={isNew}
      />

      <SectionLabel>How often</SectionLabel>
      <ChoiceChips
        options={Presets.map((p) => ({ value: p.label, label: p.label }))}
        value={presetValue}
        onChange={(label) => {
          const p = Presets.find((x) => x.label === label)!;
          set({ every: p.every, unit: p.unit });
        }}
      />
      <ChoiceChips
        label="Or repeat every…"
        options={Units}
        value={form.unit}
        onChange={(unit) => set({ unit })}
      />
      {form.unit !== 'once' ? (
        <TextField
          label={`Number of ${form.unit}s`}
          value={form.every}
          onChangeText={(every) => set({ every })}
          keyboardType="number-pad"
        />
      ) : null}

      <SectionLabel>When</SectionLabel>
      <ChoiceChips
        label="Next due"
        options={[
          { value: todayString(), label: 'Today' },
          { value: todayString(1), label: 'Tomorrow' },
          { value: todayString(7), label: 'In a week' },
        ]}
        value={form.dueOn}
        onChange={(dueOn) => set({ dueOn })}
      />
      <TextField
        label="Or a date"
        value={form.dueOn}
        onChangeText={(dueOn) => set({ dueOn })}
        placeholder="YYYY-MM-DD"
        autoCorrect={false}
      />
      <ChoiceChips
        label="Remind on the due date at"
        options={ReminderTimes}
        value={form.remindAt}
        onChange={(remindAt) => set({ remindAt })}
      />

      <SectionLabel>Who and where</SectionLabel>
      <ChoiceChips
        label="Who does it"
        options={[
          { value: 'anyone', label: 'Anyone' },
          ...members.map((m) => ({ value: m.id, label: m.display_name || 'Someone' })),
        ]}
        value={form.assignedTo}
        onChange={(assignedTo) => set({ assignedTo })}
      />
      <ChoiceChips
        label="Space (optional)"
        options={[
          { value: 'none', label: 'None' },
          ...spaces.map((s) => ({ value: s.id, label: s.name })),
        ]}
        value={form.spaceId}
        onChange={(spaceId) => set({ spaceId })}
      />
      <TextField
        label="Notes (optional)"
        value={form.notes}
        onChangeText={(notes) => set({ notes })}
        multiline
        placeholder="Filter size 16x25x1, oil type 0W-20…"
      />

      <ErrorText>{error}</ErrorText>
      <ButtonRow>
        <Button label={isNew ? 'Add task' : 'Save'} onPress={save} busy={busy} />
        <Button kind="quiet" label="Cancel" onPress={() => router.back()} />
      </ButtonRow>

      {history.length > 0 ? (
        <>
          <SectionLabel>Recently done</SectionLabel>
          {history.map((h) => (
            <ThemedText key={h.id} type="small" themeColor="textSecondary">
              {new Date(h.done_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              by {memberName(h.user_id)}
            </ThemedText>
          ))}
        </>
      ) : null}

      {!isNew ? (
        <ButtonRow>
          <ConfirmButton
            label="Delete task"
            confirmLabel="Delete it for everyone"
            onConfirm={async () => {
              try {
                await deleteTask(id);
                router.back();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        </ButtonRow>
      ) : null}
    </Screen>
  );
}
