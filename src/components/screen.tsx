import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared page frame: an optional big title and subtitle, then scrolling
 * content. Tab pages use the default; pages pushed on top of the tabs pass
 * `pushed` because they already have a navigation header.
 */
export function Screen({
  title,
  subtitle,
  pushed = false,
  children,
}: {
  title?: string;
  subtitle?: string;
  pushed?: boolean;
  children: ReactNode;
}) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={pushed ? ['left', 'right'] : ['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.content, pushed ? styles.contentPushed : styles.contentTabs]}
          keyboardShouldPersistTaps="handled">
          {title ? <ThemedText type="subtitle">{title}</ThemedText> : null}
          {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Full-screen spinner while something loads. */
export function Loading() {
  const theme = useTheme();
  return (
    <ThemedView style={styles.loading}>
      <ActivityIndicator color={theme.tint} />
    </ThemedView>
  );
}

/** A rounded card. Pass `onPress` to make it tappable. */
export function Card({
  title,
  body,
  right,
  onPress,
  children,
}: {
  title?: string;
  body?: string;
  right?: ReactNode;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const inner = (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardText}>
          {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
          {body ? (
            <ThemedText type="small" themeColor="textSecondary">
              {body}
            </ThemedText>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </ThemedView>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {inner}
    </Pressable>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
        {children.toUpperCase()}
      </ThemedText>
      {right}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'quiet';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  small,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const background =
    kind === 'primary' ? theme.tint : kind === 'quiet' ? 'transparent' : theme.backgroundSelected;
  const color =
    kind === 'primary' ? theme.onTint : kind === 'danger' ? theme.danger : kind === 'quiet' ? theme.tint : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: background },
        (pressed || disabled) && styles.pressed,
      ]}>
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type="smallBold" style={{ color }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function TextField({ label, ...props }: TextInputProps & { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        {...props}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          props.multiline && styles.inputMultiline,
          props.style,
        ]}
      />
    </View>
  );
}

/** A row of choices where exactly one is picked. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                { borderColor: selected ? theme.tint : theme.border },
                selected && { backgroundColor: theme.tint },
              ]}>
              <ThemedText type="small" style={{ color: selected ? theme.onTint : theme.text }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ErrorText({ children }: { children: string | null | undefined }) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
      {children}
    </ThemedText>
  );
}

export function EmptyState({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
      {children}
    </ThemedText>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  contentTabs: {
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.four : Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  contentPushed: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardText: {
    flex: 1,
    gap: Spacing.half,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
  },
  section: {
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: {
    minHeight: 36,
    minWidth: 44,
    paddingHorizontal: Spacing.two + Spacing.one,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: Spacing.two + Spacing.one,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: Spacing.two,
  },
});
