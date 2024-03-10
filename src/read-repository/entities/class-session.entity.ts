import {
  Entity,
  Column,
  PrimaryColumn,
} from 'typeorm';
import { Geometry } from 'geojson';
import { ClassSessionMaterial } from './class-session-material.entity';
import { ClassSessionStatus } from '@tutorify/shared';

@Entity()
export class ClassSession {
  @PrimaryColumn()
  id: string;

  @Column()
  classId: string;

  @Column({ default: '' })
  description: string;

  @Column({ default: '' })
  title: string;

  @Column({ default: false })
  isCancelled: boolean;

  @Column({ nullable: true })
  createdAt: Date;

  @Column({ nullable: true })
  updatedAt: Date;

  @Column({ nullable: true })
  startDatetime: Date;

  @Column({ nullable: true })
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
