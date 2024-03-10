import { ApplicationStatus } from '@tutorify/shared';
import { ClassSession } from '../src/read-repository/entities/class-session.entity';
import { v4 as uuidv4 } from 'uuid';

const class1Id = uuidv4();
const class2Id = uuidv4();
const tutor1Id = uuidv4();
const tutor2Id = uuidv4();

export const seedData: ClassSession[] = [
  {
    id: uuidv4(),
    classId: class1Id,
    tutorId: tutor1Id,
    status: ApplicationStatus.PENDING,
    isDesignated: false,
    appliedAt: new Date(),
    approvedAt: null,
  },
  {
    id: uuidv4(),
    classId: class1Id,
    tutorId: tutor2Id,
    status: ApplicationStatus.PENDING,
    isDesignated: false,
    appliedAt: new Date(),
    approvedAt: null,
  },
  {
    id: uuidv4(),
    classId: class2Id,
    tutorId: tutor2Id,
    status: ApplicationStatus.PENDING,
    isDesignated: false,
    appliedAt: new Date(),
    approvedAt: null,
  },
];
