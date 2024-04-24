import { Injectable } from '@nestjs/common';
import { ClassQueryDto, ClassSessionQueryDto } from '../dtos';
import { Class, ClassSession } from '../read-repository/entities';
import { ReadRepository } from '../read-repository/read.repository';
import { UserMakeRequest, UserRole } from '@tutorify/shared';
import { SessionStatsPerClass } from 'src/dtos/class-session-stat.dto';

@Injectable()
export class ClassSessionReadService {
  constructor(
    private readonly readRepository: ReadRepository,
  ) { }

  async getClassSessionsAndTotalCount(
    filters: ClassSessionQueryDto,
  ): Promise<{
    totalCount: number,
    results: ClassSession[],
  }> {
    const { results, totalCount } = await this.readRepository.getAllClassSessions(filters);
    return {
      results,
      totalCount
    }
  }

  async findClassById(
    id: string
  ): Promise<Class> {
    return this.readRepository.findClassById(id);
  }

  async getClasses(
    filters: ClassQueryDto,
  ): Promise<{
    totalCount: number,
    results: Class[],
  }> {
    return this.readRepository.getClasses(filters);
  }

  async getClassSessionById(
    id: string,
    userMakeRequest: UserMakeRequest,
  ): Promise<ClassSession> {
    const { userRole, userId } = userMakeRequest;
    const classSessionQuery = this.readRepository.createQueryBuilder('classSession')
      .innerJoinAndSelect('classSession.class', 'class')
      .andWhere('classSession.id = :id', { id });
    if (userRole === UserRole.STUDENT) {
      classSessionQuery.andWhere('class.studentId = :userId', { userId });
    } else if (userRole === UserRole.TUTOR) {
      classSessionQuery.andWhere('class.tutorId = :userId', { userId });
    }

    const classSession = await classSessionQuery.getOne();

    return classSession;
  }

  async getNonCancelledClassSessionsCount(
    classId: string,
    userMakeRequest: UserMakeRequest,
  ): Promise<number> {
    const { userRole, userId } = userMakeRequest;
    const classSessionQuery = this.readRepository.createQueryBuilder('classSession')
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

    const classSessionQuery = this.readRepository.createQueryBuilder('classSession')
      .innerJoin('classSession.class', 'class')
      .andWhere('class.classId = :classId', { classId })
      .andWhere('classSession.isCancelled = :isCancelled', { isCancelled: false })
      .andWhere('classSession.endDatetime > :now', { now });

    if (userRole === UserRole.STUDENT) {
      classSessionQuery.andWhere('class.studentId = :userId', { userId });
    } else if (userRole === UserRole.TUTOR) {
      classSessionQuery.andWhere('class.tutorId = :userId', { userId });
    }

    return classSessionQuery.getCount();
  }

  async getSessionsStatsPerClass(
    classId: string,
    userMakeRequest: UserMakeRequest,
  ): Promise<SessionStatsPerClass> {
    const getAllClassSessionsQuery = this.readRepository.getAllClassSessionsQuery({
      classId,
      userMakeRequest,
    });
    const [
      nonCancelledClassSessionsCount,
      scheduledClassSessionsCount,
      totalCount,
    ] = await Promise.all([
      this.getNonCancelledClassSessionsCount(classId, userMakeRequest),
      this.getScheduledClassSessionsCount(classId, userMakeRequest),
      getAllClassSessionsQuery.getCount(),
    ]);

    return {
      nonCancelledClassSessionsCount,
      scheduledClassSessionsCount,
      totalCount,
    }
  }

  async isSessionOverlap(
    classId: string,
    startDatetime: Date,
    endDatetime: Date,
  ): Promise<ClassSession> {
    const overlappingSession = await this.readRepository
      .createQueryBuilder('session')
      .andWhere('session.class.classId = :classId', { classId })
      .andWhere('session.isCancelled = false')
      .andWhere('session.startDatetime <= :endDatetime', { endDatetime })
      .andWhere('session.endDatetime >= :startDatetime', { startDatetime })
      .getOne();

    return overlappingSession;
  }
}
