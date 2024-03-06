import { Controller } from '@nestjs/common';
import { ClassSession } from '../entities/class-session.entity';
import { ClassSessionService } from '../class-session.service';
import {
  ClassSessionCreateByQtyDto,
  ClassSessionCreateDto,
  ClassSessionQueryDto,
} from '../dtos';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class ClassSessionController {
  constructor(private readonly classSessionService: ClassSessionService) {}

  @MessagePattern({ cmd: 'getAllClassSessions' })
  async getAllClassSessions(
    filters: ClassSessionQueryDto,
  ): Promise<ClassSession[]> {
    return this.classSessionService.getAllClassSessions(filters);
  }

  @MessagePattern({ cmd: 'getClassSessionById' })
  async getClassSessionById(classSessionId: string): Promise<ClassSession> {
    return this.classSessionService.getClassSessionById(classSessionId);
  }

  @MessagePattern({ cmd: 'createClassSession' })
  async createClassSession(
    classSessionCreateDto: ClassSessionCreateDto,
  ): Promise<ClassSession> {
    return this.classSessionService.createClassSession(classSessionCreateDto);
  }

  @MessagePattern({ cmd: 'createClassSessionsWithNumberOfSessions' })
  async createClassSessionsWithNumberOfSessions(
    classSessionCreateByQtyDto: ClassSessionCreateByQtyDto,
  ): Promise<ClassSession[]> {
    return this.classSessionService.createClassSessionsWithNumberOfSessions(
      classSessionCreateByQtyDto,
    );
  }
}
