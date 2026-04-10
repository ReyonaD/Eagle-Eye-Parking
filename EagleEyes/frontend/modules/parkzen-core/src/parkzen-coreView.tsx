import { requireNativeView } from 'expo';
import * as React from 'react';

import { ParkzenCoreViewProps } from './parkzen-core.types';

const NativeView: React.ComponentType<ParkzenCoreViewProps> =
  requireNativeView('parkzen-core');

export default function ParkzenCoreView(props: ParkzenCoreViewProps) {
  return <NativeView {...props} />;
}
