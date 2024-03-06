import {
  PaginationDto,
  SortingDirectionDto,
  applyMixins,
  ClassSessionOrderBy,
} from '@tutorify/shared';

class ClassSessionQueryDto {
  readonly q?: string;
  readonly classId?: string;
  readonly isCancelled?: boolean;
  readonly order?: ClassSessionOrderBy;
  readonly startTime?: Date;
  readonly endTime?: Date;
}

interface ClassSessionQueryDto extends PaginationDto, SortingDirectionDto {}
applyMixins(ClassSessionQueryDto, [PaginationDto, SortingDirectionDto]);

export { ClassSessionQueryDto };
