import { Controller } from '@nestjs/common';
import { ClassSession } from '../read-repository/entities/class-session.entity';
import { ClassSessionWriteService, ClassSessionReadService } from 'src/services';
import { MultipleClassSessionsCreateDto, ClassSessionQueryDto } from '../dtos';
import { MessagePattern } from '@nestjs/microservices';
import { ClassSessionUpdateDto } from 'src/dtos/class-session-update.dto';
import { MutexService } from 'src/mutexes';

@Controller()
export class ClassSessionController {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService,
    private readonly classSessionReadService: ClassSessionReadService,
    private readonly mutexService: MutexService,
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
