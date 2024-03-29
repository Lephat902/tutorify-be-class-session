import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClassSession } from './entities/class-session.entity';
import { ClassSessionQueryDto } from '../dtos';
import { UserRole } from '@tutorify/shared';

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
    const queryBuilder = this.createQueryBuilder('classSession')
      .innerJoinAndSelect('classSession.class', 'class');

    if (filters.classId) {
      queryBuilder
        .andWhere('class.classId = :classId', { classId: filters.classId });

      if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
        // Ensure only student or tutor can get the sessions of this class
        queryBuilder.andWhere('(class.studentId = :userId OR class.tutorId = :userId)', { userId });
      }
    } else if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      console.log(userId);
      // Non-admin users (student/tutor) get sessions based on their class
      queryBuilder
        .andWhere('class.studentId = :userId OR class.tutorId = :userId', { userId });
    }

    if (filters.q) {
      queryBuilder.andWhere(
        '(classSession.description ILIKE :q OR classSession.title ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }

    if (filters.isCancelled !== undefined) {
      queryBuilder.andWhere('classSession.isCancelled = :isCancelled', {
        isCancelled: filters.isCancelled,
      });
    }

    if (filters.startTime) {
      queryBuilder.andWhere('classSession.startDatetime >= :startTime', {
        startTime: filters.startTime,
      });
    }

    if (filters.endTime) {
      queryBuilder.andWhere('classSession.endDatetime <= :endTime', {
        endTime: filters.endTime,
      });
    }

    if (filters.order && filters.dir) {
      queryBuilder.orderBy(`classSession.${filters.order}`, filters.dir);
    }

    if (filters.page && filters.limit) {
      queryBuilder.skip((filters.page - 1) * filters.limit).take(filters.limit);
    }

    const [results, totalCount] = await queryBuilder.getManyAndCount();
    return { results, totalCount };
  }

  async getSessionCountOfClass(classId: string): Promise<number> {
    return this.createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .getCount();
  }

  async getLatestSessionOfClass(classId: string): Promise<ClassSession> {
    return await this.createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .orderBy('session.endDatetime', 'DESC')
      .getOne();
  }
}
