import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

const BRAND = '#6A4DF4';
const Btn = ({ label, uri }: { label: string; uri: string }) => (
  <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri }} style={{ flex: 1, height: 'match_parent', backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 }}>
    <TextWidget text={label} style={{ fontSize: 14, fontWeight: '700', color: BRAND }} />
  </FlexWidget>
);

function Quick() {
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BRAND, borderRadius: 24, padding: 12, flexDirection: 'column' }}>
      <TextWidget text="Loopmates" style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'row', width: 'match_parent' }}>
        <Btn label="Chat" uri="loopmates://chat-new?mate=planner" />
        <Btn label="Call" uri="loopmates://call?mate=mimo" />
        <Btn label="Runs" uri="loopmates://runs" />
      </FlexWidget>
    </FlexWidget>
  );
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName === 'LoopQuick' && props.widgetAction !== 'WIDGET_DELETED') props.renderWidget(<Quick />);
}
