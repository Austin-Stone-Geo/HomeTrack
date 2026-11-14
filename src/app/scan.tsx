import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Button, ButtonRow, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRequiredHousehold } from '@/lib/household';
import { findItemByBarcode, lookupBarcode } from '@/lib/inventory';

/**
 * Point the camera at a product barcode. If the household already has that
 * item, open it; otherwise look the product up and open a pre-filled
 * "Add item" form.
 */
export default function ScanScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId?: string }>();
  const { household } = useRequiredHousehold();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<string | null>(null);
  const handling = useRef(false);

  if (Platform.OS === 'web') {
    return (
      <Screen pushed>
        <ThemedText>Barcode scanning works in the phone app. On the web, add items by name instead.</ThemedText>
      </Screen>
    );
  }

  if (!permission) return <ThemedView style={styles.fill} />;

  if (!permission.granted) {
    return (
      <Screen pushed>
        <ThemedText>HomeTrack needs your camera to read barcodes. Nothing is recorded or saved.</ThemedText>
        <ButtonRow>
          <Button label="Allow camera" onPress={requestPermission} />
          <Button kind="quiet" label="Cancel" onPress={() => router.back()} />
        </ButtonRow>
      </Screen>
    );
  }

  async function onScanned(result: BarcodeScanningResult) {
    if (handling.current) return;
    handling.current = true;
    const barcode = result.data;
    try {
      setStatus('Checking your house…');
      const existing = await findItemByBarcode(household.id, barcode);
      if (existing) {
        router.replace({ pathname: '/item/[id]', params: { id: existing.id } });
        return;
      }
      setStatus('Looking up the product…');
      const product = await lookupBarcode(barcode);
      router.replace({
        pathname: '/item/[id]',
        params: {
          id: 'new',
          barcode,
          ...(spaceId ? { spaceId } : {}),
          ...(product
            ? { name: product.name, ...(product.category ? { category: product.category } : {}), ...(product.unit ? { unit: product.unit } : {}) }
            : {}),
        },
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
      handling.current = false;
    }
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.fill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] }}
        onBarcodeScanned={onScanned}
      />
      <ThemedView style={styles.panel}>
        {status ? (
          <View style={styles.statusRow}>
            <ActivityIndicator />
            <ThemedText type="small">{status}</ThemedText>
          </View>
        ) : (
          <ThemedText type="small">Hold a barcode inside the frame.</ThemedText>
        )}
        <Button kind="secondary" label="Type it in instead" onPress={() => router.replace({ pathname: '/item/[id]', params: { id: 'new', ...(spaceId ? { spaceId } : {}) } })} />
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  panel: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
