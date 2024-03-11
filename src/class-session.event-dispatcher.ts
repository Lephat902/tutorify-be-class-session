import {
  BroadcastService,
  ClassSessionCreatedEvent,
  ClassSessionCreatedEventPayload,
  MultipleClassSessionsCreatedEvent,
  MultipleClassSessionsCreatedEventPayload,
  ClassSessionUpdatedEvent,
  ClassSessionUpdatedEventPayload,
  ClassSessionVerificationUpdatedEventPayload,
  ClassSessionVerificationUpdatedEvent,
} from '@tutorify/shared';
import { Builder } from 'builder-pattern';
import { Injectable } from '@nestjs/common';
import { ClassSession } from './aggregates';

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
    const newClassSessionsIds = newClassSessions.map(session => session.id);
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

  dispatchClassSessionUpdatedEvent(
    updateSessionTutorId: string,
    updatedClassSession: ClassSession,
  ) {
    const { id, updatedAt, address, wardId, classId } = updatedClassSession;
    const eventPayload = Builder<ClassSessionUpdatedEventPayload>()
      .updateSessionTutorId(updateSessionTutorId)
      .classId(classId)
      .classSessionId(id)
      .updatedAt(updatedAt)
      .address(address)
      .wardId(wardId)
      .build();
    const event = new ClassSessionUpdatedEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }

  dispatchClassSessionVerificationUpdatedEvent(
    classSessionId: string,
  ) {
    const eventPayload = Builder<ClassSessionVerificationUpdatedEventPayload>()
      .classSessionId(classSessionId)
      .build();
    const event = new ClassSessionVerificationUpdatedEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }
}
