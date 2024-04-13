import { UserMakeRequest } from '@tutorify/shared';

export class ClassSessionDeleteDto {
  userMakeRequest: UserMakeRequest;
  // Session Data
  classSessionId: string;
}
