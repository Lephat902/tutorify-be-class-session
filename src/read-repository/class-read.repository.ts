import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ClassQueryDto } from '../dtos';
import { ClassSessionStatus, UserRole } from '@tutorify/shared';
import { Class } from './entities';

type QueryType = SelectQueryBuilder<Class>;

@Injectable()
export class ClassReadRepository extends Repository<Class> {
    constructor(private dataSource: DataSource) {
        super(Class, dataSource.createEntityManager());
    }

    async getClasses(
        filters: ClassQueryDto,
    ): Promise<{
        totalCount: number,
        results: Class[],
    }> {
        console.log("Get class by session filters", filters);
        const { userMakeRequest } = filters;
        const { userRole, userId } = userMakeRequest;
        const queryBuilder = this.createQueryBuilder('class')
            .leftJoinAndSelect('class.sessions', 'classSession');

        this.filterByUser(queryBuilder, userRole, userId);
        this.filterByStartTime(queryBuilder, filters.startTime);
        this.filterByEndTime(queryBuilder, filters.endTime);
        this.filterByStatus(queryBuilder, filters.statuses);
        this.orderByField(queryBuilder, filters.order, filters.dir);
        this.paginateResults(queryBuilder, filters.page, filters.limit);

        const [results, totalCount] = await queryBuilder.getManyAndCount();
        return { results, totalCount };
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

    private filterByStatus(query: QueryType, statuses: ClassSessionStatus[] | undefined) {
        if (statuses) {
            const rawQueryToGetNonFinishedClassesIds = `(
                SELECT cs."classClassId"
                FROM class_session cs
                WHERE cs."endDatetime" > NOW()
                AND cs."isCancelled" = false
                GROUP BY cs."classClassId"
            )`;

            const includeConcluded = statuses.includes(ClassSessionStatus.CONCLUDED);
            const includeScheduled = statuses.includes(ClassSessionStatus.SCHEDULED);

            if (includeConcluded && includeScheduled) {
                return;
            } else if (includeConcluded) {
                query.andWhere(`class."classId" NOT IN ${rawQueryToGetNonFinishedClassesIds}`);
            } else if (includeScheduled) {
                query.andWhere(`class."classId" IN ${rawQueryToGetNonFinishedClassesIds}`);
            }
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
