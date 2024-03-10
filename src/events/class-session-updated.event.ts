import { DomainEvent } from "@event-nest/core";
import { ClassSessionStatus } from "@tutorify/shared";
import { ClassSessionMaterialsUpdateArgs, ClassSessionUpdateArgs, ClassSessionVerificationUpdateArgs } from "src/aggregates";
import { ClassSessionUpdateDto } from "src/dtos/class-session-update.dto";

@DomainEvent('class-session-updated-event')
export class ClassSessionUpdatedEvent extends ClassSessionUpdateDto {
    // In addition to standard update data, there is other verification update fields
    public readonly tutorVerified: boolean;
    public readonly classVerified: boolean;
    public readonly status: ClassSessionStatus;

    constructor(data:
        ClassSessionUpdateArgs |
        ClassSessionVerificationUpdateArgs |
        ClassSessionMaterialsUpdateArgs,
    ) {
        super();
        Object.assign<
            ClassSessionUpdatedEvent,
            ClassSessionUpdateArgs |
            ClassSessionVerificationUpdateArgs |
            ClassSessionMaterialsUpdateArgs
        >
            (this, data);
    }
}