import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ConfirmButton } from '@/components/confirm-button';
import { Button, ButtonRow, ChoiceChips, EmptyState, ErrorText, Screen, SectionLabel, TextField } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRequiredHousehold } from '@/lib/household';
import {
  addEntry,
  clearDoneEntries,
  completeEntry,
  deleteEntry,
  deleteList,
  fetchEntries,
  fetchList,
  fetchMembers,
  reopenEntry,
} from '@/lib/inventory';
import type { List, ListEntry, Member } from '@/lib/types';
import { useLiveQuery } from '@/lib/use-live-query';

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useRequiredHousehold();
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState<string>('anyone');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, entries, members] = await Promise.all([fetchList(id), fetchEntries(id), fetchMembers(household.id)]);
    return { list, entries, members };
  }, [household.id, id]);
  const { data, loading, error: loadError, reload } = useLiveQuery(load, {
    householdId: household.id,
    tables: ['lists', 'list_entries'],
    initial: { list: null as List | null, entries: [] as ListEntry[], members: [] as Member[] },
  });

  const { list, entries, members } = data;
  const isGrocery = list?.type === 'grocery';
  const canAssign = list?.type === 'todo' || list?.type === 'chores';
  const open = entries.filter((e) => !e.done);
  const done = entries.filter((e) => e.done);
  const memberName = (memberId: string | null) => {
    const m = members.find((x) => x.id === memberId);
    return m ? m.display_name || 'Someone' : null;
  };

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function add() {
    if (!text.trim()) return;
    const value = text.trim();
    setText('');
    await run(() => addEntry(id, value, assignee === 'anyone' ? null : assignee));
  }

  if (!loading && !list) {
    return (
      <Screen pushed>
        <Stack.Screen options={{ title: 'List' }} />
        <EmptyState>This list was removed.</EmptyState>
      </Screen>
    );
  }

  return (
    <Screen pushed>
      <Stack.Screen options={{ title: list?.name ?? '' }} />
      {isGrocery ? (
        <ThemedText type="small" themeColor="textSecondary">
          Things that run out at home land here by themselves. Ticking off a linked item adds it back to your stock.
        </ThemedText>
      ) : null}
      <TextField
        value={text}
        onChangeText={setText}
        placeholder={isGrocery ? 'Add something to buy' : 'Add to the list'}
        accessibilityLabel="New list entry"
        onSubmitEditing={add}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      {canAssign && members.length > 1 ? (
        <ChoiceChips
          label="For"
          options={[{ value: 'anyone', label: 'Anyone' }, ...members.map((m) => ({ value: m.id, label: m.display_name || 'Someone' }))]}
          value={assignee}
          onChange={setAssignee}
        />
      ) : null}
      <ButtonRow>
        <Button small label="Add" onPress={add} disabled={!text.trim()} />
      </ButtonRow>
      <ErrorText>{error ?? loadError}</ErrorText>

      {open.map((entry) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          note={[entry.item_id && isGrocery ? 'From your inventory' : null, memberName(entry.assigned_to)].filter(Boolean).join(' · ')}
          onToggle={() => run(() => completeEntry(entry.id))}
          onDelete={() => run(() => deleteEntry(entry.id))}
        />
      ))}
      {!loading && open.length === 0 ? <EmptyState>Nothing left on this list.</EmptyState> : null}

      {done.length > 0 ? (
        <>
          <SectionLabel right={<Button small kind="quiet" label="Clear done" onPress={() => run(() => clearDoneEntries(id))} />}>
            Done
          </SectionLabel>
          {done.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onToggle={() => run(() => reopenEntry(entry.id))}
              onDelete={() => run(() => deleteEntry(entry.id))}
            />
          ))}
        </>
      ) : null}

      <SectionLabel>About this list</SectionLabel>
      <ButtonRow>
        <ConfirmButton
          small
          label="Delete list"
          confirmLabel="Delete it for everyone"
          onConfirm={() =>
            run(async () => {
              await deleteList(id);
              router.back();
            })
          }
        />
      </ButtonRow>
    </Screen>
  );
}

function EntryRow({
  entry,
  note,
  onToggle,
  onDelete,
}: {
  entry: ListEntry;
  note?: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: entry.done }}
        accessibilityLabel={entry.text}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <View
          style={[
            styles.box,
            { borderColor: entry.done ? theme.tint : theme.textSecondary },
            entry.done && { backgroundColor: theme.tint },
          ]}>
          {entry.done ? <ThemedText style={[styles.check, { color: theme.onTint }]}>✓</ThemedText> : null}
        </View>
        <View style={styles.text}>
          <ThemedText
            type="small"
            themeColor={entry.done ? 'textSecondary' : 'text'}
            style={entry.done && styles.struck}>
            {entry.quantity ? `${entry.text} × ${entry.quantity}` : entry.text}
          </ThemedText>
          {note ? (
            <ThemedText type="small" themeColor="textSecondary">
              {note}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      <Button small kind="quiet" label="Remove" accessibilityLabel={`Remove ${entry.text}`} onPress={onDelete} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: 700,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  pressed: {
    opacity: 0.6,
  },
});
