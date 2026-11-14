import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Task } from '@/lib/types';

/**
 * Reminders are scheduled on each phone for the tasks that are that
 * person's: assigned to them, or not assigned to anyone. They are rebuilt
 * from the task list whenever it changes, so edits made by anyone in the
 * household are picked up the next time the app is open.
 *
 * These are "local" notifications, which work in Expo Go. Reminders that
 * arrive even when nobody has opened the app for days need server-sent
 * push notifications, which need a custom app build (a later step).
 */

// iOS allows 64 pending notifications per app.
const MAX_SCHEDULED = 60;

let handlerSet = false;
let lastSignature = '';

function setHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** When a task's reminder should fire, or null if it has none. */
export function reminderDate(task: Pick<Task, 'due_on' | 'remind_at'>) {
  if (!task.remind_at) return null;
  const [h, m] = task.remind_at.split(':').map(Number);
  const [y, mo, d] = task.due_on.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0);
}

export type Reminder = { task: Task; at: Date; late: boolean };

/**
 * Which tasks this person should be reminded about, soonest first. A task
 * whose reminder time has already passed without it being done gets one
 * more nudge at the same time tomorrow.
 */
export function tasksToRemind(tasks: Task[], memberId: string, now = new Date()): Reminder[] {
  const reminders: Reminder[] = [];
  for (const task of tasks) {
    if (!task.active || (task.assigned_to !== null && task.assigned_to !== memberId)) continue;
    const at = reminderDate(task);
    if (!at) continue;
    if (at > now) {
      reminders.push({ task, at, late: false });
    } else {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(at.getHours(), at.getMinutes(), 0, 0);
      reminders.push({ task, at: next, late: true });
    }
  }
  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}

export async function syncReminders(tasks: Task[], memberId: string) {
  if (Platform.OS === 'web') return;
  const upcoming = tasksToRemind(tasks, memberId);
  const signature = upcoming.map((r) => `${r.task.id}@${r.at.getTime()}`).join('|');
  if (signature === lastSignature) return;

  try {
    setHandler();
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && upcoming.length > 0 && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Task reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const { task, at, late } of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: task.title,
          body: late
            ? 'Still to do. Open HomeTrack to mark it done.'
            : 'Due today. Open HomeTrack to mark it done.',
          data: { taskId: task.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: 'reminders',
        },
      });
    }
    lastSignature = signature;
  } catch (e) {
    console.warn('Could not schedule reminders', e);
  }
}
