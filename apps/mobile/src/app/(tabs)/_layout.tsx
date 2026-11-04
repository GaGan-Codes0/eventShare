import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';

import { TabBar } from '@/components/tab-bar';
import { defaultTheme, ThemeProvider, useCurrentEventTheme } from '@/theme';

/** The event tabs wear the open event's theme. Home is outside any event, so it keeps eventShare's. */
export default function EventTabs() {
  const theme = useCurrentEventTheme();
  return (
    <ThemeProvider theme={theme}>
      <Tabs
        tabBar={(props) => {
          const shown = props.state.routes[props.state.index]?.name === 'index' ? defaultTheme : theme;
          return (
            <ThemeProvider theme={shown}>
              {/* Light status bar text on dark event themes. */}
              <StatusBar style={shown.dark ? 'light' : 'dark'} />
              <TabBar {...props} />
            </ThemeProvider>
          );
        }}
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
