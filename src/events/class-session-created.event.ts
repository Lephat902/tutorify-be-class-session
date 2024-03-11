import { DomainEvent } from "@event-nest/core";
import { ClassSessionCreateArgs } from "src/aggregates/args";

export const CLASS_SESSION_CREATED_EVENT = 'class-session-created-event';

@DomainEvent(CLASS_SESSION_CREATED_EVENT)
export class ClassSessionCreatedEvent extends ClassSessionCreateArgs {
    constructor(data: ClassSessionCreateArgs) {
        super();
        Object.assign(this, data);
    }
}