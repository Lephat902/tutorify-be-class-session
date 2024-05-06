import {
  PaginationDto,
  SortingDirectionDto,
  ClassSessionOrderBy,
  UserMakeRequest,
  ClassSessionStatus,
} from '@tutorify/shared';
import { IntersectionType } from '@nestjs/mapped-types';

export class ClassSessionQueryDto extends IntersectionType(
  PaginationDto,
  SortingDirectionDto
) {
  readonly q?: string;
  readonly classId?: string;
  readonly order?: ClassSessionOrderBy;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly statuses?: ClassSessionStatus[];
  readonly userMakeRequest: UserMakeRequest;
  readonly markItemId?: string;
  // not input
  newPageIndex?: number;
}