import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ClassSessionDefaultAddressReturnedEventPattern,
  ClassSessionDefaultAddressReturnedEventPayload,
} from '@tutorify/shared';
import { ClassSessionWriteService } from 'src/services';
import { MutexService } from 'src/mutexes';

@Controller()
export class ClassSessionExternalEventHandler {
  constructor(
    private readonly classSessionWriteService: ClassSessionWriteService,
    private readonly mutexService: MutexService,
  ) { }

  // Received in case default address is used
  @EventPattern(new ClassSessionDefaultAddressReturnedEventPattern())
  async handleDefaultAddressReturned(
    payload: ClassSessionDefaultAddressReturnedEventPayload,
  ) {
    const { classSessionId, ...addressData } = payload;
    // Lock the mutex
    const release = await this.mutexService.acquireLockForClassSession(classSessionId);

    try {
      console.log(`Starting updating default address for class session ${classSessionId}`);
      await this.classSessionWriteService.updateClassSessionAddressBySystem(classSessionId, addressData);
    } finally {
      // Release the mutex
      release();
    }
  }
}
