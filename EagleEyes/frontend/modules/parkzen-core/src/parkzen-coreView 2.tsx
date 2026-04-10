import { requireNativeView } from 'expo';
import * as React from 'react';

import { parkzen-coreViewProps } from './parkzen-core.types';

const NativeView: React.ComponentType<parkzen-coreViewProps> =
  requireNativeView('parkzen-core');

export default function parkzen-coreView(props: parkzen-coreViewProps) {
  return <NativeView {...props} />;
}
