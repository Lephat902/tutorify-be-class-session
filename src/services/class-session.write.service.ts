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
import { ClassSessionEventDispatcher } from "src/class-session.event-dispatcher";

@Injectable()
export class ClassSessionWriteService {
    constructor(
        @Inject(EVENT_STORE) private eventStore: EventStore,
        private readonly fileProxy: FileProxy,
        private readonly classSessionReadService: ClassSessionReadService,
        private readonly classSessionEventDispatcher: ClassSessionEventDispatcher,
    ) { }

    async createMutiple(classSessionDto: MultipleClassSessionsCreateDto): Promise<ClassSession[]> {
        const { classId, isOnline, address, wardId, useDefaultAddress } = classSessionDto;
        const { endDateForRecurringSessions = null, numberOfSessionsToCreate = 1 } = classSessionDto;
        // Validate and prepare necessary data
        if (!validateClassAndSessionAddress(isOnline, address, wardId, useDefaultAddress)) {
            throw new BadRequestException('Address & wardId is required for non-online class');
        }
        const timeSlots = sanitizeTimeSlot(classSessionDto.timeSlots);
        let currentDate = classSessionDto.startDate ?? new Date();

        const validatedSessionsData: ClassSessionCreateArgs[] = [];
        for (
            let i = 0;
            this.shouldContinueCreatingSessions(i, numberOfSessionsToCreate, currentDate, endDateForRecurringSessions);
            ++i
        ) {
            const [startDatetime, endDatetime] = getNextSessionDateTime(currentDate, timeSlots);

            if (endDatetime.getDate() > endDateForRecurringSessions?.getDate())
                break;

            if (!(await this.classSessionReadService.isSessionOverlap(classId, startDatetime, endDatetime))) {
                const newSession = this.buildSessionCreateArgs(i, classSessionDto, startDatetime, endDatetime, useDefaultAddress);
                validatedSessionsData.push(newSession);
            }
            currentDate = getNextday(startDatetime);
        }

        // In case there is just one session created, it datetime should be the startDate specified in the dto
        // Timeslots only take effect if loop creation is desired
        await this.handleSingleSessionCase(validatedSessionsData, classSessionDto);

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

    queryClassSessionAddress(
        existingSession: ClassSession
    ) {
        const { isOnline, wardId } = existingSession;
        const needDefaultAddress = !isOnline && !wardId;
        console.log("Current address state: ", isOnline, wardId);
        if (needDefaultAddress) {
            console.log("Update address to class default");
            this.classSessionEventDispatcher.dispatchDefaultAddressQueryEvent(existingSession);
        }
    }

    async updateClassSessionAddressBySystem(
        id: string,
        addressData: Pick<ClassSessionUpdateDto, 'isOnline' | 'address' | 'wardId'>,
    ): Promise<ClassSession> {
        const existingSession = await this.getSessionById(id);
        this.checkModificationValidity(existingSession);

        existingSession.update(addressData);

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
        const latestClassSessionMaterials = (await this.getSessionById(classSessionId))?.materials;
        const classSessionBeforeUpdateMaterials = (await this.getSessionStateBeforeLastUpdate(classSessionId))?.materials;

        // No need to clean up
        if (!(latestClassSessionMaterials?.length && classSessionBeforeUpdateMaterials?.length)) {
            return;
        }

        const materialsToDeleteInStorage = classSessionBeforeUpdateMaterials
            .filter(oldMaterial =>
                !latestClassSessionMaterials.some(updatedMaterial =>
                    oldMaterial.id === updatedMaterial.id
                )
            );
        if (materialsToDeleteInStorage.length) {
            await this.fileProxy.deleteMultipleFiles(
                materialsToDeleteInStorage.map(material => material.id)
            );
        }
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

        return null;
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
        endDatetime: Date,
        useDefaultAddress: boolean,
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
            .address(useDefaultAddress ? null : classSessionDto.address)
            .wardId(useDefaultAddress ? null : classSessionDto.wardId)
            .isOnline(useDefaultAddress ? null : classSessionDto.isOnline)
            .build();
    }

    private shouldContinueCreatingSessions(i: number, numberOfSessionsToCreate: number, currentDate: Date, endDateForRecurringSessions: Date) {
        return i < numberOfSessionsToCreate || currentDate.getDate() <= endDateForRecurringSessions?.getDate();
    }

    private async handleSingleSessionCase(validatedSessionsData: ClassSessionCreateArgs[], classSessionDto: MultipleClassSessionsCreateDto) {
        if (validatedSessionsData.length === 1) {
            const onlySession = validatedSessionsData[0];
            this.setSessionDate(onlySession, classSessionDto.startDate ?? new Date());
            const overlappedSession = await this.classSessionReadService.isSessionOverlap(
                classSessionDto.classId,
                onlySession.startDatetime,
                onlySession.endDatetime,
            );
            if (overlappedSession) {
                throw new BadRequestException(`This session overlap timeslot of session ${overlappedSession.id}`);
            }
        }
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
        const { startDatetime, endDatetime, address, wardId, isOnline, useDefaultAddress, isCancelled } = classSessionUpdateDto;
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
            if (!validateClassAndSessionAddress(
                tempUpdatedSession.isOnline,
                tempUpdatedSession.address,
                tempUpdatedSession.wardId,
                useDefaultAddress
            )) {
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

        if (classSessionUpdateDto.useDefaultAddress) {
            dataToUpdate.isOnline = dataToUpdate.address = dataToUpdate.wardId = null;
        }

        return dataToUpdate;
    }
}
