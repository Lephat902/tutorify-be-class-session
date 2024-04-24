import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ClassSessionClassVerifiedResponseEventPattern,
  ClassSessionClassVerifiedResponseEventPayload,
  ClassSessionDefaultAddressReturnedEventPattern,
  ClassSessionDefaultAddressReturnedEventPayload,
  ClassSessionTutorVerifiedResponseEventPattern,
  ClassSessionTutorVerifiedResponseEventPayload,
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

  @EventPattern(new ClassSessionTutorVerifiedResponseEventPattern())
  async handleClassSessionTutorVerified(
    payload: ClassSessionTutorVerifiedResponseEventPayload,
  ) {
    const { classSessionId, isValidTutor } = payload;
    console.log(`Starting updating tutor verification status for class session ${classSessionId}`);
    await this.updateVerificationInfo(
      classSessionId,
      isValidTutor,
      VerificationType.TutorVerified,
    );
  }

  @EventPattern(new ClassSessionClassVerifiedResponseEventPattern())
  async handleClassSessionClassVerified(
    payload: ClassSessionClassVerifiedResponseEventPayload,
  ) {
    const { classSessionId, isValidClass } = payload;
    console.log(`Starting updating class verification status for class session ${classSessionId}`);
    await this.updateVerificationInfo(
      classSessionId,
      isValidClass,
      VerificationType.ClassVerified,
    );
  }

  // Received in case default address is used
  @EventPattern(new ClassSessionDefaultAddressReturnedEventPattern())
  async handleDefaultAddressReturned(
    payload: ClassSessionDefaultAddressReturnedEventPayload,
  ) {
    const { classSessionId, ...addressData } = payload;
    // Lock the mutex
    const release = await this.mutexService.acquireLockForClassSession(classSessionId);

    try {
      console.log(`Starting updating default address for class session ${classSessionId}`);
      await this.classSessionWriteService.updateClassSessionAddressBySystem(classSessionId, addressData);
    } finally {
      // Release the mutex
      release();
    }
  }

  @EventPattern(new ClassSessionVerificationUpdatedEventPattern())
  async handleClassSessionVerificationUpdated(
    payload: ClassSessionVerificationUpdatedEventPayload,
  ) {
    const { classSessionId } = payload;
    // Lock the mutex
    const release = await this.mutexService.acquireLockForClassSession(classSessionId);

    try {
      console.log(`Starting handling status for class session ${classSessionId} after verification update`);
      const classSession = await this.classSessionWriteService.getSessionById(classSessionId);
      const isCreatePending = classSession.createStatus === ClassSessionCreateStatus.CREATE_PENDING;
      const isUpdatePending = classSession.updateStatus === ClassSessionUpdateStatus.UPDATE_PENDING;
      const isUpdateFailed = classSession.updateStatus === ClassSessionUpdateStatus.FAILED;
      const isUpdated = classSession.updateStatus === ClassSessionUpdateStatus.UPDATED;
      const isCreated = classSession.createStatus === ClassSessionCreateStatus.CREATED;

      // If it's failed update then revert to as before last update
      if (isUpdateFailed) {
        console.log(`Starting revert class session ${classSessionId} to as before update`);
        await this.classSessionWriteService.revertToLastUpdate(classSession);
        return;
      }

      // NOTICE: a session has isUpdated true by default when created
      // If the below expression doesn't include isCreated, it will encounter unexpected error when trying to get state before update
      if (isUpdated && isCreated) {
        console.log("Handle some stuffs after successful update");
        // Delete dangling files if any
        await this.classSessionWriteService.handleDeleteFileInStorage(classSessionId);
        // Set default address if needed
        this.classSessionWriteService.queryClassSessionAddress(classSession);
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
