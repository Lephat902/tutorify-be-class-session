import { DomainEvent } from "@event-nest/core";
import { IntersectionType } from "@nestjs/mapped-types";
import { ClassSessionAddressUpdateArgs, ClassSessionUpdateArgs } from "src/aggregates/args";

export const CLASS_SESSION_UPDATED_EVENT = 'class-session-updated-event';

@DomainEvent('class-session-updated-event')
export class ClassSessionUpdatedEvent extends IntersectionType(
    ClassSessionUpdateArgs,
    ClassSessionAddressUpdateArgs,
) {
    constructor(data:
        ClassSessionUpdateArgs |
        ClassSessionAddressUpdateArgs,
    ) {
        super();
        Object.assign(this, data);
    }
}