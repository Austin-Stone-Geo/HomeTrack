import type { RepeatUnit, Task } from '@/lib/types';

/** Today's date as YYYY-MM-DD in the person's own time zone. */
export function todayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days from today to a YYYY-MM-DD date (negative when overdue). */
export function daysUntil(date: string) {
  return Math.round((Date.parse(date) - Date.parse(todayString())) / 864e5);
}

export function dueLabel(date: string) {
  const days = daysUntil(date);
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return 'Due yesterday';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days} days`;
  const d = new Date(`${date}T12:00:00`);
  return `Due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

const UnitNames: Record<RepeatUnit, [string, string]> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['year', 'years'],
};

export function repeatLabel(task: Pick<Task, 'repeat_every' | 'repeat_unit'>) {
  if (!task.repeat_every || !task.repeat_unit) return 'One time';
  if (task.repeat_every === 1) {
    return { day: 'Every day', week: 'Every week', month: 'Every month', year: 'Every year' }[
      task.repeat_unit
    ];
  }
  return `Every ${task.repeat_every} ${UnitNames[task.repeat_unit][1]}`;
}

/** "09:00:00" → "9 AM", "18:30:00" → "6:30 PM". */
export function timeLabel(time: string | null) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

export type TaskGroup = { label: string; tasks: Task[] };

/** Splits tasks into Overdue, Today, This week and Later. */
export function groupTasks(tasks: Task[]): TaskGroup[] {
  const groups: TaskGroup[] = [
    { label: 'Overdue', tasks: [] },
    { label: 'Today', tasks: [] },
    { label: 'This week', tasks: [] },
    { label: 'Later', tasks: [] },
  ];
  for (const task of tasks) {
    const days = daysUntil(task.due_on);
    const index = days < 0 ? 0 : days === 0 ? 1 : days < 7 ? 2 : 3;
    groups[index].tasks.push(task);
  }
  return groups.filter((g) => g.tasks.length > 0);
}

/** Common household jobs offered as one-tap starting points. */
export const TaskTemplates: {
  title: string;
  repeat_every: number;
  repeat_unit: RepeatUnit;
  space?: string;
}[] = [
  { title: 'Take out the trash', repeat_every: 1, repeat_unit: 'week' },
  { title: 'Water the plants', repeat_every: 1, repeat_unit: 'week', space: 'Houseplants' },
  { title: 'Vacuum', repeat_every: 1, repeat_unit: 'week' },
  { title: 'Do the laundry', repeat_every: 1, repeat_unit: 'week' },
  { title: 'Mow the lawn', repeat_every: 1, repeat_unit: 'week' },
  { title: 'Replace the furnace filter', repeat_every: 3, repeat_unit: 'month' },
  { title: 'Change the car oil', repeat_every: 6, repeat_unit: 'month' },
  { title: 'Clean the gutters', repeat_every: 6, repeat_unit: 'month' },
  { title: 'Wax the skis', repeat_every: 1, repeat_unit: 'month', space: 'Gear' },
  { title: 'Tune up the bikes', repeat_every: 1, repeat_unit: 'year', space: 'Gear' },
];
