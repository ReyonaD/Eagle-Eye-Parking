import * as React from 'react';

import { parkzen-coreViewProps } from './parkzen-core.types';

export default function parkzen-coreView(props: parkzen-coreViewProps) {
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
