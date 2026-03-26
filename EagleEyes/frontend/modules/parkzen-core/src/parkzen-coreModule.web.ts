import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './parkzen-core.types';

type parkzen-coreModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class parkzen-coreModule extends NativeModule<parkzen-coreModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(parkzen-coreModule, 'parkzen-coreModule');
