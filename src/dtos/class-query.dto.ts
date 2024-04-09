import { OmitType } from '@nestjs/mapped-types';
import { ClassSessionQueryDto } from './class-session-query.dto';

export class ClassQueryDto extends OmitType(
  ClassSessionQueryDto,
  ['q', 'classId'] as const
) { }