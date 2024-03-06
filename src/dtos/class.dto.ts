import { Weekday } from '@tutorify/shared';

export interface ClassTimeSlotDto {
  startTime: string; // Js doesn't auto-convert to Date object
  endTime: string;
  weekday: Weekday;
}

export interface ClassTimeSlot {
  startTime: Date;
  endTime: Date;
  weekday: Weekday;
}

export interface ClassDto {
  timeSlots: ClassTimeSlotDto[];
  isOnline: boolean;
  address: string;
  wardId: string;
}
