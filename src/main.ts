import { NestFactory, Reflector } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { GlobalExceptionsFilter } from './global-exception-filter';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { QueueNames } from '@tutorify/shared';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URI],
        queue: QueueNames.CLASS_SESSION,
        queueOptions: {
          durable: false,
        },
      },
    },
  );
  // Use the global exception filter
  app.useGlobalFilters(new GlobalExceptionsFilter());

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen();
}

bootstrap();
