import { Injectable } from '@nestjs/common';
import { Mutex } from 'async-mutex';

@Injectable()
export class MutexService {
  private mutexMap = new Map<string, Mutex>();

  acquireLockForClassSession(classSessionId: string) {
    let mutex = this.mutexMap.get(classSessionId);
    if (!mutex) {
      mutex = new Mutex();
      this.mutexMap.set(classSessionId, mutex);
    }
    return mutex.acquire();
  }
}