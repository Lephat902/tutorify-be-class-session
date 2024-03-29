import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ClassSession } from './entities/class-session.entity';
import { ClassSessionQueryDto } from '../dtos';
import { ClassSessionStatus, UserRole } from '@tutorify/shared';

@Injectable()
export class ClassSessionReadRepository extends Repository<ClassSession> {
  constructor(private dataSource: DataSource) {
    super(ClassSession, dataSource.createEntityManager());
  }

  async getAllClassSessions(
    filters: ClassSessionQueryDto,
  ): Promise<{
    totalCount: number,
    results: ClassSession[],
  }> {
    const { userMakeRequest } = filters;
    const { userRole, userId } = userMakeRequest;
    const now = new Date();
    const queryBuilder = this.createQueryBuilder('classSession')
      .innerJoinAndSelect('classSession.class', 'class');

    this.filterByClassId(queryBuilder, filters.classId, userRole, userId);
    this.filterByUserRole(queryBuilder, userRole, userId);
    this.filterByQuery(queryBuilder, filters.q);
    this.filterByStartTime(queryBuilder, filters.startTime);
    this.filterByEndTime(queryBuilder, filters.endTime);
    this.filterByStatus(queryBuilder, filters.statuses, now);
    this.orderByField(queryBuilder, filters.order, filters.dir);
    this.paginateResults(queryBuilder, filters.page, filters.limit);

    const [results, totalCount] = await queryBuilder.getManyAndCount();
    return { results, totalCount };
  }

  async getSessionCountOfClassSession(classId: string): Promise<number> {
    return this.createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .getCount();
  }

  async getLatestSessionOfClassSession(classId: string): Promise<ClassSession> {
    return await this.createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .orderBy('session.endDatetime', 'DESC')
      .getOne();
  }

  private filterByClassId(query: SelectQueryBuilder<ClassSession>, classId: string | undefined, userRole: UserRole, userId: string | undefined) {
    if (classId) {
      query.andWhere('class.classId = :classId', { classId });

      if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
        this.filterByUserId(query, userId);
      }
    }
  }

  private filterByUserId(query: SelectQueryBuilder<ClassSession>, userId: string | undefined) {
    if (userId) {
      query.andWhere('(class.studentId = :userId OR class.tutorId = :userId)', {
        userId,
      });
    }
  }

  private filterByUserRole(query: SelectQueryBuilder<ClassSession>, userRole: UserRole, userId: string | undefined) {
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      this.filterByUserId(query, userId);
    }
  }

  private filterByQuery(query: SelectQueryBuilder<ClassSession>, q: string | undefined) {
    if (q) {
      query.andWhere(
        '(classSession.description ILIKE :q OR classSession.title ILIKE :q)',
        { q: `%${q}%` },
      );
    }
  }

  private filterByStartTime(query: SelectQueryBuilder<ClassSession>, startTime: Date | undefined) {
    if (startTime) {
      query.andWhere('classSession.startDatetime >= :startTime', {
        startTime,
      });
    }
  }

  private filterByEndTime(query: SelectQueryBuilder<ClassSession>, endTime: Date | undefined) {
    if (endTime) {
      query.andWhere('classSession.endDatetime <= :endTime', {
        endTime,
      });
    }
  }

  private filterByStatus(query: SelectQueryBuilder<ClassSession>, statuses: ClassSessionStatus[] | undefined, now: Date) {
    if (statuses?.includes(ClassSessionStatus.CANCELLED)) {
      query.andWhere('classSession.isCancelled = :isCancelled', {
        isCancelled: true,
      });
    }

    if (statuses?.includes(ClassSessionStatus.CONCLUDED)) {
      query.andWhere('classSession.endDatetime < :now', { now });
    }

    if (statuses?.includes(ClassSessionStatus.SCHEDULED)) {
      query.andWhere('classSession.endDatetime >= :now', { now });
    }
  }

  private orderByField(query: SelectQueryBuilder<ClassSession>, order: string | undefined, dir: 'ASC' | 'DESC' | undefined) {
    if (order && dir) {
      query.orderBy(`classSession.${order}`, dir);
    }
  }

  private paginateResults(query: SelectQueryBuilder<ClassSession>, page: number | undefined, limit: number | undefined) {
    if (page && limit) {
      query.skip((page - 1) * limit).take(limit);
    }
  }
}
