import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { defaultTheme, ThemeProvider, useCurrentEventTheme } from '@/theme';

/** The event tabs wear the open event's theme. Home is outside any event, so it keeps eventShare's. */
export default function EventTabs() {
  const theme = useCurrentEventTheme();
  return (
    <ThemeProvider theme={theme}>
      <Tabs
        tabBar={(props) => (
          <ThemeProvider theme={props.state.routes[props.state.index]?.name === 'index' ? defaultTheme : theme}>
            <TabBar {...props} />
          </ThemeProvider>
        )}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.colors.paper } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="album" />
        <Tabs.Screen name="camera" />
        <Tabs.Screen name="people" />
        <Tabs.Screen name="more" />
      </Tabs>
    </ThemeProvider>
  );
}
