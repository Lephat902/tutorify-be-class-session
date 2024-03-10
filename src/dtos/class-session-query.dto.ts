import {
  PaginationDto,
  SortingDirectionDto,
  ClassSessionOrderBy,
} from '@tutorify/shared';
import { IntersectionType } from '@nestjs/mapped-types';

class ClassSessionQueryDto extends IntersectionType(
  PaginationDto,
  SortingDirectionDto
) {
  readonly q?: string;
  readonly classId?: string;
  readonly isCancelled?: boolean;
  readonly order?: ClassSessionOrderBy;
  readonly startTime?: Date;
  readonly endTime?: Date;
}

export { ClassSessionQueryDto };