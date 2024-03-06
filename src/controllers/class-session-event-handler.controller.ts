import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ClassSessionClassVerifiedEventPattern,
  ClassSessionClassVerifiedEventPayload,
  ClassSessionStatus,
  ClassSessionTutorVerifiedEventPattern,
  ClassSessionTutorVerifiedEventPayload,
} from '@tutorify/shared';
import { ClassSessionService } from 'src/class-session.service';
import { ClassSession } from 'src/entities';

enum VerificationType {
  TutorVerified = 'tutorVerified',
  ClassVerified = 'classVerified',
}

@Controller()
export class ClassSessionControllerEventHandler {
  constructor(private readonly classSessionService: ClassSessionService) {}

  @EventPattern(new ClassSessionTutorVerifiedEventPattern())
  async handleClassSessionTutorVerified(
    payload: ClassSessionTutorVerifiedEventPayload,
  ) {
    const { classSessionId, isValidTutor } = payload;
    await this.updateVerificationInfo(
      classSessionId,
      isValidTutor,
      VerificationType.TutorVerified,
    );
  }

  @EventPattern(new ClassSessionClassVerifiedEventPattern())
  async handleClassSessionClassVerified(
    payload: ClassSessionClassVerifiedEventPayload,
  ) {
    const { classSessionId, isValidClass } = payload;
    await this.updateVerificationInfo(
      classSessionId,
      isValidClass,
      VerificationType.ClassVerified,
    );
  }

  private async updateVerificationInfo(
    classSessionId: string,
    isValid: boolean,
    verificationType: VerificationType,
  ) {
    const dataToUpdate: Partial<ClassSession> = {
      [verificationType]: isValid,
      ...(isValid ? {} : { status: ClassSessionStatus.FAILED }),
    };
    await this.classSessionService.updateClassSession(
      classSessionId,
      dataToUpdate,
    );
    const classSession =
      await this.classSessionService.getClassSessionById(classSessionId);

    // Check if all verifications are successful
    if (Object.values(VerificationType).every((type) => classSession[type])) {
      await this.classSessionService.updateClassSession(classSessionId, {
        status: ClassSessionStatus.CREATED,
      });
    }
  }
}
