import { Injectable } from '@nestjs/common';
import { ClassSessionQueryDto, ClassSessionResponse } from '../dtos';
import { ClassSession } from '../read-repository/entities';
import { ClassSessionReadRepository } from '../read-repository/class-session.read.repository';
import { ClassSessionStatus } from '@tutorify/shared';
import { LessThan } from 'typeorm';

@Injectable()
export class ClassSessionReadService {
  constructor(
    private readonly classSessionReadRepository: ClassSessionReadRepository,
  ) { }

  async getClassSessionsAndTotalCount(
    filters: ClassSessionQueryDto,
  ): Promise<{
    totalCount: number,
    results: ClassSessionResponse[],
  }> {
    const { results, totalCount } = await this.classSessionReadRepository.getAllClassSessions(filters);
    return {
      results: results.map(classSession => this.transformToClassSessionResponse(classSession)),
      totalCount
    }
  }

  async getClassSessionById(
    id: string,
  ): Promise<ClassSessionResponse> {
    const classSession = await this.classSessionReadRepository.findOneBy({ id });
    return this.transformToClassSessionResponse(classSession)
  }

  async getNonCancelledClassSessionsCount(classId: string): Promise<number> {
    return this.classSessionReadRepository.count({
      where: {
        classId,
        isCancelled: false,
      },
    });
  }

  async getScheduledClassSessionsCount(classId: string): Promise<number> {
    const now = new Date();
    return this.classSessionReadRepository.count({
      where: {
        classId,
        isCancelled: false,
        endDatetime: LessThan(now),
      },
    });
  }

  transformToClassSessionResponse(classSession: ClassSession): ClassSessionResponse {
    const now = new Date();
    let status: ClassSessionStatus;
    if (classSession.isCancelled) {
      status = ClassSessionStatus.CANCELLED;
    } else if (classSession.endDatetime < now) {
      status = ClassSessionStatus.CONCLUDED;
    } else {
      status = ClassSessionStatus.SCHEDULED;
    }
    return {
      ...classSession,
      status
    }
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
