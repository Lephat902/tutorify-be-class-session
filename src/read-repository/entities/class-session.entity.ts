import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
} from 'typeorm';
import { Geometry } from 'geojson';
import { ClassSessionMaterial } from './class-session-material.entity';
import { Class } from './class.entity';

@Entity()
export class ClassSession {
  @PrimaryColumn()
  id: string;

  @ManyToOne(() => Class, cl => cl.sessions)
  class: Class;

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

  @Column({ nullable: true })  
  feedbackUpdatedAt: Date;
}
