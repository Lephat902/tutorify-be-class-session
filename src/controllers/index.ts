import { ClassSessionExternalEventHandler } from './class-session-event-handler.controller';
import { ReadRepositorySync } from './class-session-read-repository-sync.controller';
import { ClassSessionController } from './class-session.controller';

export const Controllers = [
    ClassSessionController,
    ClassSessionExternalEventHandler,
    ReadRepositorySync,
];