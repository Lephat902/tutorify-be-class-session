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
      'files',
      'classSessionId'
    ] as const
  ),
  PickType(ClassSession,
    [
      'updatedAt'
    ] as const
  )
) { }
export class ClassSessionVerificationUpdateArgs extends PartialType(PickType(ClassSession,
  [
    'tutorVerified',
    'classVerified',
    'createStatus',
    'updateStatus'
  ] as const
)) { }
export class ClassSessionMaterialsUpdateArgs extends PickType(ClassSession,
  ['materials', 'updatedAt'] as const
) { }