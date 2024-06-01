import { Injectable } from '@nestjs/common';
import {
  BroadcastService,
  ClassSessionDefaultAddressQueryEvent,
  ClassSessionDefaultAddressQueryEventPayload,
  ClassSessionDeletedEvent,
  ClassSessionDeletedEventPayload,
  ClassSessionUpdatedEvent,
  ClassSessionUpdatedEventPayload,
  MultiClassSessionsCreatedEvent,
  MultiClassSessionsCreatedEventPayload,
  QueueNames,
} from '@tutorify/shared';
import { Builder } from 'builder-pattern';
import { ClassSession } from './aggregates';

@Injectable()
export class ClassSessionEventDispatcher {
  constructor(private readonly broadcastService: BroadcastService) { }

  dispatchMultiClassSessionsCreatedEvent(
    newClassSessions: ClassSession[],
  ) {
    const { id, tutorId, classId, createdAt } = newClassSessions[0];
    const sessionDetails = newClassSessions.map(({ title, startDatetime, endDatetime }) => ({
      title,
      startDatetime,
      endDatetime,
    }));

    const eventPayload = Builder<MultiClassSessionsCreatedEventPayload>()
      .tutorId(tutorId)
      .classSessionId(id)
      .classId(classId)
      .createdAt(createdAt)
      .sessionsDetails(sessionDetails)
      .build();

    const event = new MultiClassSessionsCreatedEvent(eventPayload);
    this.broadcastService.broadcastEventToAllMicroservices(
      event.pattern,
      event.payload,
    );
  }

  dispatchClassSessionUpdatedEvent(
    updatedClassSession: ClassSession,
  ) {
    const { id, tutorId, classId, updatedAt, tutorFeedback, feedbackUpdatedAt, title, startDatetime, endDatetime, isCancelled } = updatedClassSession;
    const eventPayload = Builder<ClassSessionUpdatedEventPayload>()
      .classSessionId(id)
      .classId(classId)
      .tutorId(tutorId)
      .title(title)
      .startDatetime(startDatetime)
      .endDatetime(endDatetime)
      .updatedAt(updatedAt)
      .feedbackUpdatedAt(feedbackUpdatedAt)
      .tutorFeedback(tutorFeedback)
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
    const { id, tutorId, classId, updatedAt, title, startDatetime, endDatetime } = deletedClassSession;
    const eventPayload = Builder<ClassSessionDeletedEventPayload>()
      .classSessionId(id)
      .classId(classId)
      .tutorId(tutorId)
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
