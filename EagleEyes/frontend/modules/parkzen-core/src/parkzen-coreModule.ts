import { NativeModule, requireNativeModule } from 'expo';

import { parkzen-coreModuleEvents } from './parkzen-core.types';

declare class parkzen-coreModule extends NativeModule<parkzen-coreModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<parkzen-coreModule>('parkzen-core');
