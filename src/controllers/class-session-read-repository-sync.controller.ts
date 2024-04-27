import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ApplicationStatus,
  ClassApplicationUpdatedEventPattern,
  ClassApplicationUpdatedEventPayload,
  ClassCreatedEventPattern,
  ClassCreatedEventPayload,
  ClassDeletedEventPattern,
  ClassDeletedEventPayload,
} from '@tutorify/shared';
import { Class } from 'src/read-repository';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Controller()
export class ReadRepositorySync {
  constructor(
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
  ) { }

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

  @EventPattern(new ClassDeletedEventPattern())
  async handleClassDeleted(
    payload: ClassDeletedEventPayload,
  ) {
    const { classId } = payload;
    console.log(`Starting deleting class record`);

    await this.classRepository.delete(classId);
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
