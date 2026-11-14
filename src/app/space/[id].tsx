import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { ConfirmButton } from '@/components/confirm-button';
import { ItemRow } from '@/components/item-row';
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
import { deleteSpace, fetchItems, fetchSpace, renameSpace } from '@/lib/inventory';
import type { Item, Space } from '@/lib/types';
import { useLiveQuery } from '@/lib/use-live-query';

export default function SpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, isAdult } = useRequiredHousehold();
  const [filter, setFilter] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [space, items] = await Promise.all([fetchSpace(id), fetchItems(household.id, id)]);
    return { space, items };
  }, [household.id, id]);
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useLiveQuery(load, {
    householdId: household.id,
    tables: ['spaces', 'items'],
    initial: { space: null as Space | null, items: [] as Item[] },
  });

  const term = filter.trim().toLowerCase();
  const items = term ? data.items.filter((i) => i.name.toLowerCase().includes(term)) : data.items;

  async function saveName() {
    if (!renaming?.trim()) return;
    try {
      await renameSpace(id, renaming.trim());
      setRenaming(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!loading && !data.space) {
    return (
      <Screen pushed>
        <Stack.Screen options={{ title: 'Space' }} />
        <EmptyState>This space was removed.</EmptyState>
      </Screen>
    );
  }

  return (
    <Screen pushed>
      <Stack.Screen options={{ title: data.space?.name ?? '' }} />
      {isAdult ? (
        <ButtonRow>
          <Button
            label="Add item"
            onPress={() =>
              router.push({ pathname: '/item/[id]', params: { id: 'new', spaceId: id } })
            }
          />
          {Platform.OS !== 'web' ? (
            <Button
              kind="secondary"
              label="Scan barcode"
              onPress={() => router.push({ pathname: '/scan', params: { spaceId: id } })}
            />
          ) : null}
        </ButtonRow>
      ) : null}
      {data.items.length > 6 ? (
        <TextField
          value={filter}
          onChangeText={setFilter}
          placeholder={`Filter ${data.space?.name ?? ''}`}
          accessibilityLabel="Filter items"
        />
      ) : null}
      <ErrorText>{loadError}</ErrorText>

      {items.map((item) => (
        <ItemRow key={item.id} item={item} canEdit={isAdult} />
      ))}
      {!loading && data.items.length === 0 ? (
        <EmptyState>Nothing here yet. Add an item, or scan one on your phone.</EmptyState>
      ) : null}

      {!isAdult ? null : <SectionLabel>About this space</SectionLabel>}
      {!isAdult ? null : renaming === null ? (
        <ButtonRow>
          <Button
            small
            kind="secondary"
            label="Rename"
            onPress={() => setRenaming(data.space?.name ?? '')}
          />
          <ConfirmButton
            small
            label="Delete space"
            confirmLabel={`Delete it and its ${data.items.length} item${data.items.length === 1 ? '' : 's'}`}
            onConfirm={async () => {
              try {
                await deleteSpace(id);
                router.back();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        </ButtonRow>
      ) : (
        <Card>
          <TextField
            label="Space name"
            value={renaming}
            onChangeText={setRenaming}
            autoFocus
            onSubmitEditing={saveName}
          />
          <ButtonRow>
            <Button small label="Save" onPress={saveName} />
            <Button small kind="quiet" label="Cancel" onPress={() => setRenaming(null)} />
          </ButtonRow>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
