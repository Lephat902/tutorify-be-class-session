import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassDto,
  ClassSessionCreateByQtyDto,
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
import { convertTimestringToDate, weekdayToNumber } from './helpers';
import { Builder } from 'builder-pattern';
import { EntityManager } from 'typeorm';

@Injectable()
export class ClassSessionService {
  constructor(
    private readonly classSessionRepository: ClassSessionRepository,
    @Inject(QueueNames.FILE)
    private readonly fileClient: ClientProxy,
    @Inject(QueueNames.CLASS_AND_CATEGORY)
    private readonly classClient: ClientProxy,
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

  async createClassSession(
    classSessionDto: ClassSessionCreateDto,
  ): Promise<ClassSession> {
    const { tutorId, materials, ...sessionData } = classSessionDto;

    const session = new ClassSession();
    Object.assign(session, sessionData);

    const newClassSession = await this.classSessionRepository.save(session);
    if (materials && materials.length > 0) {
      // Deliberately not include await for performance purpose
      // Error occurs in uploading materials will not hugely affect the consistency of the system
      this.uploadAndAssignMaterialToSession(newClassSession.id, materials);
    }

    this.eventDispatcher.dispatchClassSessionCreatedEvent(
      tutorId,
      newClassSession,
    );

    return newClassSession;
  }

  async createClassSessionsWithNumberOfSessions(
    classSessionCreateByQtyDto: ClassSessionCreateByQtyDto,
  ) {
    const { classId, numberOfSessions, tutorId } = classSessionCreateByQtyDto;
    const classEntity = await this.getClassEntity(classId);
    const timeSlots = this.getTimeSlots(classEntity);
    let currentDate = await this.getCurrentDate(classId);
    const currenNumberOfSessions =
      await this.classSessionRepository.getSessionCountOfClass(classId);

    const sessions = [];
    for (let i = 0; i < numberOfSessions; ++i) {
      const nextTimeSlot = this.getNextTimeSlot(timeSlots, currentDate);
      const nextSessionDate = this.getNextSessionDate(
        currentDate,
        nextTimeSlot,
      );
      const newSession = this.createNewSession(
        classId,
        nextSessionDate,
        nextTimeSlot,
        currenNumberOfSessions + i + 1,
        classEntity,
      );
      sessions.push(newSession);
      currentDate = this.updateCurrentDate(nextSessionDate);
    }

    const newClassSessions = await this.classSessionRepository.save(sessions);
    this.eventDispatcher.dispatchMultipleClassSessionsCreatedEvent(
      tutorId,
      newClassSessions,
    );
    return newClassSessions;
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

  private async getClassEntity(classId: string) {
    const classEntity = await firstValueFrom(
      this.classClient.send<ClassDto>({ cmd: 'getClassById' }, classId),
    );
    if (!classEntity) throw new NotFoundException('Class not found');
    if (classEntity.timeSlots.length === 0)
      throw new BadRequestException('No time slots defined for this class');
    return classEntity;
  }

  private getTimeSlots(classEntity: ClassDto) {
    return classEntity.timeSlots
      .map((timeSlot) => ({
        ...timeSlot,
        startTime: convertTimestringToDate(timeSlot.startTime),
        endTime: convertTimestringToDate(timeSlot.endTime),
      }))
      .sort(
        (a, b) =>
          weekdayToNumber(a.weekday) - weekdayToNumber(b.weekday) ||
          a.startTime.getTime() - b.startTime.getTime(),
      );
  }

  private async getCurrentDate(classId: string) {
    const latestSession =
      await this.classSessionRepository.getLatestSessionOfClass(classId);
    const currentDate = latestSession
      ? new Date(latestSession.endDatetime)
      : new Date();
    currentDate.setHours(0, 0, 0, 0);
    return currentDate;
  }

  private getNextTimeSlot(timeSlots: ClassTimeSlot[], currentDate: Date) {
    return (
      timeSlots.find(
        (slot) => weekdayToNumber(slot.weekday) >= currentDate.getDay(),
      ) || timeSlots[0]
    );
  }

  private getNextSessionDate(currentDate: Date, nextTimeSlot: ClassTimeSlot) {
    const nextSessionDate = new Date(currentDate);
    nextSessionDate.setDate(
      nextSessionDate.getDate() +
        ((7 +
          weekdayToNumber(nextTimeSlot.weekday) -
          nextSessionDate.getDay()) %
          7),
    );
    return nextSessionDate;
  }

  private createNewSession(
    classId: string,
    nextSessionDate: Date,
    nextTimeSlot: ClassTimeSlot,
    sessionNumber: number,
    classEntity: ClassDto,
  ) {
    const startDatetime = new Date(nextSessionDate);
    startDatetime.setHours(
      nextTimeSlot.startTime.getHours(),
      nextTimeSlot.startTime.getMinutes(),
    );

    const endDatetime = new Date(nextSessionDate);
    endDatetime.setHours(
      nextTimeSlot.endTime.getHours(),
      nextTimeSlot.endTime.getMinutes(),
    );

    return Builder(ClassSession)
      .classId(classId)
      .startDatetime(startDatetime)
      .endDatetime(endDatetime)
      .title(`Session ${sessionNumber}`)
      .isOnline(classEntity.isOnline)
      .address(classEntity.address)
      .wardId(classEntity.wardId)
      .build();
  }

  private updateCurrentDate(nextSessionDate: Date) {
    const currentDate = new Date(nextSessionDate);
    currentDate.setDate(currentDate.getDate() + 1);
    return currentDate;
  }

  private async uploadAndAssignMaterialToSession(
    classSessionId: string,
    materials?: {
      description?: string;
      file: Express.Multer.File;
    }[],
  ) {
    const files = materials.map((material) => material.file);
    const uploadedMaterialResults = await this.uploadMultipleMaterials(files);
    console.log(uploadedMaterialResults);
    await this.classSessionRepository.update(
      {
        id: classSessionId,
      },
      {
        materials: uploadedMaterialResults.map((res, index) => ({
          ...res,
          description: materials[index].description,
        })),
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
