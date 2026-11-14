import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { Button, ButtonRow, Card, ChoiceChips, EmptyState, ErrorText, Screen, SectionLabel, TextField } from '@/components/screen';
import { useRequiredHousehold } from '@/lib/household';
import { createList, fetchLists, type ListWithCount } from '@/lib/inventory';
import type { ListType } from '@/lib/types';
import { ListTypes } from '@/constants/list-types';
import { useLiveQuery } from '@/lib/use-live-query';

export default function ListsScreen() {
  const { household } = useRequiredHousehold();
  const [draft, setDraft] = useState<{ name: string; type: ListType } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => fetchLists(household.id), [household.id]);
  const { data: lists, loading, error: loadError } = useLiveQuery(load, {
    householdId: household.id,
    tables: ['lists', 'list_entries'],
    initial: [] as ListWithCount[],
  });

  async function add() {
    if (!draft?.name.trim()) return setError('Give the list a name.');
    setError(null);
    try {
      const sortOrder = Math.max(0, ...lists.map((l) => l.sort_order)) + 10;
      const list = await createList(household.id, draft.name.trim(), draft.type, sortOrder);
      setDraft(null);
      router.push({ pathname: '/list/[id]', params: { id: list.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen title="Lists" subtitle="Groceries, to-dos, chores and any list you make.">
      <ErrorText>{loadError}</ErrorText>
      <SectionLabel>Your lists</SectionLabel>
      {lists.map((list) => (
        <Card
          key={list.id}
          title={list.name}
          body={`${ListTypes.find((t) => t.value === list.type)?.label ?? ''} · ${
            list.open === 0 ? 'All done' : `${list.open} to go`
          }`}
          onPress={() => router.push({ pathname: '/list/[id]', params: { id: list.id } })}
        />
      ))}
      {!loading && lists.length === 0 ? <EmptyState>No lists yet.</EmptyState> : null}

      {draft === null ? (
        <Button kind="quiet" label="+ New list" onPress={() => setDraft({ name: '', type: 'todo' })} />
      ) : (
        <Card>
          <TextField
            label="List name"
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            placeholder="Costco run, Garage projects…"
            autoFocus
            onSubmitEditing={add}
          />
          <ChoiceChips label="Kind of list" options={ListTypes} value={draft.type} onChange={(type) => setDraft({ ...draft, type })} />
          <ErrorText>{error}</ErrorText>
          <ButtonRow>
            <Button small label="Create list" onPress={add} />
            <Button small kind="quiet" label="Cancel" onPress={() => setDraft(null)} />
          </ButtonRow>
        </Card>
      )}
    </Screen>
  );
}
