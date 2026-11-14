import { Card, Screen, SectionLabel } from '@/components/screen';
import { StarterLists } from '@/constants/starter-data';

export default function ListsScreen() {
  return (
    <Screen title="Lists" subtitle="Groceries, to-dos, chores and any list you make.">
      <SectionLabel>Your lists</SectionLabel>
      {StarterLists.map((list) => (
        <Card key={list.name} title={list.name} body={list.blurb} />
      ))}
    </Screen>
  );
}
