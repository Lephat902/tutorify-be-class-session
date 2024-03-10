import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ClassSessionClassVerifiedEventPattern,
  ClassSessionClassVerifiedEventPayload,
  ClassSessionStatus,
  ClassSessionTutorVerifiedEventPattern,
  ClassSessionTutorVerifiedEventPayload,
} from '@tutorify/shared';
import { ClassSessionWriteService } from 'src/services';
import { ClassSession } from 'src/read-repository/entities';
import { Mutex } from 'async-mutex'

enum VerificationType {
  TutorVerified = 'tutorVerified',
  ClassVerified = 'classVerified',
}

@Controller()
export class ClassSessionExternalEventHandler {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService
  ) { 
    this.mutexMap = new Map<string, Mutex>();
  }

  // Map to store mutex instances for each classSessionId
  private mutexMap: Map<string, Mutex>;

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

  private async updateVerificationInfo(
    classSessionId: string,
    isValid: boolean,
    verificationType: VerificationType,
  ) {
    // Retrieve or create a mutex instance for the classSessionId
    let mutex = this.mutexMap.get(classSessionId);
    if (!mutex) {
      mutex = new Mutex();
      this.mutexMap.set(classSessionId, mutex);
    }

    // Lock the mutex
    const release = await mutex.acquire();

    try {
      const dataToUpdate: Partial<ClassSession> = {
        [verificationType]: isValid,
        ...(isValid ? {} : { status: ClassSessionStatus.FAILED }),
      };
      await this.classSessionWriteService.updateClassSessionVerification(
        classSessionId,
        dataToUpdate,
      );
      const classSession =
        await this.classSessionWriteService.getSessionById(classSessionId);

      // Check if all verifications are successful
      if (Object.values(VerificationType).every((type) => classSession[type])) {
        await this.classSessionWriteService.updateClassSessionVerification(classSessionId, {
          status: ClassSessionStatus.CREATED,
        });
      }
    } finally {
      // Release the mutex
      release();
    }
  }
}
