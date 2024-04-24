import { PublishedDomainEvent, DomainEventSubscription, OnDomainEvent } from "@event-nest/core";
import { Injectable } from "@nestjs/common";
import { ClassSessionCreatedEvent, ClassSessionUpdatedEvent } from "src/events";
import { ReadRepository } from "src/read-repository";
import { ClassSessionWriteService } from "src/services";

@Injectable()
@DomainEventSubscription(ClassSessionCreatedEvent, ClassSessionUpdatedEvent)
export class ClassSessionEventSubscription implements OnDomainEvent<
    ClassSessionCreatedEvent |
    ClassSessionUpdatedEvent
> {
    constructor(
        private readonly classSessionWriteService: ClassSessionWriteService,
        private readonly readRepository: ReadRepository,
    ) {}
    async onDomainEvent(event: PublishedDomainEvent<
        ClassSessionCreatedEvent |
        ClassSessionUpdatedEvent
    >): Promise<unknown> {
        const classSessionId = event.aggregateRootId;
        const classSession = await this.classSessionWriteService.getSessionById(classSessionId);

        if (classSession.isDeleted) {
          console.log(`Start deleting class session ${classSessionId} from read-database`);
          return this.readRepository.delete(classSessionId);
        }
        console.log(`Start inserting/updating class session ${classSessionId} to read-database`);
        const sessionToSave = this.readRepository.create({
          ...classSession,
          id: classSessionId,
          class: {
            classId: classSession.classId,
          },
        });
        await this.readRepository.save(sessionToSave);
    }
}