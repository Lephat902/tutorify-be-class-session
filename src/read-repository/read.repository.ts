import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ClassSession } from './entities/class-session.entity';
import { ClassQueryDto, ClassSessionQueryDto } from '../dtos';
import { ClassSessionStatus, UserRole } from '@tutorify/shared';
import { Class } from './entities';

type QueryType = SelectQueryBuilder<ClassSession> | SelectQueryBuilder<Class>;

@Injectable()
export class ReadRepository extends Repository<ClassSession> {
  constructor(private dataSource: DataSource) {
    super(ClassSession, dataSource.createEntityManager());
  }

  getAllClassSessionsQuery(
    filters: ClassSessionQueryDto,
  ): SelectQueryBuilder<ClassSession> {
    const { userMakeRequest } = filters;
    const { userRole, userId } = userMakeRequest;
    const now = new Date();
    const queryBuilder = this.createQueryBuilder('classSession')
      .innerJoinAndSelect('classSession.class', 'class');

    this.filterByClassId(queryBuilder, filters.classId, userRole, userId);
    this.filterByUser(queryBuilder, userRole, userId);
    this.filterByQuery(queryBuilder, filters.q);
    this.filterByStartTime(queryBuilder, filters.startTime);
    this.filterByEndTime(queryBuilder, filters.endTime);
    this.filterByStatus(queryBuilder, filters.statuses, now);
    this.orderByField(queryBuilder, filters.order, filters.dir);
    this.paginateResults(queryBuilder, filters.page, filters.limit);

    return queryBuilder;
  }

  async getAllClassSessions(
    filters: ClassSessionQueryDto,
  ): Promise<{
    totalCount: number,
    results: ClassSession[],
  }> {
    const queryBuilder = this.getAllClassSessionsQuery(filters);
    const [results, totalCount] = await queryBuilder.getManyAndCount();
    return { results, totalCount };
  }

  async getSessionCountOfClassSession(classId: string): Promise<number> {
    return this.createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .getCount();
  }

  async getLatestSessionOfClassSession(classId: string): Promise<ClassSession> {
    return this.createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .orderBy('session.endDatetime', 'DESC')
      .getOne();
  }

  async getClasses(
    filters: ClassQueryDto,
  ): Promise<{
    totalCount: number,
    results: Class[],
  }> {
    const { userMakeRequest } = filters;
    const { userRole, userId } = userMakeRequest;
    const now = new Date();
    const queryBuilder = this.dataSource.createQueryBuilder(Class, 'class')
      .innerJoinAndSelect('class.sessions', 'classSession');

      this.filterByUser(queryBuilder, userRole, userId);
      this.filterByStartTime(queryBuilder, filters.startTime);
      this.filterByEndTime(queryBuilder, filters.endTime);
      this.filterByStatus(queryBuilder, filters.statuses, now);
      this.orderByField(queryBuilder, filters.order, filters.dir);
      this.paginateResults(queryBuilder, filters.page, filters.limit);
  
    const [results, totalCount] = await queryBuilder.getManyAndCount();
    return { results, totalCount };
  }

  private filterByClassId(query: QueryType, classId: string | undefined, userRole: UserRole, userId: string | undefined) {
    if (classId) {
      query.andWhere('class.classId = :classId', { classId });

      if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
        this.filterByUserId(query, userId);
      }
    }
  }

  private filterByUserId(query: QueryType, userId: string | undefined) {
    if (userId) {
      query.andWhere('(class.studentId = :userId OR class.tutorId = :userId)', {
        userId,
      });
    }
  }

  private filterByUser(query: QueryType, userRole: UserRole, userId: string | undefined) {
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      this.filterByUserId(query, userId);
    }
  }

  private filterByQuery(query: QueryType, q: string | undefined) {
    if (q) {
      query.andWhere(
        '(classSession.description ILIKE :q OR classSession.title ILIKE :q)',
        { q: `%${q}%` },
      );
    }
  }

  private filterByStartTime(query: QueryType, startTime: Date | undefined) {
    if (startTime) {
      query.andWhere('classSession.startDatetime >= :startTime', {
        startTime,
      });
    }
  }

  private filterByEndTime(query: QueryType, endTime: Date | undefined) {
    if (endTime) {
      query.andWhere('classSession.endDatetime <= :endTime', {
        endTime,
      });
    }
  }

  private filterByStatus(query: QueryType, statuses: ClassSessionStatus[] | undefined, now: Date) {
    const whereConditions: string[] = [];

    if (statuses) {
      if (statuses.includes(ClassSessionStatus.CANCELLED)) {
        whereConditions.push('(classSession.isCancelled = true)');
      }

      if (statuses.includes(ClassSessionStatus.CONCLUDED)) {
        whereConditions.push('(classSession.endDatetime < :now AND classSession.isCancelled = false)');
      }

      if (statuses.includes(ClassSessionStatus.SCHEDULED)) {
        whereConditions.push('(classSession.endDatetime >= :now AND classSession.isCancelled = false)');
      }

      const whereClause = whereConditions.join(' OR ');
      query.andWhere(whereClause, { now });
    }
  }

  private orderByField(query: QueryType, order: string | undefined, dir: 'ASC' | 'DESC' | undefined) {
    if (order && dir) {
      query.orderBy(`classSession.${order}`, dir);
    }
  }

  private paginateResults(query: QueryType, page: number | undefined, limit: number | undefined) {
    if (page && limit) {
      query.skip((page - 1) * limit).take(limit);
    }
  }
}
