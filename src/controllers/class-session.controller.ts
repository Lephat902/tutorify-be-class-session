import { Controller } from '@nestjs/common';
import { ClassSessionWriteService, ClassSessionReadService } from 'src/services';
import { MultipleClassSessionsCreateDto, ClassSessionQueryDto, ClassSessionResponse, ClassQueryDto } from '../dtos';
import { MessagePattern } from '@nestjs/microservices';
import { ClassSessionUpdateDto } from 'src/dtos/class-session-update.dto';
import { MutexService } from 'src/mutexes';
import { UserMakeRequest } from '@tutorify/shared';

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

  @MessagePattern({ cmd: 'getUpcomingClasses' })
  async getUpcomingClasses(
    filters: ClassQueryDto,
  ) {
    return this.classSessionReadService.getUpcomingClasses(filters);
  }

  @MessagePattern({ cmd: 'getClassSessionById' })
  async getClassSessionById(data: {
    classSessionId: string,
    userMakeRequest: UserMakeRequest
  }): Promise<ClassSessionResponse> {
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

  @MessagePattern({ cmd: 'deleteSingleMaterial' })
  async deleteSingleMaterial(
    data: { tutorId: string, classSessionId: string, materialId: string },
  ) {
    // Lock the mutex
    const release = await this.mutexService.acquireLockForClassSession(data.classSessionId);
    try {
      return this.classSessionWriteService.deleteSingleMaterial(data.tutorId, data.classSessionId, data.materialId);
    } finally {
      // Release the mutex
      release();
    }
  }
}
