import { DomainEvent } from "@event-nest/core";
import { ClassSessionCreateArgs } from "src/aggregates";

@DomainEvent('class-session-created-event')
export class ClassSessionCreatedEvent {
    readonly tutorId: string;
    readonly classId: string;
    readonly description: string;
    readonly title: string;
    readonly createdAt: Date;
    readonly startDatetime: Date;
    readonly endDatetime: Date;
    readonly address: string;
    readonly wardId: string;
    readonly isOnline: boolean;
  
    constructor(data: ClassSessionCreateArgs) {
        Object.assign<ClassSessionCreatedEvent, ClassSessionCreateArgs>(this, data);
    }
}