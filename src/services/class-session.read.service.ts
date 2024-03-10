import { Injectable } from '@nestjs/common';
import { ClassSessionQueryDto } from '../dtos';
import { ClassSession } from '../read-repository/entities';
import { ClassSessionReadRepository } from '../read-repository/class-session.read.repository';

@Injectable()
export class ClassSessionReadService {
  constructor(
    private readonly classSessionReadRepository: ClassSessionReadRepository,
  ) { }

  async getAllClassSessions(
    filters: ClassSessionQueryDto,
  ): Promise<ClassSession[]> {
    return this.classSessionReadRepository.getAllClassSessions(filters);
  }

  async getClassSessionById(
    id: string,
  ): Promise<ClassSession> {
    return this.classSessionReadRepository.findOneBy({ id });
  }

  async isSessionOverlap(
    classId: string,
    startDatetime: Date,
    endDatetime: Date,
  ): Promise<ClassSession> {
    const overlappingSession = await this.classSessionReadRepository
      .createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .andWhere('session.startDatetime <= :endDatetime', { endDatetime })
      .andWhere('session.endDatetime >= :startDatetime', { startDatetime })
      .getOne();

    return overlappingSession;
  }
}
