import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSessionService } from './class-session.service';
import {
  ClassSessionController,
  ClassSessionControllerEventHandler,
} from './controllers';
import { ClassSessionRepository } from './class-session.repository';
import { BroadcastModule, QueueNames } from '@tutorify/shared';
import { entities } from './entities';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ClassSessionEventDispatcher } from './class-session.event-dispatcher';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature(entities),
    TypeOrmModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        type: configService.get('DATABASE_TYPE'),
        url: configService.get('DATABASE_URI'),
        entities,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
      {
        name: QueueNames.FILE,
        inject: [ConfigService], // Inject ConfigService
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URI')],
            queue: QueueNames.FILE,
            queueOptions: {
              durable: false,
            },
          },
        }),
      },
      {
        name: QueueNames.CLASS_AND_CATEGORY,
        inject: [ConfigService], // Inject ConfigService
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URI')],
            queue: QueueNames.CLASS_AND_CATEGORY,
            queueOptions: {
              durable: false,
            },
          },
        }),
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    BroadcastModule,
  ],
  providers: [
    ClassSessionService,
    ClassSessionRepository,
    ClassSessionEventDispatcher,
  ],
  controllers: [ClassSessionController, ClassSessionControllerEventHandler],
})
export class AppModule {}
