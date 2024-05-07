import { EVENT_STORE, EventStore, StoredEvent } from "@event-nest/core";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { cleanAggregateObject, validateClassAndSessionAddress, FileProxy } from "@tutorify/shared";
import { getNextSessionDateTime, getNextday, isEndTimeInThePast, isValidTimeSlotDuration, sanitizeTimeSlot } from "../helpers";
import { ClassSessionDeleteDto, MultipleClassSessionsCreateDto } from "../dtos";
import { Builder } from "builder-pattern";
import { ClassSession, ClassSessionCreateArgs, ClassSessionUpdateArgs } from "../aggregates";
import { ClassSessionUpdateDto } from "../dtos/class-session-update.dto";
import { ClassSessionReadService } from "./class-session.read.service";
import { ClassSessionEventDispatcher } from "src/class-session.event-dispatcher";
import { ClassSessionMaterial } from "src/read-repository/entities/class-session-material.entity";

@Injectable()
export class ClassSessionWriteService {
    constructor(
        @Inject(EVENT_STORE) private eventStore: EventStore,
        private readonly fileProxy: FileProxy,
        private readonly classSessionReadService: ClassSessionReadService,
        private readonly classSessionEventDispatcher: ClassSessionEventDispatcher,
    ) { }

    async createMutiple(classSessionDto: MultipleClassSessionsCreateDto): Promise<ClassSession[]> {
        const { tutorId, classId, isOnline, address, wardId, useDefaultAddress } = classSessionDto;
        const { endDateForRecurringSessions = null, numberOfSessionsToCreate = 1 } = classSessionDto;
        await this.checkModificationPermission(classId, tutorId);
        // Validate and prepare necessary data
        if (!validateClassAndSessionAddress(isOnline, address, wardId, useDefaultAddress)) {
            throw new BadRequestException('Address & wardId is required for non-online class');
        }
        const timeSlots = sanitizeTimeSlot(classSessionDto.timeSlots);
        let currentDate = classSessionDto.startDate ?? new Date();

        const noLoop = (!endDateForRecurringSessions) && (numberOfSessionsToCreate <= 1);

        const validatedSessionsData: ClassSessionCreateArgs[] = [];
        let sessionsCreatedCount = 0;

        while (this.shouldContinueCreatingSessions(sessionsCreatedCount, numberOfSessionsToCreate, currentDate, endDateForRecurringSessions)) {
            const [startDatetime, endDatetime] = getNextSessionDateTime(currentDate, timeSlots);

            if (endDatetime.toISOString().split('T')[0] > endDateForRecurringSessions?.toISOString().split('T')[0])
                break;
            // Push new session, when:
            // 1. Loop && session not overlapped, or
            // 2. No loop
            if (noLoop
                || !(await this.classSessionReadService.isSessionOverlap(classId, startDatetime, endDatetime))
            ) {
                const newSession = this.buildSessionCreateArgs(sessionsCreatedCount, classSessionDto, startDatetime, endDatetime, useDefaultAddress);
                validatedSessionsData.push(newSession);
                ++sessionsCreatedCount;
            }
            currentDate = getNextday(startDatetime);
        }

        // In case there is just one session created, it datetime should be the startDate specified in the dto
        // Timeslots only take effect if loop creation is desired
        await this.handleSingleSessionCase(validatedSessionsData, classSessionDto);

        // Save sessions
        const createdSessions = await Promise.all(validatedSessionsData.map(data => this.createNew(data)));

        createdSessions.forEach(session => this.queryClassSessionAddress(session));

        return cleanAggregateObject(createdSessions);
    }

    async updateClassSession(
        id: string,
        classSessionUpdateDto: ClassSessionUpdateDto,
    ): Promise<ClassSession> {
        const now = new Date();
        const existingSession = await this.getSessionById(id);
        await this.checkModificationPermission(existingSession.classId, classSessionUpdateDto.tutorId);
        this.checkModificationValidity(existingSession);

        await this.validateSessionUpdate(existingSession, classSessionUpdateDto);

        if (classSessionUpdateDto.useDefaultAddress) {
            this.queryClassSessionAddress(existingSession);
        }

        // Update with new data
        const dataToUpdate = this.prepareUpdateData(classSessionUpdateDto, now);

        existingSession.update(dataToUpdate);

        const sessionWithPublisher = this.eventStore.addPublisher(existingSession);
        await sessionWithPublisher.commitAndPublishToExternal();

        if (classSessionUpdateDto.materials !== undefined) {
            this.handleDeleteFileInStorage(classSessionUpdateDto.materials, existingSession.materials);
        }

        return cleanAggregateObject(existingSession);
    }

    async deleteClassSession(
        classSessionDeleteDto: ClassSessionDeleteDto,
    ): Promise<ClassSession> {
        const { classSessionId, userMakeRequest } = classSessionDeleteDto;
        const { userId } = userMakeRequest;
        const existingSession = await this.getSessionById(classSessionId);
        await this.checkModificationPermission(existingSession.classId, userId);
        this.checkModificationValidity(existingSession);

        existingSession.update({
            tutorId: userId,
            isDeleted: true
        });

        const sessionWithPublisher = this.eventStore.addPublisher(existingSession);
        await sessionWithPublisher.commitAndPublishToExternal();

        this.handleDeleteFileInStorage([], existingSession.materials);

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

        existingSession.update(addressData as ClassSessionUpdateArgs);

        const sessionWithPublisher = this.eventStore.addPublisher(existingSession);
        await sessionWithPublisher.commitAndPublishToExternal();

        return cleanAggregateObject(existingSession);
    }

    async getSessionById(id: string): Promise<ClassSession> {
        const events = await this.getAllEventsById(id);
        // Reconstitute aggregate
        return ClassSession.fromEvents(id, events);
    }

    async handleDeleteFileInStorage(
        latestClassSessionMaterials: ClassSessionMaterial[],
        classSessionBeforeUpdateMaterials: ClassSessionMaterial[],
    ) {
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

    private async checkModificationPermission(classId: string, tutorId: string) {
        const classToVerify = await this.classSessionReadService.findClassById(classId);
        if (!classToVerify) 
            throw new NotFoundException(`Class ${classId} not found`);
        if (classToVerify.tutorId !== tutorId)
            throw new ForbiddenException('None of your business');
    }

    private async getAllEventsById(id: string): Promise<StoredEvent[]> {
        // Load aggregate from event store
        return this.eventStore.findByAggregateRootId(ClassSession, id);
    }

    private checkModificationValidity(classSession: ClassSession) {
        if (!classSession)
            throw new NotFoundException(`Class session not found`);
        if (classSession.isDeleted)
            throw new NotFoundException(`Class session ${classSession.id} not found`);
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
            .description(classSessionDto?.description)
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
        return i < numberOfSessionsToCreate || currentDate.toISOString().split('T')[0] <= endDateForRecurringSessions?.toISOString().split('T')[0];
    }

    private async handleSingleSessionCase(validatedSessionsData: ClassSessionCreateArgs[], classSessionDto: MultipleClassSessionsCreateDto) {
        if (validatedSessionsData.length === 1) {
            const onlySession = validatedSessionsData[0];
            this.setSessionDate(onlySession, classSessionDto.startDate ?? new Date());
            if (isEndTimeInThePast(onlySession.endDatetime)) {
                throw new BadRequestException("Endtime cannot be in the past");
            }
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
        const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];

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

        return dataToUpdate;
    }
}
