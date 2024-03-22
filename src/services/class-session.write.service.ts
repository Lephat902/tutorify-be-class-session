import { EVENT_STORE, EventStore, StoredEvent } from "@event-nest/core";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { FileUploadResponseDto, QueueNames, cleanAggregateObject, validateClassAndSessionAddress } from "@tutorify/shared";
import { getNextSessionDate, getNextTimeSlot, getNextday, isValidTimeSlotDuration, sanitizeTimeSlot, setTimeToDate } from "../helpers";
import { MultipleClassSessionsCreateDto } from "../dtos";
import { Builder } from "builder-pattern";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { ClassSession, ClassSessionCreateArgs, ClassSessionVerificationUpdateArgs } from "../aggregates";
import { ClassSessionUpdateDto } from "../dtos/class-session-update.dto";
import { ClassSessionReadService } from "./class-session.read.service";
import { CLASS_SESSION_UPDATED_EVENT } from "src/events";
import { ClassSessionCreateStatus, ClassSessionUpdateStatus } from "src/aggregates/enums";

@Injectable()
export class ClassSessionWriteService {
    constructor(
        @Inject(EVENT_STORE) private eventStore: EventStore,
        @Inject(QueueNames.FILE)
        private readonly fileClient: ClientProxy,
        private readonly classSessionReadService: ClassSessionReadService,
    ) { }

    async createMutiple(classSessionDto: MultipleClassSessionsCreateDto): Promise<ClassSession[]> {
        const { classId, tutorId, isOnline, address, wardId, files } = classSessionDto;
        // Validate and prepare necessary data
        if (!validateClassAndSessionAddress(isOnline, address, wardId)) {
            throw new BadRequestException('Address & wardId is required for non-online class');
        }
        const timeSlots = sanitizeTimeSlot(classSessionDto.timeSlots);
        let currentDate = new Date(classSessionDto.startDate ?? Date.now());

        const validatedSessionsData: ClassSessionCreateArgs[] = [];
        const endDateForRecurringSessions = new Date(classSessionDto?.endDateForRecurringSessions);
        for (
            let i = 0;
            i < classSessionDto?.numberOfSessionsToCreate ||
            currentDate <= endDateForRecurringSessions;
            ++i
        ) {
            const nextTimeSlot = getNextTimeSlot(timeSlots, currentDate);
            const nextSessionDate = getNextSessionDate(currentDate, nextTimeSlot);
            const startDatetime = setTimeToDate(nextSessionDate, nextTimeSlot.startTime);
            const endDatetime = setTimeToDate(nextSessionDate, nextTimeSlot.endTime);

            // If numberOfSessionsToCreate not specified
            if (
                !classSessionDto?.numberOfSessionsToCreate
                && endDatetime > endDateForRecurringSessions)
                break;

            if (await this.classSessionReadService.isSessionOverlap(classId, startDatetime, endDatetime))
                continue;

            const titleSuffix = i === 0 ? '' : ` ${i}`;
            const newSession = Builder<ClassSessionCreateArgs>()
                .tutorId(tutorId)
                .classId(classId)
                .description(i === 0 ? classSessionDto?.description : '')
                .title(`${classSessionDto.title}${titleSuffix}`)
                .createdAt(new Date())
                .startDatetime(startDatetime)
                .endDatetime(endDatetime)
                .address(classSessionDto.address)
                .wardId(classSessionDto.wardId)
                .isOnline(classSessionDto.isOnline)
                .build();
            validatedSessionsData.push(newSession);
            currentDate = getNextday(nextSessionDate);
        }

        // Save sessions
        const createdSessions = await Promise.all(validatedSessionsData.map(data => this.createNew(data)));

        // Upload and assign materials to the first session
        if (createdSessions.length > 0 && files?.length > 0) {
            await this.uploadAndAssignMaterialToSession(createdSessions[0].id, files);
        }

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
        const { startDatetime, endDatetime, address, wardId, isOnline, isCancelled } = classSessionUpdateDto;
        const existingSession = await this.getSessionById(id);
        this.checkModificationValidity(existingSession);

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
            if (isCancelled && tempUpdatedSession.endDatetime < new Date()) {
                throw new BadRequestException("Cannot cancel ended class session");
            }
        }

        // Update with new data
        const { files, classSessionId, ...otherUpdateData } = classSessionUpdateDto;
        const dataToUpdate = {
            ...otherUpdateData,
            updatedAt: new Date(),
        }
        existingSession.update(dataToUpdate);

        // Set status to UPDATE_PENDING AFTER (just a convention) calling updating
        existingSession.updateVerification({
            updateStatus: ClassSessionUpdateStatus.UPDATE_PENDING,
            tutorVerified: false,
        });

        const sessionWithPublisher = this.eventStore.addPublisher(existingSession);
        await sessionWithPublisher.commitAndPublishToExternal();

        // If there is any files
        if (files?.length > 0) {
            this.uploadAndAssignMaterialToSession(existingSession.id, files);
        }

        return cleanAggregateObject(existingSession);
    }

    // Before the tutor is verified, the actual file will not be deleted
    async deleteSingleMaterial(
        tutorId: string,
        classSessionId: string,
        materialId: string,
    ) {
        const existingSession = await this.getSessionById(classSessionId);
        const updatedMaterials = existingSession.materials.filter(material => material.id !== materialId);
        existingSession.update({
            tutorId,
            materials: updatedMaterials,
            updatedAt: new Date(),
        });

        // Set status to UPDATE_PENDING AFTER (just a convention) calling updating
        existingSession.updateVerification({
            updateStatus: ClassSessionUpdateStatus.UPDATE_PENDING,
            tutorVerified: false,
        });

        const sessionWithPublisher = this.eventStore.addPublisher(existingSession);
        await sessionWithPublisher.commitAndPublishToExternal();
        return true;
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

        const materialsToDeleteInStorage = classSessionBeforeUpdateMaterials.filter(item => !latestClassSessionMaterials.includes(item));

        await Promise.allSettled(materialsToDeleteInStorage.map(material => 
            this.deleteSingleFile(material.id)
        ))
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

    private async uploadAndAssignMaterialToSession(
        classSessionId: string,
        files: Array<Express.Multer.File>,
    ) {
        const uploadedMaterialResults = await this.uploadMultipleMaterials(files);
        console.log(uploadedMaterialResults);

        const existingSession = await this.getSessionById(classSessionId);
        const updatedMaterials = [...existingSession.materials, ...uploadedMaterialResults];
        existingSession.update({
            tutorId: null,
            materials: updatedMaterials,
            updatedAt: new Date(),
        })
        const sessionWithPublisher = this.eventStore.addPublisher(existingSession);
        await sessionWithPublisher.commitAndPublishToExternal();
    }

    private async uploadMultipleMaterials(
        files: Array<Express.Multer.File>,
    ): Promise<FileUploadResponseDto[]> {
        return firstValueFrom(
            this.fileClient.send<FileUploadResponseDto[]>(
                { cmd: 'uploadMultipleFiles' },
                {
                    files,
                },
            ),
        );
    }

    private async deleteSingleFile(
        fileId: string,
    ) {
        return firstValueFrom(
            this.fileClient.send(
                { cmd: 'deleteSingleFile' },
                fileId,
            ),
        );
    }
}
