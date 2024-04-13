import { Controller } from '@nestjs/common';
import { ClassSessionWriteService, ClassSessionReadService } from 'src/services';
import { MultipleClassSessionsCreateDto, ClassSessionQueryDto, ClassQueryDto, ClassSessionDeleteDto } from '../dtos';
import { MessagePattern } from '@nestjs/microservices';
import { ClassSessionUpdateDto } from 'src/dtos/class-session-update.dto';
import { MutexService } from 'src/mutexes';
import { UserMakeRequest } from '@tutorify/shared';
import { SessionStatsPerClass } from 'src/dtos/class-session-stat.dto';
import { ClassSession } from 'src/read-repository';

@Controller()
export class ClassSessionController {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService,
    private readonly classSessionReadService: ClassSessionReadService,
    private readonly mutexService: MutexService,
  ) { }

  @MessagePattern({ cmd: 'getClassSessionsAndTotalCount' })
  async getClassSessionsAndTotalCount(
    filters: ClassSessionQueryDto,
  ) {
    return this.classSessionReadService.getClassSessionsAndTotalCount(filters);
  }

  @MessagePattern({ cmd: 'getClasses' })
  async getClasses(
    filters: ClassQueryDto,
  ) {
    return this.classSessionReadService.getClasses(filters);
  }

  @MessagePattern({ cmd: 'getClassSessionById' })
  async getClassSessionById(data: {
    classSessionId: string,
    userMakeRequest: UserMakeRequest
  }): Promise<ClassSession> {
    return this.classSessionReadService.getClassSessionById(data.classSessionId, data.userMakeRequest);
  }

  @MessagePattern({ cmd: 'getNonCancelledClassSessionsCount' })
  async getNonCancelledClassSessionsCount(data: {
    classId: string,
    userMakeRequest: UserMakeRequest
  }): Promise<number> {
    return this.classSessionReadService.getNonCancelledClassSessionsCount(data.classId, data.userMakeRequest);
  }

  @MessagePattern({ cmd: 'getScheduledClassSessionsCount' })
  async getScheduledClassSessionsCount(data: {
    classId: string,
    userMakeRequest: UserMakeRequest
  }): Promise<number> {
    return this.classSessionReadService.getScheduledClassSessionsCount(data.classId, data.userMakeRequest);
  }

  @MessagePattern({ cmd: 'getSessionsStatsPerClass' })
  async getSessionsStatsPerClass(data: {
    classId: string,
    userMakeRequest: UserMakeRequest
  }): Promise<SessionStatsPerClass> {
    return this.classSessionReadService.getSessionsStatsPerClass(data.classId, data.userMakeRequest);
  }

  @MessagePattern({ cmd: 'createClassSessions' })
  async createClassSessions(
    classSessionCreateDto: MultipleClassSessionsCreateDto,
  ) {
    return this.classSessionWriteService.createMutiple(classSessionCreateDto);
  }

  @MessagePattern({ cmd: 'updateClassSession' })
  async updateClassSession(
    classSessionUpdateDto: ClassSessionUpdateDto,
  ) {
    const { classSessionId } = classSessionUpdateDto;

    // Lock the mutex
    const release = await this.mutexService.acquireLockForClassSession(classSessionId);
    try {
      return this.classSessionWriteService.updateClassSession(classSessionId, classSessionUpdateDto);
    } finally {
      // Release the mutex
      release();
    }
  }

  @MessagePattern({ cmd: 'deleteClassSession' })
  async deleteClassSession(
    classSessionDeleteDto: ClassSessionDeleteDto,
  ) {
    const { classSessionId } = classSessionDeleteDto;

    // Lock the mutex
    const release = await this.mutexService.acquireLockForClassSession(classSessionId);
    try {
      return this.classSessionWriteService.deleteClassSession(classSessionDeleteDto);
    } finally {
      // Release the mutex
      release();
    }
  }
}
