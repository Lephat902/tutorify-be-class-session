import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ApplicationStatus,
  ClassApplicationUpdatedEventPattern,
  ClassApplicationUpdatedEventPayload,
  ClassCreatedEventPattern,
  ClassCreatedEventPayload,
  ClassSessionVerificationUpdatedEventPattern,
  ClassSessionVerificationUpdatedEventPayload,
} from '@tutorify/shared';
import { ClassSessionWriteService } from 'src/services';
import { Class, ReadRepository } from 'src/read-repository';
import { ClassSessionCreateStatus, ClassSessionUpdateStatus } from 'src/aggregates/enums';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Controller()
export class ReadRepositorySync {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService,
    // access directly because the purpose is to sync to DB
    private readonly readRepository: ReadRepository,
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
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
    if (classSession.isDeleted) {
      console.log(`Start deleting class session ${classSessionId} from read-database`);
      return this.readRepository.delete(classSessionId);
    }
    console.log(`Start inserting/updating class session ${classSessionId} to read-database`);
    const sessionToSave = this.readRepository.create({
      ...classSession,
      id: classSessionId,
      class: {
        classId: classSession.classId,
      },
    });
    await this.readRepository.save(sessionToSave);
  }

  @EventPattern(new ClassCreatedEventPattern())
  async handleClassCreated(
    payload: ClassCreatedEventPayload,
  ) {
    const { classId, studentId } = payload;
    console.log(`Starting inserting new class record`);
    const newRecord = this.classRepository.create({
      classId,
      studentId,
    });

    await this.classRepository.save(newRecord);
  }

  @EventPattern(new ClassApplicationUpdatedEventPattern())
  async handleClassApplicationUpdated(
    payload: ClassApplicationUpdatedEventPayload,
  ) {
    const { newStatus, classId, tutorId } = payload;
    if (newStatus !== ApplicationStatus.APPROVED) {
      return;
    }
    console.log(`Starting updating class record`);

    await this.classRepository.update(classId, {
      tutorId,
    });
  }
}
