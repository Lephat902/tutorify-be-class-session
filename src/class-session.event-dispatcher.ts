import {
  BroadcastService,
  ClassSessionPendingCreatedEvent,
  ClassSessionPendingCreatedEventPayload,
  ClassSessionPendingUpdatedEvent,
  ClassSessionPendingUpdatedEventPayload,
  ClassSessionVerificationUpdatedEventPayload,
  ClassSessionVerificationUpdatedEvent,
  ClassSessionDefaultAddressQueryEventPayload,
  ClassSessionDefaultAddressQueryEvent,
  ClassSessionDeletedEventPayload,
  ClassSessionDeletedEvent,
} from '@tutorify/shared';
import { Builder } from 'builder-pattern';
import { Injectable } from '@nestjs/common';
import { ClassSession } from './aggregates';

@Injectable()
export class ClassSessionEventDispatcher {
  constructor(private readonly broadcastService: BroadcastService) { }

  dispatchClassSessionPendingCreatedEvent(
    createSessionTutorId: string,
    newClassSession: ClassSession,
  ) {
    const { id, classId, title, createdAt } = newClassSession;
    const eventPayload = Builder<ClassSessionPendingCreatedEventPayload>()
      .classSessionId(id)
      .classId(classId)
      .title(title)
      .createdAt(createdAt)
      .createSessionTutorId(createSessionTutorId)
      .build();
    const event = new ClassSessionPendingCreatedEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }

  dispatchClassSessionPendingUpdatedEvent(
    updateSessionTutorId: string,
    updatedClassSession: ClassSession,
  ) {
    const { id, updatedAt, classId } = updatedClassSession;
    const eventPayload = Builder<ClassSessionPendingUpdatedEventPayload>()
      .updateSessionTutorId(updateSessionTutorId)
      .classId(classId)
      .classSessionId(id)
      .updatedAt(updatedAt)
      .build();
    const event = new ClassSessionPendingUpdatedEvent(eventPayload);
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

  dispatchClassSessionDeletedEvent(
    deleteSessionTutorId: string,
    classSessionId: string,
  ) {
    const eventPayload = Builder<ClassSessionDeletedEventPayload>()
      .deleteSessionTutorId(deleteSessionTutorId)
      .classSessionId(classSessionId)
      .build();
    const event = new ClassSessionDeletedEvent(eventPayload);
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
