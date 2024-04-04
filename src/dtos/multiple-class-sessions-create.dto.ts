import { FileUploadResponseDto } from '@tutorify/shared';
import { ClassTimeSlotDto } from './class.dto';
import { Type } from 'class-transformer'

export class MultipleClassSessionsCreateDto {
  tutorId: string;
  // Session Data
  classId: string;
  description: string;
  title: string;
  @Type(() => Date)
  startDate: Date;
  timeSlots: ClassTimeSlotDto[];
  numberOfSessionsToCreate: number;
  @Type(() => Date)
  endDateForRecurringSessions: Date;
  address: string;
  wardId: string;
  isOnline: boolean;
  @Type(() => FileUploadResponseDto)
  materials: FileUploadResponseDto[];
  useDefaultAddress: boolean;
}