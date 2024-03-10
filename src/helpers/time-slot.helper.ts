import { ClassTimeSlot, ClassTimeSlotDto } from 'src/dtos';
import { convertTimestringToDate } from './convert-timestring-to-date.helper';
import { weekdayToNumber } from './convert-weekday-to-number.helper';
import { BadRequestException } from '@nestjs/common';

export function sanitizeTimeSlot(
  timeSlots: ClassTimeSlotDto[],
): ClassTimeSlot[] {
  return (
    timeSlots
      // Convert time string to Date type
      .map((timeSlot) => ({
        weekday: timeSlot.weekday,
        startTime: convertTimestringToDate(timeSlot.startTime),
        endTime: convertTimestringToDate(timeSlot.endTime),
      }))
      // Validate time slot duration
      .map((timeSlot) => {
        if (isValidTimeSlotDuration(timeSlot.startTime, timeSlot.endTime)) {
          return timeSlot;
        }
      })
      // Sort it in chrono-order
      .sort(
        (a, b) =>
          weekdayToNumber(a.weekday) - weekdayToNumber(b.weekday) ||
          a.startTime.getTime() - b.startTime.getTime(),
      )
      // Remove duplicate value if any
      .reduce((unique, o) => {
        if (
          !unique.some(
            (obj) =>
              obj.weekday === o.weekday &&
              obj.startTime.getTime() === o.startTime.getTime() &&
              obj.endTime.getTime() === o.endTime.getTime(),
          )
        ) {
          unique.push(o);
        }
        return unique;
      }, [])
  );
}

export function getNextTimeSlot(timeSlots: ClassTimeSlot[], currentDate: Date) {
  return (
    timeSlots.find(
      (slot) => weekdayToNumber(slot.weekday) >= currentDate.getDay(),
    ) || timeSlots[0]
  );
}

export function getNextSessionDate(
  currentDate: Date,
  nextTimeSlot: ClassTimeSlot,
) {
  const nextSessionDate = new Date(currentDate);
  nextSessionDate.setDate(
    nextSessionDate.getDate() +
      ((7 + weekdayToNumber(nextTimeSlot.weekday) - nextSessionDate.getDay()) %
        7),
  );
  return nextSessionDate;
}

export function isValidTimeSlotDuration(startTime: Date, endTime: Date) {
  const duration = endTime.getTime() - startTime.getTime();
  if (duration < 30 * 60 * 1000) { // 30 minutes in milliseconds
    throw new BadRequestException('Time slot duration must be at least 30 minutes');
  }
  if (duration >= 24 * 60 * 60 * 1000) { // 24 hours in milliseconds
    throw new BadRequestException('Time slot duration must be less than 1 day');
  }
  
  return true;
}