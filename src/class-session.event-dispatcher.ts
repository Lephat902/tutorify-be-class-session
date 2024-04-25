import {
  BroadcastService,
  ClassSessionCreatedEvent,
  ClassSessionCreatedEventPayload,
  ClassSessionUpdatedEvent,
  ClassSessionUpdatedEventPayload,
  ClassSessionDefaultAddressQueryEventPayload,
  ClassSessionDefaultAddressQueryEvent,
  ClassSessionDeletedEventPayload,
  ClassSessionDeletedEvent,
  QueueNames,
} from '@tutorify/shared';
import { Builder } from 'builder-pattern';
import { Injectable } from '@nestjs/common';
import { ClassSession } from './aggregates';

@Injectable()
export class ClassSessionEventDispatcher {
  constructor(private readonly broadcastService: BroadcastService) { }

  dispatchClassSessionCreatedEvent(
    newClassSession: ClassSession,
  ) {
    const { id, createdAt, title, startDatetime, endDatetime } = newClassSession;
    const eventPayload = Builder<ClassSessionCreatedEventPayload>()
      .classSessionId(id)
      .title(title)
      .startDatetime(startDatetime)
      .endDatetime(endDatetime)
      .createdAt(createdAt)
      .build();
    const event = new ClassSessionCreatedEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }

  dispatchClassSessionUpdatedEvent(
    updatedClassSession: ClassSession,
  ) {
    const { id, updatedAt, feedbackUpdatedAt, title, startDatetime, endDatetime, isCancelled } = updatedClassSession;
    const eventPayload = Builder<ClassSessionUpdatedEventPayload>()
      .classSessionId(id)
      .title(title)
      .startDatetime(startDatetime)
      .endDatetime(endDatetime)
      .updatedAt(updatedAt)
      .feedbackUpdatedAt(feedbackUpdatedAt)
      .isCancelled(isCancelled)
      .build();
    const event = new ClassSessionUpdatedEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }

  dispatchClassSessionDeletedEvent(
    deletedClassSession: ClassSession,
  ) {
    const { id, updatedAt, title, startDatetime, endDatetime } = deletedClassSession;
    const eventPayload = Builder<ClassSessionDeletedEventPayload>()
      .classSessionId(id)
      .title(title)
      .startDatetime(startDatetime)
      .endDatetime(endDatetime)
      .updatedAt(updatedAt)
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
    this.broadcastService.broadcastEventToSelectMicroservices(
      event.pattern,
      event.payload,
      [QueueNames.CLASS_AND_CATEGORY],
    );
  }
}
