import { IntersectionType, OmitType, PartialType, PickType } from "@nestjs/mapped-types";
import { ClassSession } from "./class-session.aggregate";
import { ClassSessionUpdateDto } from "src/dtos/class-session-update.dto";

export class ClassSessionCreateArgs extends PickType(ClassSession,
  [
    'tutorId',
    'classId',
    'description',
    'title',
    'createdAt',
    'startDatetime',
    'endDatetime',
    'address',
    'wardId',
    'isOnline'
  ] as const
) { }
export class ClassSessionUpdateArgs extends IntersectionType(
  OmitType(ClassSessionUpdateDto,
    [
      'classSessionId'
    ] as const
  ),
  PickType(ClassSession,
    [
      'updatedAt'
    ] as const
  ),
  PartialType(PickType(ClassSession,
    [
      'feedbackUpdatedAt',
    ] as const
  ))
) { }
export class ClassSessionAddressUpdateArgs extends PickType(ClassSession,
  ['isOnline', 'address', 'wardId'] as const
) { }
export class ClassSessionDeleteArgs extends PickType(ClassSession,
  ['tutorId', 'isDeleted'] as const
) { }