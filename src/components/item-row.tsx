import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isLow, setQuantity } from '@/lib/inventory';
import type { Item } from '@/lib/types';

export function formatQuantity(item: Pick<Item, 'quantity' | 'unit'>) {
  const qty = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(1);
  return item.unit ? `${qty} ${item.unit}` : qty;
}

function expiryNote(expiresOn: string | null) {
  if (!expiresOn) return null;
  // Compare calendar days in the person's own time zone.
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((Date.parse(expiresOn) - today) / 864e5);
  if (days < 0) return { text: 'Expired', urgent: true };
  if (days === 0) return { text: 'Expires today', urgent: true };
  if (days <= 3) return { text: `Expires in ${days} day${days === 1 ? '' : 's'}`, urgent: true };
  return { text: `Expires ${expiresOn}`, urgent: false };
}

/**
 * One inventory item with quick buttons. The quantity changes on screen right
 * away and is saved in the background.
 */
export function ItemRow({
  item,
  spaceName,
  canEdit = true,
}: {
  item: Item;
  spaceName?: string;
  canEdit?: boolean;
}) {
  const theme = useTheme();
  const [quantity, setLocalQuantity] = useState(item.quantity);
  const [error, setError] = useState(false);
  // Follow changes made elsewhere (another person, or the edit screen).
  const [seen, setSeen] = useState(item.quantity);
  if (item.quantity !== seen) {
    setSeen(item.quantity);
    setLocalQuantity(item.quantity);
  }

  async function change(next: number) {
    const previous = quantity;
    setLocalQuantity(Math.max(0, next));
    setError(false);
    try {
      await setQuantity(item.id, next);
    } catch {
      setLocalQuantity(previous);
      setError(true);
    }
  }

  const shown = { ...item, quantity };
  const low = isLow(shown);
  const expiry = expiryNote(item.expires_on);
  const details = [formatQuantity(shown), spaceName].filter(Boolean).join(' · ');

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.text, pressed && styles.pressed]}
        disabled={!canEdit}
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        accessibilityRole={canEdit ? 'button' : 'text'}
        accessibilityLabel={`${item.name}, ${details}${canEdit ? '. Edit' : ''}`}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {details}
        </ThemedText>
        {low || expiry || error ? (
          <View style={styles.badges}>
            {low ? (
              <ThemedText type="small" style={{ color: theme.warning }}>
                {quantity <= 0 ? 'Out' : 'Running low'}
              </ThemedText>
            ) : null}
            {expiry ? (
              <ThemedText
                type="small"
                style={{ color: expiry.urgent ? theme.danger : theme.textSecondary }}>
                {expiry.text}
              </ThemedText>
            ) : null}
            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                Couldn't save
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      {canEdit ? (
        <View style={styles.buttons}>
          <Button
            small
            kind="secondary"
            label="−"
            accessibilityLabel={`Use one ${item.name}`}
            onPress={() => change(quantity - 1)}
            disabled={quantity <= 0}
          />
          <Button
            small
            kind="secondary"
            label="+"
            accessibilityLabel={`Add one ${item.name}`}
            onPress={() => change(quantity + 1)}
          />
          <Button
            small
            kind="secondary"
            label="Out"
            accessibilityLabel={`Mark ${item.name} as out`}
            onPress={() => change(0)}
            disabled={quantity <= 0}
          />
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  text: {
    flex: 1,
    minWidth: 160,
    gap: Spacing.half,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
