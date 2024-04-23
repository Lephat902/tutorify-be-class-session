import { Weekday } from '@tutorify/shared';

export function weekdayToNumber(weekday: Weekday): number {
  const weekdaysStrings = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return weekdaysStrings.indexOf(weekday);
}
