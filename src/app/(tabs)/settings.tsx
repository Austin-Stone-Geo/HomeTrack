import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, ButtonRow, Card, ErrorText, Screen, SectionLabel, TextField } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHousehold, useRequiredHousehold } from '@/lib/household';
import { fetchMembers, updateDisplayName } from '@/lib/inventory';
import type { Member, MemberRole } from '@/lib/types';
import { useLiveQuery } from '@/lib/use-live-query';

const RoleLabels: Record<MemberRole, string> = { owner: 'Owner', adult: 'Adult', kid: 'Kid' };

export default function HouseholdScreen() {
  const { household, member } = useRequiredHousehold();
  const { session, refresh, signOut } = useHousehold();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => fetchMembers(household.id), [household.id]);
  const { data: members, reload } = useLiveQuery(load, {
    householdId: household.id,
    tables: [],
    initial: [] as Member[],
  });

  async function saveName() {
    if (name === null) return;
    setError(null);
    try {
      await updateDisplayName(member.id, name.trim());
      setName(null);
      await Promise.all([reload(), refresh()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen title="Household" subtitle={household.name}>
      <SectionLabel>Invite someone</SectionLabel>
      <Card body="Share this code with a partner, roommate or family member. They pick “Join with a code” after creating their account.">
        <ThemedText type="subtitle" selectable style={styles.code} accessibilityLabel={`Invite code ${household.invite_code.split('').join(' ')}`}>
          {household.invite_code}
        </ThemedText>
      </Card>

      <SectionLabel>Members</SectionLabel>
      {members.map((m) => (
        <Card
          key={m.id}
          title={`${m.display_name || 'No name yet'}${m.id === member.id ? ' (you)' : ''}`}
          body={RoleLabels[m.role]}
        />
      ))}

      <SectionLabel>You</SectionLabel>
      {name === null ? (
        <Card title={member.display_name || 'No name yet'} body={session?.user.email ?? undefined}>
          <ButtonRow>
            <Button small kind="secondary" label="Change your name" onPress={() => setName(member.display_name ?? '')} />
            <Button small kind="secondary" label="Sign out" onPress={signOut} />
          </ButtonRow>
        </Card>
      ) : (
        <Card>
          <TextField label="Your name" value={name} onChangeText={setName} autoFocus onSubmitEditing={saveName} />
          <ErrorText>{error}</ErrorText>
          <ButtonRow>
            <Button small label="Save" onPress={saveName} />
            <Button small kind="quiet" label="Cancel" onPress={() => setName(null)} />
          </ButtonRow>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: {
    letterSpacing: Spacing.one,
  },
});
