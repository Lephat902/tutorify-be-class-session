import { EVENT_STORE, EventStore, StoredEvent } from "@event-nest/core";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { cleanAggregateObject, validateClassAndSessionAddress } from "@tutorify/shared";
import { getNextSessionDateTime, getNextday, isValidTimeSlotDuration, sanitizeTimeSlot } from "../helpers";
import { MultipleClassSessionsCreateDto } from "../dtos";
import { Builder } from "builder-pattern";
import { ClassSession, ClassSessionCreateArgs, ClassSessionUpdateArgs, ClassSessionVerificationUpdateArgs } from "../aggregates";
import { ClassSessionUpdateDto } from "../dtos/class-session-update.dto";
import { ClassSessionReadService } from "./class-session.read.service";
import { CLASS_SESSION_UPDATED_EVENT } from "src/events";
import { ClassSessionCreateStatus, ClassSessionUpdateStatus } from "src/aggregates/enums";
import { FileProxy } from "src/proxies";

@Injectable()
export class ClassSessionWriteService {
    constructor(
        @Inject(EVENT_STORE) private eventStore: EventStore,
        private readonly fileProxy: FileProxy,
        private readonly classSessionReadService: ClassSessionReadService,
    ) { }

    async createMutiple(classSessionDto: MultipleClassSessionsCreateDto): Promise<ClassSession[]> {
        const { classId, isOnline, address, wardId } = classSessionDto;
        // Validate and prepare necessary data
        if (!validateClassAndSessionAddress(isOnline, address, wardId)) {
            throw new BadRequestException('Address & wardId is required for non-online class');
        }
        const timeSlots = sanitizeTimeSlot(classSessionDto.timeSlots);
        let currentDate = classSessionDto.startDate ?? new Date();

        const validatedSessionsData: ClassSessionCreateArgs[] = [];
        const endDateForRecurringSessions = new Date(classSessionDto?.endDateForRecurringSessions);
        for (
            let i = 0;
            i < classSessionDto?.numberOfSessionsToCreate ||
            currentDate.getDate() <= endDateForRecurringSessions?.getDate();
            ++i
        ) {
            const [startDatetime, endDatetime] = getNextSessionDateTime(currentDate, timeSlots);

            // If numberOfSessionsToCreate not specified
            if (!classSessionDto?.numberOfSessionsToCreate
                && endDatetime.getDate() > endDateForRecurringSessions.getDate())
                break;

            if (await this.classSessionReadService.isSessionOverlap(classId, startDatetime, endDatetime))
                continue;

            const newSession = this.buildSessionCreateArgs(i, classSessionDto, startDatetime, endDatetime);

            validatedSessionsData.push(newSession);
            currentDate = getNextday(startDatetime);
        }

        // In case there is just one session created, it datetime should be the startDate specified in the dto
        // Timeslots only take effect if loop creation is desired
        if (validatedSessionsData.length === 1) {
            // Set that only session to startDate
            this.setSessionDate(validatedSessionsData[0], classSessionDto.startDate ?? new Date());
        }

        // Save sessions
        const createdSessions = await Promise.all(validatedSessionsData.map(data => this.createNew(data)));

        return cleanAggregateObject(createdSessions);
    }

    async updateClassSessionVerification(
        id: string,
        data: ClassSessionVerificationUpdateArgs,
    ): Promise<ClassSession> {
        const classSession = await this.getSessionById(id);
        classSession.updateVerification(data);
        const sessionWithPublisher = this.eventStore.addPublisher(classSession);
        await sessionWithPublisher.commitAndPublishToExternal();
        return classSession;
    }

    async updateClassSession(
        id: string,
        classSessionUpdateDto: ClassSessionUpdateDto,
    ): Promise<ClassSession> {
        const now = new Date();
        const existingSession = await this.getSessionById(id);
        this.checkModificationValidity(existingSession);

        await this.validateSessionUpdate(existingSession, classSessionUpdateDto);

        // Update with new data
        const dataToUpdate = this.prepareUpdateData(classSessionUpdateDto, now);

        existingSession.update(dataToUpdate);

        // Set status to UPDATE_PENDING AFTER (just a convention) calling updating
        existingSession.updateVerification({
            updateStatus: ClassSessionUpdateStatus.UPDATE_PENDING,
            tutorVerified: false,
        });

        const sessionWithPublisher = this.eventStore.addPublisher(existingSession);
        await sessionWithPublisher.commitAndPublishToExternal();

        return cleanAggregateObject(existingSession);
    }

    async getSessionById(id: string): Promise<ClassSession> {
        const events = await this.getAllEventsById(id);
        // Reconstitute aggregate
        return ClassSession.fromEvents(id, events);
    }

    async revertToLastUpdate(classSession: ClassSession) {
        const sessionBeforeLastUpdate = await this.getSessionStateBeforeLastUpdate(classSession.id);
        classSession.update(sessionBeforeLastUpdate);
        const sessionWithPublisher = this.eventStore.addPublisher(classSession);
        await sessionWithPublisher.commitAndPublishToExternal();
    }

    async handleDeleteFileInStorage(classSessionId: string) {
        const latestClassSessionMaterials = (await this.getSessionById(classSessionId)).materials;
        const classSessionBeforeUpdateMaterials = (await this.getSessionStateBeforeLastUpdate(classSessionId)).materials;

        const materialsToDeleteInStorage = classSessionBeforeUpdateMaterials
            .filter(oldMaterial =>
                !latestClassSessionMaterials.some(updatedMaterial =>
                    oldMaterial.id === updatedMaterial.id
                )
            );
        await this.fileProxy.deleteMultipleFiles(
            materialsToDeleteInStorage.map(material => material.id)
        )
    }

    private async getAllEventsById(id: string): Promise<StoredEvent[]> {
        // Load aggregate from event store
        return this.eventStore.findByAggregateRootId(ClassSession, id);
    }

    // Note: 'Update' here doesn't count verification update
    private async getSessionStateBeforeLastUpdate(id: string): Promise<ClassSession> {
        const events = await this.getAllEventsById(id);

        // Start iterating from the last event towards the first
        for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].eventName === CLASS_SESSION_UPDATED_EVENT) {
                const eventsListBeforeLastUpdate = events.slice(0, i);
                return cleanAggregateObject(ClassSession.fromEvents(id, eventsListBeforeLastUpdate));
            }
        }

        throw new NotFoundException(`Cannot find last update of class session ${id}`);
    }

    private checkModificationValidity(classSession: ClassSession) {
        if (!classSession)
            throw new NotFoundException(`Class session not found`);
        if (classSession.createStatus !== ClassSessionCreateStatus.CREATED)
            throw new BadRequestException(`You cannot modify a ${classSession.createStatus.toLowerCase()} class session`);
        if (classSession.updateStatus !== ClassSessionUpdateStatus.UPDATED)
            throw new BadRequestException(`You cannot modify a ${classSession.updateStatus.toLowerCase()} class session`);
    }

    private async createNew(data: ClassSessionCreateArgs): Promise<ClassSession> {
        const session = ClassSession.createNew(data);
        const sessionWithPublisher = this.eventStore.addPublisher(session);
        await sessionWithPublisher.commitAndPublishToExternal();
        return session;
    }

    private buildSessionCreateArgs(
        ith: number,
        classSessionDto: MultipleClassSessionsCreateDto,
        startDatetime: Date,
        endDatetime: Date
    ): ClassSessionCreateArgs {
        const titleSuffix = ith === 0 ? '' : ` ${ith}`;
        return Builder<ClassSessionCreateArgs>()
            .tutorId(classSessionDto.tutorId)
            .classId(classSessionDto.classId)
            .description(ith === 0 ? classSessionDto?.description : '')
            .title(`${classSessionDto.title}${titleSuffix}`)
            .createdAt(new Date())
            .startDatetime(startDatetime)
            .endDatetime(endDatetime)
            .address(classSessionDto.address)
            .wardId(classSessionDto.wardId)
            .isOnline(classSessionDto.isOnline)
            .build();
    }

    // Note that it's only date, not time
    private setSessionDate(session: ClassSession | ClassSessionCreateArgs, date: Date) {
        // Set startDatetime and endDatetime to date
        const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDay()];

        // Update startDatetime and endDatetime
        [session.startDatetime, session.endDatetime].forEach(date => {
            date.setUTCFullYear(y, m, d);
        });
    }

    private async validateSessionUpdate(existingSession: ClassSession, classSessionUpdateDto: ClassSessionUpdateDto) {
        const { startDatetime, endDatetime, address, wardId, isOnline, isCancelled } = classSessionUpdateDto;
        const now = new Date();

        const tempUpdatedSession = { ...existingSession };
        Object.assign(tempUpdatedSession, classSessionUpdateDto);

        if (startDatetime !== undefined || endDatetime !== undefined) {
            // Verify if the updated timeslot long enough
            isValidTimeSlotDuration(tempUpdatedSession.startDatetime, tempUpdatedSession.endDatetime);
            const overlappedSession = await this.classSessionReadService.isSessionOverlap(
                tempUpdatedSession.classId,
                startDatetime,
                endDatetime,
            );
            if (overlappedSession) {
                throw new BadRequestException(`Updated session timeslot overlaps session ${overlappedSession.id}`);
            }
        }

        // There is at least one change in address data set
        if (address !== undefined || wardId !== undefined || isOnline !== undefined) {
            if (!validateClassAndSessionAddress(tempUpdatedSession.isOnline, tempUpdatedSession.address, tempUpdatedSession.wardId)) {
                throw new BadRequestException('Address & wardId is required for non-online class');
            }
        }

        if (isCancelled !== undefined) {
            if (isCancelled && tempUpdatedSession.endDatetime < now) {
                throw new BadRequestException("Cannot cancel ended class session");
            }
        }
    }

    private prepareUpdateData(classSessionUpdateDto: ClassSessionUpdateDto, now: Date): ClassSessionUpdateArgs {
        const { classSessionId, ...otherUpdateData } = classSessionUpdateDto;
        const dataToUpdate: ClassSessionUpdateArgs = {
            ...otherUpdateData,
            updatedAt: now,
        };
    
        if (dataToUpdate?.tutorFeedback) {
            dataToUpdate.feedbackUpdatedAt = now;
        }
    
        return dataToUpdate;
    }    
}
