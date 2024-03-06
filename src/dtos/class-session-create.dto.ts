export class ClassSessionCreateDto {
  tutorId: string;
  classId: string;
  description?: string;
  title: string;
  startDatetime: Date;
  endDatetime: Date;
  address?: string;
  wardId?: string;
  isOnline: boolean;
  materials?: {
    description: string;
    file: Express.Multer.File;
  }[];
  tutorFeedback: string;
}
