import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ClassSessionCreatedEventPattern,
  ClassSessionCreatedEventPayload,
  ClassSessionUpdatedEventPattern,
  ClassSessionUpdatedEventPayload,
} from '@tutorify/shared';
import { ClassSessionWriteService } from 'src/services';
import { ClassSessionReadRepository } from 'src/read-repository';

@Controller()
export class ClassSessionReadRepositorySync {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService,
    // access directly because the purpose is to sync to DB
    private readonly classSessionReadRepository: ClassSessionReadRepository,
  ) { }

  @EventPattern(new ClassSessionCreatedEventPattern())
  async handleClassSessionCreated(
    payload: ClassSessionCreatedEventPayload,
  ) {
    const { classSessionId } = payload;
    console.log(`Start inserting new class session ${classSessionId} to read-database`);
    const newClassSession = await this.classSessionWriteService.getSessionById(classSessionId);
    const sessionToSave = this.classSessionReadRepository.create({
      ...newClassSession,
      id: classSessionId,
    });
    await this.classSessionReadRepository.save(sessionToSave);
  }

  @EventPattern(new ClassSessionUpdatedEventPattern())
  async handleClassSessionUpdated(
    payload: ClassSessionUpdatedEventPayload,
  ) {
    const { classSessionId } = payload;
    console.log(`Start updating class session ${classSessionId} to read-database`);
    const updatedClassSession = await this.classSessionWriteService.getSessionById(classSessionId);
    const sessionToSave = this.classSessionReadRepository.create(updatedClassSession);
    await this.classSessionReadRepository.update({
      id: classSessionId,
    }, sessionToSave);
  }
}
