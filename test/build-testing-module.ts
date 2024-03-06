import { Test } from '@nestjs/testing';
import { setupDataSource } from './setup-data-source';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClassSessionService } from '../src/class-session.service';
import { ClassSessionRepository } from '../src/class-session.repository';
import { CqrsModule } from '@nestjs/cqrs';
import { BroadcastModule } from '@tutorify/shared';

export const buildTestingModule = async () => {
  const dataSource = await setupDataSource();
  const testingModule = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        name: 'default',
        synchronize: true,
      }),
      CqrsModule,
      BroadcastModule,
    ],
    providers: [ClassSessionService, ClassSessionRepository],
  })
    .overrideProvider(DataSource)
    .useValue(dataSource)
    .compile();

  return testingModule;
};
