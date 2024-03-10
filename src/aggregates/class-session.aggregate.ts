import { AggregateRoot, AggregateRootName, EventProcessor, StoredEvent } from "@event-nest/core";
import { BroadcastService, ClassSessionStatus, generateRandomHex } from "@tutorify/shared";
import { ClassSessionMaterial } from "src/read-repository/entities/class-session-material.entity";
import { ClassSessionCreatedEvent, ClassSessionUpdatedEvent } from "src/events";
import { Geometry } from 'geojson';
import { ClassSessionUpdateDto } from "src/dtos/class-session-update.dto";
import { ClassSessionEventDispatcher } from "src/class-session.event-dispatcher";
import { Injectable } from "@nestjs/common";

export type ClassSessionCreateArgs = Pick<ClassSession,
  'classId' |
  'description' |
  'title' |
  'createdAt' |
  'startDatetime' |
  'endDatetime' |
  'address' |
  'wardId' |
  'isOnline'
> & {
  tutorId: string,
};
export type ClassSessionUpdateArgs = Omit<ClassSessionUpdateDto, 'files'>;
export type ClassSessionVerificationUpdateArgs = Partial<Pick<ClassSession, 'tutorVerified' | 'classVerified' | 'status'>>;
export type ClassSessionMaterialsUpdateArgs = Pick<ClassSession, 'materials'>;

@AggregateRootName("ClassSession")
@Injectable()
export class ClassSession extends AggregateRoot {
  public classId: string;
  public description: string = '';
  public title: string = '';
  public isCancelled: boolean = false;
  public createdAt: Date;
  public updatedAt: Date;
  public startDatetime: Date;
  public endDatetime: Date;
  public address: string = '';
  public wardId: string = '';
  public location: Geometry;
  public isOnline: boolean = true;
  public materials: ClassSessionMaterial[] = [];
  public tutorFeedback: string = '';
  public status: ClassSessionStatus = ClassSessionStatus.CREATE_PENDING;
  public classVerified: boolean = false;
  public tutorVerified: boolean = false;

  private constructor(id: string) {
    super(id);
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
      ClassSessionVerificationUpdateArgs |
      ClassSessionMaterialsUpdateArgs,
  ) {
    const event = new ClassSessionUpdatedEvent(data);
    this.processClassSessionUpdatedEvent(event);
    this.append(event);
  }

  @EventProcessor(ClassSessionCreatedEvent)
  private processClassSessionCreatedEvent = (event: ClassSessionCreatedEvent) => {
    const { tutorId, ...sessionData } = event;
    Object.assign<ClassSession, Omit<ClassSessionCreatedEvent, "tutorId">>(this, sessionData);
  };

  @EventProcessor(ClassSessionUpdatedEvent)
  private processClassSessionUpdatedEvent = (event: ClassSessionUpdatedEvent) => {
    const { tutorId, ...sessionData } = event;
    Object.assign<ClassSession, Omit<ClassSessionUpdatedEvent, "tutorId">>(this, sessionData);
  };

  async commitAndPublishToExternal(): Promise<AggregateRoot> {
    const lastEvent = this.appendedEvents.pop();
    const lastEventData = lastEvent.payload;
    const createdAggreate = await this.commit();

    if (lastEventData instanceof ClassSessionCreatedEvent) {
      ClassSession.classSessionEventDispatcher.dispatchClassSessionCreatedEvent(lastEventData.tutorId, this);
    } else if (lastEventData instanceof ClassSessionUpdatedEvent) {
      ClassSession.classSessionEventDispatcher.dispatchClassSessionUpdatedEvent(lastEventData.tutorId, this);
    }

    return createdAggreate;
  }
}