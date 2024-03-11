import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ClassSessionClassVerifiedEventPattern,
  ClassSessionClassVerifiedEventPayload,
  ClassSessionTutorVerifiedEventPattern,
  ClassSessionTutorVerifiedEventPayload,
  ClassSessionVerificationUpdatedEventPattern,
  ClassSessionVerificationUpdatedEventPayload,
} from '@tutorify/shared';
import { ClassSessionWriteService } from 'src/services';
import { MutexService } from 'src/mutexes';
import { ClassSessionVerificationUpdateArgs } from 'src/aggregates';
import { ClassSessionCreateStatus, ClassSessionUpdateStatus } from 'src/aggregates/enums';

enum VerificationType {
  TutorVerified = 'tutorVerified',
  ClassVerified = 'classVerified',
}

@Controller()
export class ClassSessionExternalEventHandler {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService,
    private readonly mutexService: MutexService,
  ) { }

  @EventPattern(new ClassSessionTutorVerifiedEventPattern())
  async handleClassSessionTutorVerified(
    payload: ClassSessionTutorVerifiedEventPayload,
  ) {
    const { classSessionId, isValidTutor } = payload;
    console.log(`Starting updating tutor verification status for class ${classSessionId}`);
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
    console.log(`Starting updating class verification status for class ${classSessionId}`);
    await this.updateVerificationInfo(
      classSessionId,
      isValidClass,
      VerificationType.ClassVerified,
    );
  }

  @EventPattern(new ClassSessionVerificationUpdatedEventPattern())
  async handleClassSessionVerificationUpdated(
    payload: ClassSessionVerificationUpdatedEventPayload,
  ) {
    const { classSessionId } = payload;
    // Lock the mutex
    const release = await this.mutexService.acquireLockForClassSession(classSessionId);

    try {
      console.log(`Starting handling status for class ${classSessionId} after verification update`);
      const classSession = await this.classSessionWriteService.getSessionById(classSessionId);
      const isCreatePending = classSession.createStatus === ClassSessionCreateStatus.CREATE_PENDING;
      const isUpdatePending = classSession.updateStatus === ClassSessionUpdateStatus.UPDATE_PENDING;
      const isUpdateFailed = classSession.updateStatus === ClassSessionUpdateStatus.FAILED;

      // If it's failed update then revert to as before last update
      if (isUpdateFailed) {
        console.log(`Starting revert class session ${classSessionId} to as before update`);
        await this.classSessionWriteService.revertToLastUpdate(classSession);
        return;
      }

      // The session is not _pending
      if (!isCreatePending && !isUpdatePending) {
        console.log("No need to process");
        return;
      }

      // Check if all verifications are successful
      if (Object.values(VerificationType).every((type) => classSession[type])) {
        console.log("Succeed all verifications required.");
        const dataToUpdate: ClassSessionVerificationUpdateArgs =
          isCreatePending ? {
            createStatus: ClassSessionCreateStatus.CREATED,
          } : {
            updateStatus: ClassSessionUpdateStatus.UPDATED,
          };

        await this.classSessionWriteService.updateClassSessionVerification(classSessionId, dataToUpdate);
      }
    } finally {
      // Release the mutex
      release();
    }
  }

  private async updateVerificationInfo(
    classSessionId: string,
    isValid: boolean,
    verificationType: VerificationType,
  ) {
    // Lock the mutex
    const release = await this.mutexService.acquireLockForClassSession(classSessionId);

    try {
      const classSession = await this.classSessionWriteService.getSessionById(classSessionId);
      const isCreatePending = classSession.createStatus === ClassSessionCreateStatus.CREATE_PENDING;
      const isUpdatePending = classSession.updateStatus === ClassSessionUpdateStatus.UPDATE_PENDING;

      const dataToUpdate: Partial<ClassSessionVerificationUpdateArgs> = {
        [verificationType]: isValid,
        ...(isCreatePending && !isValid ?
          { createStatus: ClassSessionCreateStatus.FAILED } :
          {}
        ),
        ...(isUpdatePending && !isValid ?
          { updateStatus: ClassSessionUpdateStatus.FAILED } :
          {}
        ),
      };
      await this.classSessionWriteService.updateClassSessionVerification(
        classSessionId,
        dataToUpdate,
      );
    } finally {
      // Release the mutex
      release();
    }
  }
}
