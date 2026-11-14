import { Card, Screen, SectionLabel } from '@/components/screen';
import { StarterSpaces } from '@/constants/starter-data';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function HomeScreen() {
  return (
    <Screen title="HomeTrack" subtitle="Everything in your home, and what it needs.">
      <Card
        title={isSupabaseConfigured ? 'Database connected' : 'Database not connected yet'}
        body={
          isSupabaseConfigured
            ? 'Sign-in and your household arrive in the next update.'
            : 'Add your Supabase URL and key to a .env file to connect. See the README.'
        }
      />

      <SectionLabel>Spaces</SectionLabel>
      {StarterSpaces.map((space) => (
        <Card key={space.name} title={space.name} body={space.blurb} />
      ))}
    </Screen>
  );
}
