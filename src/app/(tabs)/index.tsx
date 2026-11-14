import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { TaskRow } from '@/components/task-row';
import {
  Button,
  ButtonRow,
  Card,
  EmptyState,
  ErrorText,
  Screen,
  SectionLabel,
  TextField,
} from '@/components/screen';
import { useRequiredHousehold } from '@/lib/household';
import {
  createSpace,
  fetchItems,
  fetchMembers,
  fetchSpaces,
  fetchTasks,
  isLow,
} from '@/lib/inventory';
import { daysUntil } from '@/lib/tasks';
import type { Item, Member, Space, Task } from '@/lib/types';
import { useLiveQuery } from '@/lib/use-live-query';

export default function HomeScreen() {
  const { household, member, isAdult } = useRequiredHousehold();
  const [search, setSearch] = useState('');
  const [newSpace, setNewSpace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [spaces, items, tasks, members] = await Promise.all([
      fetchSpaces(household.id),
      fetchItems(household.id),
      fetchTasks(household.id),
      fetchMembers(household.id),
    ]);
    return { spaces, items, tasks, members };
  }, [household.id]);
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useLiveQuery(load, {
    householdId: household.id,
    tables: ['spaces', 'items', 'tasks'],
    initial: {
      spaces: [] as Space[],
      items: [] as Item[],
      tasks: [] as Task[],
      members: [] as Member[],
    },
  });

  const spaceNames = useMemo(() => new Map(data.spaces.map((s) => [s.id, s.name])), [data.spaces]);
  const term = search.trim().toLowerCase();
  const matches = term
    ? data.items.filter((item) =>
        [item.name, item.category, item.notes, item.barcode].some((v) =>
          v?.toLowerCase().includes(term),
        ),
      )
    : [];
  const lowItems = data.items.filter(isLow);
  // Tasks for this person (or anyone) that are overdue or due by tomorrow.
  const dueSoon = data.tasks.filter(
    (t) => (t.assigned_to === null || t.assigned_to === member.id) && daysUntil(t.due_on) <= 1,
  );

  async function addSpace() {
    if (!newSpace?.trim()) return;
    setError(null);
    try {
      const sortOrder = Math.max(0, ...data.spaces.map((s) => s.sort_order)) + 10;
      const space = await createSpace(household.id, newSpace.trim(), sortOrder);
      setNewSpace(null);
      router.push({ pathname: '/space/[id]', params: { id: space.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen title={household.name} subtitle="Everything in your home, and what it needs.">
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Search everything in the house"
        accessibilityLabel="Search everything in the house"
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
      {isAdult ? (
        <ButtonRow>
          <Button
            label="Add item"
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: 'new' } })}
          />
          {Platform.OS !== 'web' ? (
            <Button kind="secondary" label="Scan barcode" onPress={() => router.push('/scan')} />
          ) : null}
        </ButtonRow>
      ) : null}
      <ErrorText>{loadError}</ErrorText>

      {term ? (
        <>
          <SectionLabel>{`${matches.length} match${matches.length === 1 ? '' : 'es'}`}</SectionLabel>
          {matches.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              spaceName={spaceNames.get(item.space_id)}
              canEdit={isAdult}
            />
          ))}
          {matches.length === 0 ? (
            <EmptyState>Nothing in the house matches that.</EmptyState>
          ) : null}
        </>
      ) : (
        <>
          {dueSoon.length > 0 ? (
            <>
              <SectionLabel>Your tasks due soon</SectionLabel>
              {dueSoon.map((task) => (
                <TaskRow key={task.id} task={task} canEdit={isAdult} onDone={reload} />
              ))}
            </>
          ) : null}

          {lowItems.length > 0 ? (
            <>
              <SectionLabel>Running low</SectionLabel>
              {lowItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  spaceName={spaceNames.get(item.space_id)}
                  canEdit={isAdult}
                />
              ))}
            </>
          ) : null}

          <SectionLabel>Spaces</SectionLabel>
          {data.spaces.map((space) => {
            const count = data.items.filter((i) => i.space_id === space.id).length;
            return (
              <Card
                key={space.id}
                title={space.name}
                body={count === 0 ? 'Nothing here yet' : `${count} item${count === 1 ? '' : 's'}`}
                onPress={() => router.push({ pathname: '/space/[id]', params: { id: space.id } })}
              />
            );
          })}
          {!loading && data.spaces.length === 0 ? <EmptyState>No spaces yet.</EmptyState> : null}

          {!isAdult ? null : newSpace === null ? (
            <Button kind="quiet" label="+ Add a space" onPress={() => setNewSpace('')} />
          ) : (
            <Card>
              <TextField
                label="New space"
                value={newSpace}
                onChangeText={setNewSpace}
                placeholder="Basement, Bathroom, Camper…"
                autoFocus
                onSubmitEditing={addSpace}
              />
              <ErrorText>{error}</ErrorText>
              <ButtonRow>
                <Button small label="Add space" onPress={addSpace} />
                <Button small kind="quiet" label="Cancel" onPress={() => setNewSpace(null)} />
              </ButtonRow>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
