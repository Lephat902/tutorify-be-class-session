import { DomainEvent } from "@event-nest/core";
import { ClassSessionVerificationUpdateArgs } from "src/aggregates/args";

export const CLASS_SESSION_VERIFICATION_UPDATED_EVENT = 'class-session-verification-updated-event';

@DomainEvent(CLASS_SESSION_VERIFICATION_UPDATED_EVENT)
export class ClassSessionVerificationUpdatedEvent extends ClassSessionVerificationUpdateArgs {
    constructor(data:
        ClassSessionVerificationUpdateArgs
    ) {
        super();
        Object.assign(this, data);
    }
}