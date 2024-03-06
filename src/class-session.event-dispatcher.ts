import {
  BroadcastService,
  ClassSessionCreatedEvent,
  ClassSessionCreatedEventPayload,
  MultipleClassSessionsCreatedEvent,
  MultipleClassSessionsCreatedEventPayload,
} from '@tutorify/shared';
import { ClassSession } from './entities';
import { Builder } from 'builder-pattern';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ClassSessionEventDispatcher {
  constructor(private readonly broadcastService: BroadcastService) {}

  dispatchClassSessionCreatedEvent(
    createSessionTutorId: string,
    newClassSession: ClassSession,
  ) {
    const { id, classId, title, createdAt } = newClassSession;
    const eventPayload = Builder<ClassSessionCreatedEventPayload>()
      .classSessionId(id)
      .classId(classId)
      .title(title)
      .createdAt(createdAt)
      .createSessionTutorId(createSessionTutorId)
      .build();
    const event = new ClassSessionCreatedEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }

  dispatchMultipleClassSessionsCreatedEvent(
    createSessionTutorId: string,
    newClassSessions: ClassSession[],
  ) {
    const newClassSessionsIds = newClassSessions.map((session) => session.id);
    const eventPayload = Builder<MultipleClassSessionsCreatedEventPayload>()
      .classSessionIds(newClassSessionsIds)
      .classId(newClassSessions[0].classId)
      .createSessionTutorId(createSessionTutorId)
      .build();
    const event = new MultipleClassSessionsCreatedEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }
}
