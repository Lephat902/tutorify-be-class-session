import { BadRequestException } from '@nestjs/common';
import { Weekday } from '@tutorify/shared';

export function weekdayToNumber(weekday: Weekday): number {
  switch (weekday) {
    case Weekday.SUNDAY:
      return 0;
    case Weekday.MONDAY:
      return 1;
    case Weekday.TUESDAY:
      return 2;
    case Weekday.WEDNESDAY:
      return 3;
    case Weekday.THURSDAY:
      return 4;
    case Weekday.FRIDAY:
      return 5;
    case Weekday.SATURDAY:
      return 6;
    default:
      throw new BadRequestException('Invalid weekday');
  }
}
