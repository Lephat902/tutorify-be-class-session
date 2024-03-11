import { DomainEvent } from "@event-nest/core";
import { IntersectionType } from "@nestjs/mapped-types";
import { ClassSessionMaterialsUpdateArgs, ClassSessionUpdateArgs } from "src/aggregates/args";

export const CLASS_SESSION_UPDATED_EVENT = 'class-session-updated-event';

@DomainEvent('class-session-updated-event')
export class ClassSessionUpdatedEvent extends IntersectionType(
    ClassSessionUpdateArgs,
    ClassSessionMaterialsUpdateArgs,
) {
    constructor(data:
        ClassSessionUpdateArgs |
        ClassSessionMaterialsUpdateArgs,
    ) {
        super();
        Object.assign(this, data);
    }
}