import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Geometry } from 'geojson';
import { ClassSessionMaterial } from './class-session-material.entity';
import { ClassSessionStatus } from '@tutorify/shared';

@Entity()
export class ClassSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  classId: string;

  @Column({ default: '' })
  description: string;

  @Column()
  title: string;

  @Column({ default: false })
  isCancelled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ nullable: false })
  startDatetime: Date;

  @Column({ nullable: false })
  endDatetime: Date;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  wardId: string;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', nullable: true })
  location: Geometry;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: 'jsonb', default: '[]' })
  materials: ClassSessionMaterial[];

  @Column({ default: '' })
  tutorFeedback: string;

  @Column({
    type: 'enum',
    enum: ClassSessionStatus,
    default: ClassSessionStatus.CREATE_PENDING,
  })
  status: ClassSessionStatus;

  @Column({ default: false })
  classVerified: boolean;

  @Column({ default: false })
  tutorVerified: boolean;
}
