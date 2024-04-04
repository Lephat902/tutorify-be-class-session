import { FileUploadResponseDto } from '@tutorify/shared';
import { Type } from 'class-transformer'

export class ClassSessionUpdateDto {
  tutorId: string;
  // Session Data
  classSessionId: string;
  description: string;
  title: string;
  isCancelled: boolean;
  @Type(() => Date)
  startDatetime: Date;
  @Type(() => Date)
  endDatetime: Date;
  address: string;
  wardId: string;
  isOnline: boolean;
  @Type(() => FileUploadResponseDto)
  materials: FileUploadResponseDto[];
  tutorFeedback: string;
  useDefaultAddress: boolean;
}
