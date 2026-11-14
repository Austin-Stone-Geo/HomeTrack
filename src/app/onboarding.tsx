import { useState } from 'react';

import { Button, ButtonRow, ChoiceChips, ErrorText, Screen, TextField } from '@/components/screen';
import { useHousehold } from '@/lib/household';
import { createHousehold, joinHousehold } from '@/lib/inventory';

export default function OnboardingScreen() {
  const { session, refresh, signOut } = useHousehold();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [yourName, setYourName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!session) return;
    setError(null);
    if (mode === 'create' && !householdName.trim()) {
      setError('Give your household a name, like "Home" or "Elm Street".');
      return;
    }
    if (mode === 'join' && !code.trim()) {
      setError('Enter the invite code from someone in the household.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'create') {
        await createHousehold(householdName.trim(), session.user.id, yourName.trim());
      } else {
        await joinHousehold(code.trim(), yourName.trim());
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Set up your home"
      subtitle="Start a new household, or join one someone has already made.">
      <ChoiceChips
        options={[
          { value: 'create', label: 'Start a household' },
          { value: 'join', label: 'Join with a code' },
        ]}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setError(null);
        }}
      />
      <TextField
        label="Your name"
        value={yourName}
        onChangeText={setYourName}
        placeholder="What the household calls you"
      />
      {mode === 'create' ? (
        <TextField
          label="Household name"
          value={householdName}
          onChangeText={setHouseholdName}
          placeholder="Home"
          onSubmitEditing={submit}
        />
      ) : (
        <TextField
          label="Invite code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="8 letters and numbers"
          onSubmitEditing={submit}
        />
      )}
      <ErrorText>{error}</ErrorText>
      <ButtonRow>
        <Button
          label={mode === 'create' ? 'Create household' : 'Join household'}
          onPress={submit}
          busy={busy}
        />
        <Button kind="quiet" label="Sign out" onPress={signOut} />
      </ButtonRow>
    </Screen>
  );
}
