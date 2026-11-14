import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { completeTask } from '@/lib/inventory';
import { daysUntil, dueLabel, repeatLabel } from '@/lib/tasks';
import type { Task } from '@/lib/types';

/** One task with its due date, schedule, who it's for and a Done button. */
export function TaskRow({
  task,
  who,
  canEdit,
  onDone,
}: {
  task: Task;
  who?: string | null;
  canEdit: boolean;
  onDone?: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = daysUntil(task.due_on);
  const dueColor = days < 0 ? theme.danger : days === 0 ? theme.warning : theme.textSecondary;
  const details = [repeatLabel(task), who].filter(Boolean).join(' · ');

  async function done() {
    setBusy(true);
    setError(null);
    try {
      await completeTask(task.id);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const text = (
    <>
      <ThemedText type="smallBold">{task.title}</ThemedText>
      <ThemedText type="small" style={{ color: dueColor }}>
        {dueLabel(task.due_on)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {details}
      </ThemedText>
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </>
  );

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      {canEdit ? (
        <Pressable
          style={({ pressed }) => [styles.text, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${task.title}, ${dueLabel(task.due_on)}. Edit`}>
          {text}
        </Pressable>
      ) : (
        <View style={styles.text}>{text}</View>
      )}
      <Button
        small
        label="Done"
        accessibilityLabel={`Mark ${task.title} done`}
        onPress={done}
        busy={busy}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.6,
  },
});
