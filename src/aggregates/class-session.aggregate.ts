import { AggregateRoot, AggregateRootName, EventProcessor, StoredEvent } from "@event-nest/core";
import { BroadcastService, generateRandomHex } from "@tutorify/shared";
import { ClassSessionMaterial } from "src/read-repository/entities/class-session-material.entity";
import { ClassSessionCreatedEvent, ClassSessionUpdatedEvent } from "src/events";
import { Geometry } from 'geojson';
import { ClassSessionEventDispatcher } from "src/class-session.event-dispatcher";
import { ClassSessionVerificationUpdatedEvent } from "src/events/class-session-verification-updated.event";
import { ClassSessionCreateArgs, ClassSessionMaterialsUpdateArgs, ClassSessionUpdateArgs, ClassSessionVerificationUpdateArgs } from "./args";
import { ClassSessionCreateStatus, ClassSessionUpdateStatus } from "./enums";

@AggregateRootName("ClassSession")
export class ClassSession extends AggregateRoot {
  public tutorId: string;
  public classId: string;
  public description: string = '';
  public title: string = '';
  public isCancelled: boolean = false;
  public createdAt: Date = null;
  public updatedAt: Date = null;
  public startDatetime: Date = null;
  public endDatetime: Date = null;
  public address: string = '';
  public wardId: string = '';
  public location: Geometry;
  public isOnline: boolean = true;
  public materials: ClassSessionMaterial[] = [];
  public tutorFeedback: string = '';
  public feedbackUpdatedAt: Date = null;
  public createStatus: ClassSessionCreateStatus = ClassSessionCreateStatus.CREATE_PENDING;
  public updateStatus: ClassSessionUpdateStatus = ClassSessionUpdateStatus.UPDATED;
  public classVerified: boolean = false;
  public tutorVerified: boolean = false;

  public constructor(id: string) {
    super(id);
    if (!ClassSession.classSessionEventDispatcher) {
      ClassSession.initialize();
    }
  }

  private static classSessionEventDispatcher: ClassSessionEventDispatcher;

  static initialize() {
    const broadcastService = new BroadcastService();
    ClassSession.classSessionEventDispatcher = new ClassSessionEventDispatcher(broadcastService);
  }

  public static createNew(data: ClassSessionCreateArgs): ClassSession {
    const classSession = new ClassSession(generateRandomHex(24));
    const event = new ClassSessionCreatedEvent(data); // their schema is the same
    classSession.processClassSessionCreatedEvent(event);
    classSession.append(event);
    return classSession;
  }

  public static fromEvents(id: string, events: Array<StoredEvent>): ClassSession {
    const classSession = new ClassSession(id);
    classSession.reconstitute(events);
    return classSession;
  }

  update(
    data:
      ClassSessionUpdateArgs |
      ClassSessionMaterialsUpdateArgs,
  ) {
    const event = new ClassSessionUpdatedEvent(data);
    this.processClassSessionUpdatedEvent(event);
    this.append(event);
  }

  updateVerification(data: ClassSessionVerificationUpdateArgs) {
    const event = new ClassSessionVerificationUpdatedEvent(data);
    this.processClassSessionVerificationUpdatedEvent(event);
    this.append(event);
  }

  @EventProcessor(ClassSessionCreatedEvent)
  private processClassSessionCreatedEvent = (event: ClassSessionCreatedEvent) => {
    Object.assign(this, event);
  };

  @EventProcessor(ClassSessionUpdatedEvent)
  private processClassSessionUpdatedEvent = (event: ClassSessionUpdatedEvent) => {
    Object.assign(this, event);
  };

  @EventProcessor(ClassSessionVerificationUpdatedEvent)
  private processClassSessionVerificationUpdatedEvent = (event: ClassSessionVerificationUpdatedEvent) => {
    Object.assign(this, event);
  };

  async commitAndPublishToExternal(): Promise<AggregateRoot> {
    // Duplicate events before commit otherwise it will disappear
    const recentlyAppendedEvents = [...this.appendedEvents];
    const createdAggregate = await this.commit();

    for (const event of recentlyAppendedEvents) {
      const eventPayload = event.payload;
      if (eventPayload instanceof ClassSessionCreatedEvent) {
        ClassSession.classSessionEventDispatcher.dispatchClassSessionCreatedEvent(eventPayload.tutorId, this);
      } else if (eventPayload instanceof ClassSessionUpdatedEvent) {
        ClassSession.classSessionEventDispatcher.dispatchClassSessionUpdatedEvent(eventPayload.tutorId, this);
      } else if (eventPayload instanceof ClassSessionVerificationUpdatedEvent) {
        ClassSession.classSessionEventDispatcher.dispatchClassSessionVerificationUpdatedEvent(this.id);
      }
    }

    return createdAggregate;
  }
}