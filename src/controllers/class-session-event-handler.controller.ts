import { Controller } from '@nestjs/common';
import { ClassSessionService } from 'src/class-session.service';

@Controller()
export class ClassSessionControllerEventHandler {
  constructor(private readonly classSessionService: ClassSessionService) {}
}
