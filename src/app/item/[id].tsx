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
  createItem,
  deleteItem,
  fetchItem,
  fetchSpaces,
  updateItem,
  type ItemInput,
} from '@/lib/inventory';
import type { Space } from '@/lib/types';

type Params = {
  id: string;
  // Optional pre-fills, e.g. from the barcode scanner or a space page.
  spaceId?: string;
  name?: string;
  barcode?: string;
  category?: string;
  unit?: string;
};

type Form = {
  name: string;
  spaceId: string | null;
  quantity: string;
  unit: string;
  minQuantity: string;
  expiresOn: string;
  category: string;
  notes: string;
  barcode: string;
};

function parseNumber(value: string) {
  const n = Number(value.replace(',', '.'));
  return value.trim() === '' || Number.isNaN(n) ? null : n;
}

export default function ItemScreen() {
  const params = useLocalSearchParams<Params>();
  const isNew = params.id === 'new';
  const { household } = useRequiredHousehold();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loadedSpaces = await fetchSpaces(household.id);
        const item = isNew ? null : await fetchItem(params.id);
        if (cancelled) return;
        setSpaces(loadedSpaces);
        if (!isNew && !item) {
          setError('This item was removed.');
          return;
        }
        setForm(
          item
            ? {
                name: item.name,
                spaceId: item.space_id,
                quantity: String(item.quantity),
                unit: item.unit ?? '',
                minQuantity: item.min_quantity == null ? '' : String(item.min_quantity),
                expiresOn: item.expires_on ?? '',
                category: item.category ?? '',
                notes: item.notes ?? '',
                barcode: item.barcode ?? '',
              }
            : {
                name: params.name ?? '',
                spaceId: params.spaceId ?? loadedSpaces[0]?.id ?? null,
                quantity: '1',
                unit: params.unit ?? '',
                minQuantity: '',
                expiresOn: '',
                category: params.category ?? '',
                notes: '',
                barcode: params.barcode ?? '',
              },
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    household.id,
    isNew,
    params.id,
    params.spaceId,
    params.name,
    params.unit,
    params.category,
    params.barcode,
  ]);

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

  async function save() {
    if (!form) return;
    setError(null);
    const quantity = parseNumber(form.quantity);
    const minQuantity = parseNumber(form.minQuantity);
    if (!form.name.trim()) return setError('Give the item a name.');
    if (!form.spaceId) return setError('Pick a space for the item.');
    if (quantity == null || quantity < 0)
      return setError('Quantity needs to be a number, 0 or more.');
    if (form.minQuantity.trim() && (minQuantity == null || minQuantity < 0))
      return setError('Minimum needs to be a number, 0 or more, or left blank.');
    if (form.expiresOn.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.expiresOn.trim()))
      return setError('Write the expiry date as YYYY-MM-DD, like 2026-12-31.');

    const input: ItemInput = {
      name: form.name.trim(),
      space_id: form.spaceId,
      quantity,
      unit: form.unit.trim() || null,
      min_quantity: minQuantity,
      expires_on: form.expiresOn.trim() || null,
      category: form.category.trim() || null,
      notes: form.notes.trim() || null,
      barcode: form.barcode.trim() || null,
    };
    setBusy(true);
    try {
      if (isNew) await createItem(input);
      else await updateItem(params.id, input);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Screen pushed>
      <Stack.Screen options={{ title: isNew ? 'Add item' : form.name || 'Item' }} />
      <TextField
        label="Name"
        value={form.name}
        onChangeText={(name) => set({ name })}
        placeholder="Basmati rice"
        autoFocus={isNew && !form.name}
      />
      <ChoiceChips
        label="Space"
        options={spaces.map((s) => ({ value: s.id, label: s.name }))}
        value={form.spaceId}
        onChange={(spaceId) => set({ spaceId })}
      />
      <TextField
        label="How many"
        value={form.quantity}
        onChangeText={(quantity) => set({ quantity })}
        keyboardType="decimal-pad"
      />
      <TextField
        label="Unit (optional)"
        value={form.unit}
        onChangeText={(unit) => set({ unit })}
        placeholder="bags, lbs, cans…"
      />
      <TextField
        label="Add to groceries when it drops to (optional)"
        value={form.minQuantity}
        onChangeText={(minQuantity) => set({ minQuantity })}
        keyboardType="decimal-pad"
        placeholder="Leave blank to add only when it's out"
      />

      <SectionLabel>More details</SectionLabel>
      <TextField
        label="Expires on (optional)"
        value={form.expiresOn}
        onChangeText={(expiresOn) => set({ expiresOn })}
        placeholder="YYYY-MM-DD"
        autoCorrect={false}
      />
      <TextField
        label="Category (optional)"
        value={form.category}
        onChangeText={(category) => set({ category })}
        placeholder="Grains, cleaning, bike parts…"
      />
      <TextField
        label="Notes (optional)"
        value={form.notes}
        onChangeText={(notes) => set({ notes })}
        multiline
        placeholder="Where it is, filter size, plant care…"
      />
      {form.barcode ? (
        <ThemedText type="small" themeColor="textSecondary">
          Barcode {form.barcode}
        </ThemedText>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <ButtonRow>
        <Button label={isNew ? 'Add item' : 'Save'} onPress={save} busy={busy} />
        <Button kind="quiet" label="Cancel" onPress={() => router.back()} />
      </ButtonRow>
      {!isNew ? (
        <ButtonRow>
          <ConfirmButton
            label="Remove item"
            confirmLabel="Remove it for good"
            onConfirm={async () => {
              try {
                await deleteItem(params.id);
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
