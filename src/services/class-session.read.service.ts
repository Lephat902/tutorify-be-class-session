import { Injectable } from '@nestjs/common';
import { ClassSessionQueryDto, ClassSessionResponse } from '../dtos';
import { ClassSession } from '../read-repository/entities';
import { ClassSessionReadRepository } from '../read-repository/class-session.read.repository';
import { ClassSessionStatus, UserMakeRequest, UserRole } from '@tutorify/shared';

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
    userMakeRequest: UserMakeRequest,
  ): Promise<ClassSessionResponse> {
    const { userRole, userId } = userMakeRequest;
    const classSessionQuery = this.classSessionReadRepository.createQueryBuilder('classSession')
      .innerJoinAndSelect('classSession.class', 'class')
      .andWhere('classSession.id = :id', { id });
    if (userRole === UserRole.STUDENT) {
      classSessionQuery.andWhere('class.studentId = :userId', { userId });
    } else if (userRole === UserRole.TUTOR) {
      classSessionQuery.andWhere('class.tutorId = :userId', { userId });
    }

    const classSession = await classSessionQuery.getOne();

    return this.transformToClassSessionResponse(classSession);
  }

  async getNonCancelledClassSessionsCount(
    classId: string,
    userMakeRequest: UserMakeRequest,
  ): Promise<number> {
    const { userRole, userId } = userMakeRequest;
    const classSessionQuery = this.classSessionReadRepository.createQueryBuilder('classSession')
      .innerJoinAndSelect('classSession.class', 'class')
      .andWhere('class.classId = :classId', { classId })
      .andWhere('classSession.isCancelled = :isCancelled', { isCancelled: false });
    if (userRole === UserRole.STUDENT) {
      classSessionQuery.andWhere('class.studentId = :userId', { userId });
    } else if (userRole === UserRole.TUTOR) {
      classSessionQuery.andWhere('class.tutorId = :userId', { userId });
    }

    return classSessionQuery.getCount();
  }

  async getScheduledClassSessionsCount(
    classId: string,
    userMakeRequest: UserMakeRequest,
  ): Promise<number> {
    const { userRole, userId } = userMakeRequest;
    const now = new Date();

    const classSessionQuery = this.classSessionReadRepository.createQueryBuilder('classSession')
      .innerJoin('classSession.class', 'class')
      .andWhere('class.classId = :classId', { classId })
      .andWhere('classSession.isCancelled = :isCancelled', { isCancelled: false })
      .andWhere('classSession.endDatetime < :now', { now });

    if (userRole === UserRole.STUDENT) {
      classSessionQuery.andWhere('class.studentId = :userId', { userId });
    } else if (userRole === UserRole.TUTOR) {
      classSessionQuery.andWhere('class.tutorId = :userId', { userId });
    }

    return classSessionQuery.getCount();
  }

  transformToClassSessionResponse(classSession: ClassSession): ClassSessionResponse {
    if (!classSession)
      return null;
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