import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { ClassSession } from './class-session.entity';

// This table enables fast class ownership checking without having to ask Class Service
// The main drawback of this approach is that we have to properly synchronize the data
@Entity()
export class Class {
  @PrimaryColumn()
  classId: string;

  @Column()
  studentId: string;

  @Column({ nullable: true })
  tutorId: string;

  @OneToMany(() => ClassSession, session => session.class)
  sessions: ClassSession[];
}