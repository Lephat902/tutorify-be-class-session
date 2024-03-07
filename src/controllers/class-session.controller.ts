import { Controller } from '@nestjs/common';
import { ClassSession } from '../entities/class-session.entity';
import { ClassSessionService } from '../class-session.service';
import { ClassSessionCreateDto, ClassSessionQueryDto } from '../dtos';
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

  @MessagePattern({ cmd: 'createClassSessions' })
  async createClassSessions(
    classSessionCreateDto: ClassSessionCreateDto,
  ): Promise<ClassSession[]> {
    return this.classSessionService.createClassSessions(classSessionCreateDto);
  }
}
