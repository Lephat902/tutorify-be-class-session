import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ClassSessionVerificationUpdatedEventPattern,
  ClassSessionVerificationUpdatedEventPayload,
} from '@tutorify/shared';
import { ClassSessionWriteService } from 'src/services';
import { ClassSessionReadRepository } from 'src/read-repository';
import { ClassSessionCreateStatus, ClassSessionUpdateStatus } from 'src/aggregates/enums';

@Controller()
export class ClassSessionReadRepositorySync {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService,
    // access directly because the purpose is to sync to DB
    private readonly classSessionReadRepository: ClassSessionReadRepository,
  ) { }

  @EventPattern(new ClassSessionVerificationUpdatedEventPattern())
  async handleClassSessionVerificationUpdated(
    payload: ClassSessionVerificationUpdatedEventPayload,
  ) {
    const { classSessionId } = payload;
    const classSession = await this.classSessionWriteService.getSessionById(classSessionId);
    const isCreated = classSession.createStatus === ClassSessionCreateStatus.CREATED;
    const isUpdated = classSession.updateStatus === ClassSessionUpdateStatus.UPDATED;

    if (!(isCreated && isUpdated)) {
      console.log("Not allow unstable class session to enter read-database");
      return;
    }
    console.log(`Start inserting/updating class session ${classSessionId} to read-database`);
    const sessionToSave = this.classSessionReadRepository.create({
      ...classSession,
      id: classSessionId,
    });
    await this.classSessionReadRepository.save(sessionToSave);
  }
}
