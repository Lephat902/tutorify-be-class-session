import { Inject, Injectable } from '@nestjs/common';
import {
  ClassSessionCreateDto,
  ClassSessionQueryDto,
  ClassTimeSlot,
} from './dtos';
import { ClassSession } from './entities';
import { ClassSessionRepository } from './class-session.repository';
import { QueueNames, FileUploadResponseDto } from '@tutorify/shared';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ClassSessionEventDispatcher } from './class-session.event-dispatcher';
import {
  getNextSessionDate,
  getNextTimeSlot,
  getNextday,
  sanitizeTimeSlot,
  setTimeToDate,
} from './helpers';
import { Builder } from 'builder-pattern';
import { EntityManager } from 'typeorm';

@Injectable()
export class ClassSessionService {
  constructor(
    private readonly classSessionRepository: ClassSessionRepository,
    @Inject(QueueNames.FILE)
    private readonly fileClient: ClientProxy,
    private readonly eventDispatcher: ClassSessionEventDispatcher,
  ) {}

  async getAllClassSessions(
    filters: ClassSessionQueryDto,
  ): Promise<ClassSession[]> {
    return this.classSessionRepository.getAllClassSessions(filters);
  }

  async getClassSessionById(
    id: string,
    manager?: EntityManager,
  ): Promise<ClassSession> {
    const repo = manager
      ? manager.getRepository(ClassSession)
      : this.classSessionRepository;
    return repo.findOneBy({ id });
  }

  async createClassSessions(
    classSessionDto: ClassSessionCreateDto,
  ): Promise<ClassSession[]> {
    const { classId, tutorId } = classSessionDto;
    const timeSlots = sanitizeTimeSlot(classSessionDto.timeSlots);
    let currentDate = classSessionDto.startDate
      ? new Date(classSessionDto.startDate)
      : new Date();
    const sessions: ClassSession[] = [];

    // First session
    const firstSessionTimeSlot = getNextTimeSlot(timeSlots, currentDate);
    const firstSessionDate = getNextSessionDate(
      currentDate,
      firstSessionTimeSlot,
    );
    const firstSession = await this.createFirstClassSession(
      classSessionDto,
      firstSessionTimeSlot,
      firstSessionDate,
    );
    currentDate = getNextday(firstSessionDate);

    // Consecutive sessions if any
    const endDateForRecurringSessions = new Date(
      classSessionDto?.endDateForRecurringSessions,
    );
    for (
      let i = 1;
      i < classSessionDto?.numberOfSessionsToCreate ||
      currentDate <= endDateForRecurringSessions;
      ++i
    ) {
      const nextTimeSlot = getNextTimeSlot(timeSlots, currentDate);
      const nextSessionDate = getNextSessionDate(currentDate, nextTimeSlot);
      const startDatetime = setTimeToDate(
        nextSessionDate,
        nextTimeSlot.startTime,
      );
      const endDatetime = setTimeToDate(nextSessionDate, nextTimeSlot.endTime);

      if (endDatetime > endDateForRecurringSessions) break;

      if (await this.isSessionOverlap(classId, startDatetime, endDatetime))
        continue;

      const newSession = Builder<ClassSession>()
        .classId(classId)
        .startDatetime(startDatetime)
        .endDatetime(endDatetime)
        .title(`${classSessionDto.title} ${i}`)
        .isOnline(classSessionDto.isOnline)
        .address(classSessionDto.address)
        .wardId(classSessionDto.wardId)
        .build();
      sessions.push(newSession);
      currentDate = getNextday(nextSessionDate);
    }

    const newClassSessions = await this.classSessionRepository.save(sessions);
    if (newClassSessions?.length > 0) {
      this.eventDispatcher.dispatchMultipleClassSessionsCreatedEvent(
        tutorId,
        newClassSessions,
      );
    }
    // Insert it to head of list and AFTER dispatching events for other sessions
    if (firstSession) {
      newClassSessions.unshift(firstSession);
    }
    return newClassSessions;
  }

  async createFirstClassSession(
    classSessionDto: ClassSessionCreateDto,
    timeSlot: ClassTimeSlot,
    sessionDate: Date,
  ): Promise<ClassSession> {
    const { tutorId, files, ...sessionData } = classSessionDto;

    const startDatetime = setTimeToDate(sessionDate, timeSlot.startTime);
    const endDatetime = setTimeToDate(sessionDate, timeSlot.endTime);

    if (
      await this.isSessionOverlap(
        classSessionDto.classId,
        startDatetime,
        endDatetime,
      )
    )
      return null;

    const session = this.classSessionRepository.create({
      ...sessionData,
      startDatetime,
      endDatetime,
    });

    const newClassSession = await this.classSessionRepository.save(session);
    if (files && files.length > 0) {
      // Deliberately not include await for performance purpose
      // Error occurs in uploading materials will not hugely affect the consistency of the system
      this.uploadAndAssignMaterialToSession(newClassSession.id, files);
    }

    this.eventDispatcher.dispatchClassSessionCreatedEvent(
      tutorId,
      newClassSession,
    );

    return newClassSession;
  }

  async updateClassSession(
    id: string,
    data: Partial<ClassSession>,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(ClassSession)
      : this.classSessionRepository;
    await repo.update({ id }, data);
  }

  private async isSessionOverlap(
    classId: string,
    startDatetime: Date,
    endDatetime: Date,
  ): Promise<boolean> {
    const overlappingSession = await this.classSessionRepository
      .createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .andWhere('session.startDatetime <= :endDatetime', { endDatetime })
      .andWhere('session.endDatetime >= :startDatetime', { startDatetime })
      .getOne();

    return !!overlappingSession;
  }

  private async uploadAndAssignMaterialToSession(
    classSessionId: string,
    files: Array<Express.Multer.File>,
  ) {
    const uploadedMaterialResults = await this.uploadMultipleMaterials(files);
    console.log(uploadedMaterialResults);
    await this.classSessionRepository.update(
      {
        id: classSessionId,
      },
      {
        materials: uploadedMaterialResults,
      },
    );
  }

  private async uploadMultipleMaterials(
    files: Array<Express.Multer.File>,
  ): Promise<FileUploadResponseDto[]> {
    return firstValueFrom(
      this.fileClient.send<FileUploadResponseDto[]>(
        { cmd: 'uploadMultipleFiles' },
        {
          files,
        },
      ),
    );
  }
}
