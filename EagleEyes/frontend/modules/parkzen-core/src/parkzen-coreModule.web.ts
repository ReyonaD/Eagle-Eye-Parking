import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './parkzen-core.types';

type ParkzenCoreModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ParkzenCoreModule extends NativeModule<ParkzenCoreModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ParkzenCoreModule, 'parkzen-coreModule');
