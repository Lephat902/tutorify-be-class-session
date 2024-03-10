import { Controller } from '@nestjs/common';
import { ClassSession } from '../read-repository/entities/class-session.entity';
import { ClassSessionWriteService, ClassSessionReadService } from 'src/services';
import { MultipleClassSessionsCreateDto, ClassSessionQueryDto } from '../dtos';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class ClassSessionController {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService,
    private readonly classSessionReadService: ClassSessionReadService,
  ) { }

  @MessagePattern({ cmd: 'getAllClassSessions' })
  async getAllClassSessions(
    filters: ClassSessionQueryDto,
  ): Promise<ClassSession[]> {
    return this.classSessionReadService.getAllClassSessions(filters);
  }

  @MessagePattern({ cmd: 'getClassSessionById' })
  async getClassSessionById(classSessionId: string): Promise<ClassSession> {
    return this.classSessionReadService.getClassSessionById(classSessionId);
  }

  @MessagePattern({ cmd: 'createClassSessions' })
  async createClassSessions(
    classSessionCreateDto: MultipleClassSessionsCreateDto,
  ) {
    return this.classSessionWriteService.createMutiple(classSessionCreateDto);
  }
}
