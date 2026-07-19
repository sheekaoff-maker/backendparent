import { Injectable } from '@nestjs/common';
import { RouterDatabaseService } from './router-database.service';
import { RouterCapabilities } from './router-capability.matrix';

type BooleanCapabilityFlag = {
  [K in keyof RouterCapabilities]: RouterCapabilities[K] extends boolean ? K : never;
}[keyof RouterCapabilities];

@Injectable()
export class CapabilityEngineService {
  constructor(private routerDatabase: RouterDatabaseService) {}

  getCapabilities(pluginId: string | null | undefined): RouterCapabilities | null {
    if (!pluginId) return null;
    return this.routerDatabase.getCapabilities(pluginId);
  }

  /** Undetected/unrecognized routers support nothing — never throws. */
  isSupported(pluginId: string | null | undefined, flag: BooleanCapabilityFlag): boolean {
    const capabilities = this.getCapabilities(pluginId);
    if (!capabilities) return false;
    return Boolean(capabilities[flag]);
  }
}
