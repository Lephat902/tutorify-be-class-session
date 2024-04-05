import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Controllers } from './controllers';
import { ReadRepository } from './read-repository';
import { BroadcastModule, FileProxy, QueueNames } from '@tutorify/shared';
import { entities } from './read-repository/entities';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ClassSessionEventDispatcher } from './class-session.event-dispatcher';
import { EventNestMongoDbModule } from '@event-nest/mongodb';
import { ClassSessionReadService, ClassSessionWriteService } from './services';
import { MutexService } from './mutexes';

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
    ]),
    EventNestMongoDbModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        connectionUri: configService.get<string>('EVENT_STORE_MONGODB_URI'),
        aggregatesCollection: 'aggregates-collection',
        eventsCollection: 'events-collection'
      }),
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    BroadcastModule,
  ],
  providers: [
    ClassSessionWriteService,
    ClassSessionReadService,
    ReadRepository,
    ClassSessionEventDispatcher,
    MutexService,
    FileProxy,
  ],
  controllers: Controllers,
})
export class AppModule { }
