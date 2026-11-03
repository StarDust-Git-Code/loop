import { registerWidgetTaskHandler } from 'react-native-android-widget';
import './src/lib/notify';
import { widgetTaskHandler } from './src/widget/handler';
import 'expo-router/entry';

registerWidgetTaskHandler(widgetTaskHandler);
