import { EVENT_STORE, EventStore } from "@event-nest/core";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { FileUploadResponseDto, QueueNames, validateClassAndSessionAddress } from "@tutorify/shared";
import { getNextSessionDate, getNextTimeSlot, getNextday, isValidTimeSlotDuration, sanitizeTimeSlot, setTimeToDate } from "../helpers";
import { MultipleClassSessionsCreateDto } from "../dtos";
import { Builder } from "builder-pattern";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { ClassSession, ClassSessionCreateArgs, ClassSessionVerificationUpdateArgs } from "../aggregates";
import { ClassSessionUpdateDto } from "../dtos/class-session-update.dto";
import { ClassSessionReadService } from "./class-session.read.service";

@Injectable()
export class ClassSessionWriteService {
    constructor(
        @Inject(EVENT_STORE) private eventStore: EventStore,
        @Inject(QueueNames.FILE)
        private readonly fileClient: ClientProxy,
        private readonly classSessionReadService: ClassSessionReadService,
    ) { }

    async createMutiple(classSessionDto: MultipleClassSessionsCreateDto): Promise<ClassSessionCreateArgs[]> {
        const { classId, tutorId, isOnline, address, wardId, files } = classSessionDto;
        // Validate and prepare necessary data
        if (!validateClassAndSessionAddress(isOnline, address, wardId)) {
            throw new BadRequestException('Address & wardId is required for online class');
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

        return validatedSessionsData;
    }

    async updateClassSessionVerification(
        id: string,
        data: ClassSessionVerificationUpdateArgs,
    ): Promise<ClassSession> {
        const classSession = await this.getSessionById(id);
        classSession.update(data);
        const userWithPublisher = this.eventStore.addPublisher(classSession);
        await userWithPublisher.commitAndPublishToExternal();
        return classSession;
    }

    async updateClassSession(
        id: string,
        classSessionUpdateDto: ClassSessionUpdateDto,
    ): Promise<ClassSession> {
        const { startDatetime, endDatetime, address, wardId, isOnline } = classSessionUpdateDto;
        const existingSession = await this.getSessionById(id);
        if (!existingSession)
            throw new NotFoundException(`Class session ${id} not found`);
        const tempUpdatedSession = { ...existingSession };
        Object.assign(tempUpdatedSession, classSessionUpdateDto);

        if (startDatetime || endDatetime) {
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
                throw new BadRequestException('Address & wardId is required for online class');
            }
        }

        const { files, ...dataToUpdate } = classSessionUpdateDto;
        existingSession.update(dataToUpdate);
        const userWithPublisher = this.eventStore.addPublisher(existingSession);
        await userWithPublisher.commitAndPublishToExternal();

        // If there is any files
        if (files?.length > 0) {
            this.uploadAndAssignMaterialToSession(existingSession.id, files);
        }

        return existingSession;
    }

    async getSessionById(id: string): Promise<ClassSession> {
        // Load aggregate from event store
        const events = await this.eventStore.findByAggregateRootId(ClassSession, id);
        // Reconstitute aggregate
        return ClassSession.fromEvents(id, events);
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
            materials: updatedMaterials,
        })
        const userWithPublisher = this.eventStore.addPublisher(existingSession);
        await userWithPublisher.commitAndPublishToExternal();
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
}