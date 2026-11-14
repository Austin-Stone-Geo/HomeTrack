import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { Button, ButtonRow, Card, EmptyState, ErrorText, Screen, SectionLabel, TextField } from '@/components/screen';
import { useRequiredHousehold } from '@/lib/household';
import { createSpace, fetchItems, fetchSpaces, isLow } from '@/lib/inventory';
import type { Item, Space } from '@/lib/types';
import { useLiveQuery } from '@/lib/use-live-query';

export default function HomeScreen() {
  const { household } = useRequiredHousehold();
  const [search, setSearch] = useState('');
  const [newSpace, setNewSpace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [spaces, items] = await Promise.all([fetchSpaces(household.id), fetchItems(household.id)]);
    return { spaces, items };
  }, [household.id]);
  const { data, loading, error: loadError } = useLiveQuery(load, {
    householdId: household.id,
    tables: ['spaces', 'items'],
    initial: { spaces: [] as Space[], items: [] as Item[] },
  });

  const spaceNames = useMemo(() => new Map(data.spaces.map((s) => [s.id, s.name])), [data.spaces]);
  const term = search.trim().toLowerCase();
  const matches = term
    ? data.items.filter((item) =>
        [item.name, item.category, item.notes, item.barcode].some((v) => v?.toLowerCase().includes(term))
      )
    : [];
  const lowItems = data.items.filter(isLow);

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
      <ButtonRow>
        <Button label="Add item" onPress={() => router.push({ pathname: '/item/[id]', params: { id: 'new' } })} />
        {Platform.OS !== 'web' ? (
          <Button kind="secondary" label="Scan barcode" onPress={() => router.push('/scan')} />
        ) : null}
      </ButtonRow>
      <ErrorText>{loadError}</ErrorText>

      {term ? (
        <>
          <SectionLabel>{`${matches.length} match${matches.length === 1 ? '' : 'es'}`}</SectionLabel>
          {matches.map((item) => (
            <ItemRow key={item.id} item={item} spaceName={spaceNames.get(item.space_id)} />
          ))}
          {matches.length === 0 ? <EmptyState>Nothing in the house matches that.</EmptyState> : null}
        </>
      ) : (
        <>
          {lowItems.length > 0 ? (
            <>
              <SectionLabel>Running low</SectionLabel>
              {lowItems.map((item) => (
                <ItemRow key={item.id} item={item} spaceName={spaceNames.get(item.space_id)} />
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

          {newSpace === null ? (
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
