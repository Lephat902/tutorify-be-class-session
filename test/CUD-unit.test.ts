import { TestingModule } from '@nestjs/testing';
import { ClassSessionService } from '../src/services';
import { buildTestingModule } from './build-testing-module';
import { MultipleClassSessionsCreateDto } from '../src/dtos';
import { ApplicationStatus, BroadcastService } from '@tutorify/shared';
import { v4 as uuidv4 } from 'uuid';
import { ClassSession } from '../src/read-repository/entities/class-session.entity';
import { ClassSessionRepository } from '../src/read-repository/read.repository';
import { seedData } from './seed-data';

describe('ClassSessionService', () => {
  let service: ClassSessionService;
  let repository: ClassSessionRepository;
  let broadcastService: BroadcastService;

  beforeEach(async () => {
    const module: TestingModule = await buildTestingModule();
    service = module.get<ClassSessionService>(ClassSessionService);
    repository = module.get<ClassSessionRepository>(ClassSessionRepository);
    broadcastService = module.get<BroadcastService>(BroadcastService);
    // Mock broadcasting event
    jest
      .spyOn(broadcastService, 'broadcastEventToAllMicroservices')
      .mockResolvedValueOnce();
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear all mock calls after each test
  });

  xit('should insert a new class application', async () => {
    // Arrange
    const classApplicationCreateDto: MultipleClassSessionsCreateDto = {
      classId: uuidv4(),
      tutorId: uuidv4(),
      isDesignated: false,
      appliedAt: new Date(),
    };

    // Act
    const insertedClassApplication: ClassSession =
      await service.addNewApplication(classApplicationCreateDto);

    // Assert
    expect(insertedClassApplication).toEqual(
      expect.objectContaining(classApplicationCreateDto),
    );
    expect(insertedClassApplication.id).toBeDefined();
    expect(insertedClassApplication.status).toEqual(ApplicationStatus.PENDING);
    expect(insertedClassApplication.approvedAt).toEqual(null);

    // Act
    const classApplications = await service.getAllApplications({});

    // Assert
    expect(classApplications).toHaveLength(1);
    expect(classApplications[0]).toEqual(insertedClassApplication);
  });

  it('should change status of application to CANCELLED', async () => {
    // Arrange
    await repository.save(seedData);
    const randomClassApplication = await repository.findOneBy({});

    // Act
    const res = await service.cancelClassSession(randomClassApplication.id);
    const cancelledApplcation = await service.getApplicationById(
      randomClassApplication.id,
    );

    // Assert
    expect(res).toBe(true);
    expect(cancelledApplcation.status).toEqual(ApplicationStatus.CANCELLED);
  });
});
