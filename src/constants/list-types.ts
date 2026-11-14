import type { ListType } from '@/lib/types';

export const ListTypes: { value: ListType; label: string }[] = [
  { value: 'grocery', label: 'Grocery' },
  { value: 'todo', label: 'To-do' },
  { value: 'chores', label: 'Chores' },
  { value: 'custom', label: 'Other' },
];
