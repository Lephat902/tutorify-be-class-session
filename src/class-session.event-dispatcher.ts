import {
  BroadcastService,
  ClassSessionCreatedEvent,
  ClassSessionCreatedEventPayload,
  ClassSessionUpdatedEvent,
  ClassSessionUpdatedEventPayload,
  ClassSessionVerificationUpdatedEventPayload,
  ClassSessionVerificationUpdatedEvent,
  ClassSessionDefaultAddressQueryEventPayload,
  ClassSessionDefaultAddressQueryEvent,
} from '@tutorify/shared';
import { Builder } from 'builder-pattern';
import { Injectable } from '@nestjs/common';
import { ClassSession } from './aggregates';

@Injectable()
export class ClassSessionEventDispatcher {
  constructor(private readonly broadcastService: BroadcastService) { }

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

  dispatchClassSessionUpdatedEvent(
    updateSessionTutorId: string,
    updatedClassSession: ClassSession,
  ) {
    const { id, updatedAt, classId } = updatedClassSession;
    const eventPayload = Builder<ClassSessionUpdatedEventPayload>()
      .updateSessionTutorId(updateSessionTutorId)
      .classId(classId)
      .classSessionId(id)
      .updatedAt(updatedAt)
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

  dispatchDefaultAddressQueryEvent(classSession: ClassSession) {
    const { id, classId } = classSession;
    const eventPayload = Builder<ClassSessionDefaultAddressQueryEventPayload>()
      .classSessionId(id)
      .classId(classId)
      .build();
    const event = new ClassSessionDefaultAddressQueryEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }
}
