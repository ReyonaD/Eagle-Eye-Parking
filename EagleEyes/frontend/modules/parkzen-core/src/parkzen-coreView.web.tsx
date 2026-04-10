import * as React from 'react';

import { ParkzenCoreViewProps } from './parkzen-core.types';

export default function ParkzenCoreView(props: ParkzenCoreViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
