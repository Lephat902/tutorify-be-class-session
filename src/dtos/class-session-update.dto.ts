import { FileUploadResponseDto } from '@tutorify/shared';
import { Type } from 'class-transformer'

export class ClassSessionUpdateDto {
  readonly tutorId: string;
  // Session Data
  readonly classSessionId: string;
  readonly description: string;
  readonly title: string;
  readonly isCancelled: boolean;
  @Type(() => Date)
  readonly startDatetime: Date;
  @Type(() => Date)
  readonly endDatetime: Date;
  readonly address: string;
  readonly wardId: string;
  readonly isOnline: boolean;
  readonly materials: FileUploadResponseDto[];
  readonly tutorFeedback: string;
}
