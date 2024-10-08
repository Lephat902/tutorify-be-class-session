import { ClassTimeSlot, ClassTimeSlotDto } from 'src/dtos';
import { convertTimestringToDate } from './convert-timestring-to-date.helper';
import { weekdayToNumber } from './convert-weekday-to-number.helper';
import { BadRequestException } from '@nestjs/common';
import { setTimeToDate } from './set-time-to-date.helper';

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

export function isEndTimeInThePast(endDatetime: Date) {
  return endDatetime < new Date();
}

function getNextSessionDateTimeOnCurrentDate(
  currentDate: Date,
  nextTimeSlot: ClassTimeSlot,
): [Date, Date] {
  const nextSessionDate = new Date(currentDate);
  const daysToNextSession = (7 + weekdayToNumber(nextTimeSlot.weekday) - nextSessionDate.getDay()) % 7;
  nextSessionDate.setUTCDate(nextSessionDate.getUTCDate() + daysToNextSession);
  const startDatetime = setTimeToDate(nextSessionDate, nextTimeSlot.startTime);
  const endDatetime = setTimeToDate(nextSessionDate, nextTimeSlot.endTime);

  return [startDatetime, endDatetime];
}

export function getNextSessionDateTime(
  currentDate: Date,
  timeSlots: ClassTimeSlot[],
): [Date, Date] {
  const nextTimeSlot = getNextTimeSlot(timeSlots, currentDate);

  const [startDatetime, endDatetime] = getNextSessionDateTimeOnCurrentDate(currentDate, nextTimeSlot);
  if (isEndTimeInThePast(endDatetime)) {
    // Move date to next timeslot
    const dateAfterCurrentDate = new Date(currentDate);
    dateAfterCurrentDate.setUTCDate(dateAfterCurrentDate.getUTCDate() + 1);
    const nextTimeSlot = getNextTimeSlot(timeSlots, dateAfterCurrentDate);
    return getNextSessionDateTimeOnCurrentDate(dateAfterCurrentDate, nextTimeSlot);
  }

  return [startDatetime, endDatetime];
}

export function isValidTimeSlotDuration(startTime: Date, endTime: Date) {
  if (!(startTime && endTime)) {
    throw new BadRequestException('Neither startTime nor endTime can be empty.');
  }
  const duration = endTime.getTime() - startTime.getTime();
  if (duration < 30 * 60 * 1000) { // 30 minutes in milliseconds
    throw new BadRequestException('Time slot duration must be at least 30 minutes.');
  }
  if (duration >= 24 * 60 * 60 * 1000) { // 24 hours in milliseconds
    throw new BadRequestException('Time slot duration must be less than 1 day.');
  }
  
  return true;
}