import { ClassTimeSlotDto } from './class.dto';

export class MultipleClassSessionsCreateDto {
  tutorId: string;
  // Session Data
  classId: string;
  description: string;
  title: string;
  startDate: Date;
  timeSlots: ClassTimeSlotDto[];
  numberOfSessionsToCreate: number;
  endDateForRecurringSessions: Date;
  address: string;
  wardId: string;
  isOnline: boolean;
  files: Array<Express.Multer.File>;
}