import { useState } from 'react';

import { Button, ButtonRow, Card, ErrorText, Screen, TextField } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <Screen title="HomeTrack" subtitle="Everything in your home, and what it needs.">
        <Card
          title="Database not connected yet"
          body="Add your Supabase URL and key to a .env file, then restart the app. The README walks through it."
        />
      </Screen>
    );
  }
  const client = supabase;

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError('Enter your email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    const credentials = { email: email.trim(), password };
    const { data, error: authError } =
      mode === 'sign-in'
        ? await client.auth.signInWithPassword(credentials)
        : await client.auth.signUp(credentials);
    setBusy(false);
    if (authError) {
      setError(authError.message);
    } else if (mode === 'sign-up' && !data.session) {
      // Supabase sends a confirmation email when that setting is on.
      setNotice('Check your email for a confirmation link, then come back and sign in.');
      setMode('sign-in');
    }
    // On success the app moves on by itself.
  }

  return (
    <Screen
      title="HomeTrack"
      subtitle={mode === 'sign-in' ? 'Sign in to your household.' : 'Create an account to get started.'}>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      {notice ? <ThemedText type="small">{notice}</ThemedText> : null}
      <ButtonRow>
        <Button label={mode === 'sign-in' ? 'Sign in' : 'Create account'} onPress={submit} busy={busy} />
        <Button
          kind="quiet"
          label={mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in'}
          onPress={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
          }}
        />
      </ButtonRow>
    </Screen>
  );
}
