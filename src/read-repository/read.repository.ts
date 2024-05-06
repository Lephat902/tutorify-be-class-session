import { Injectable } from '@nestjs/common';
import { ClassSessionStatus, UserRole } from '@tutorify/shared';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ClassSessionQueryDto } from '../dtos';
import { Class } from './entities';
import { ClassSession } from './entities/class-session.entity';

type QueryType = SelectQueryBuilder<ClassSession>;

@Injectable()
export class ReadRepository extends Repository<ClassSession> {
  constructor(private dataSource: DataSource) {
    super(ClassSession, dataSource.createEntityManager());
  }

  async getAllClassSessionsQuery(
    filters: ClassSessionQueryDto,
    ): Promise<SelectQueryBuilder<ClassSession>> {
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
    if (filters.markItemId)
      filters.newPageIndex = await this.getCurrentPageOfMarkItem(queryBuilder, filters.markItemId, filters.limit);
    this.paginateResults(queryBuilder, filters.newPageIndex ?? filters.page, filters.limit);

    return queryBuilder;
  }

  async getAllClassSessions(
    filters: ClassSessionQueryDto,
  ): Promise<{
    totalCount: number,
    results: ClassSession[],
    newPageIndex: number,
  }> {
    const queryBuilder = await this.getAllClassSessionsQuery(filters);
    const [results, totalCount] = await queryBuilder.getManyAndCount();
    return { results, totalCount, newPageIndex: filters.newPageIndex };
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

  async findClassById(
    id: string,
  ): Promise<Class> {
    return this.dataSource.createQueryBuilder(Class, 'class')
      .where('class.classId = :id', { id })
      .getOne();
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

  private paginateResults(
    query: QueryType,
    page: number | undefined,
    limit: number | undefined,
  ) {
    if (page && limit) {
      query.skip((page - 1) * limit).take(limit);
    }
  }

  private async getCurrentPageOfMarkItem(query: QueryType, markItemId: string, limit: number = 10) {
    const itemRank = await this.getItemRank(query, markItemId);
    return Math.ceil(itemRank / limit);
  }

  private async getItemRank(query: QueryType, markItemId: string): Promise<number> {
    // The query is currently not paginated yet
    const clonedQuery = query.clone();
    const markItemEndtimeQuery = this.createQueryBuilder('classSession')
      .select('classSession.endDatetime', 'endDatetime')
      .where('classSession.id = :markItemId', { markItemId })
      .getQuery();

    clonedQuery
      .orderBy('classSession.endDatetime', 'ASC')
      .andWhere(`classSession.endDatetime <= (${markItemEndtimeQuery})`)
      .setParameters({ markItemId });

    const result = await clonedQuery.getCount();

    return result ?? 0;
  }
}
