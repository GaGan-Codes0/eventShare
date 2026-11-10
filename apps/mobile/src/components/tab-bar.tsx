import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Camera, House, Images, LayoutGrid, Palette, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { icon, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  home: { label: 'Home', icon: House },
  camera: { label: 'Camera', icon: Camera },
  album: { label: 'Album', icon: Images },
  overview: { label: 'Overview', icon: House },
  gallery: { label: 'Gallery', icon: LayoutGrid },
  design: { label: 'Design', icon: Palette },
  people: { label: 'People', icon: Users },
  rules: { label: 'Rules', icon: SlidersHorizontal },
};

/** Guests and photographers shoot; the host runs the event (and shoots from Overview). */
export const GUEST_TABS = ['home', 'camera', 'album'];
export const HOST_TABS = ['overview', 'gallery', 'design', 'people', 'rules'];

/**
 * Guests: Home, Camera, Album. Hosts: the organizer's five tabs. The tab you're on is the one
 * raised, so it's always clear where you are. Every screen lives in one navigator; each role
 * sees only its own tabs.
 */
export function TabBar({ state, emitter, navigateToTab, isHost }: BottomTabBarProps & { isHost: boolean }) {
  const visible = isHost ? HOST_TABS : GUEST_TABS;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab || !visible.includes(route.name)) return null;
        const focused = state.index === index;
        const isCamera = route.name === 'camera';
        const Icon = tab.icon;

        function onPress() {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            if (isCamera) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigateToTab(route.key);
          }
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={onPress}
            style={styles.tab}>
            {focused ? (
              <View style={styles.raised}>
                <Icon size={icon.lg} color={colors.onPrimary} strokeWidth={icon.stroke} />
              </View>
            ) : (
              <View style={styles.iconWrap}>
                <Icon size={icon.lg} color={colors.subtle} strokeWidth={icon.stroke} />
              </View>
            )}
            <Text variant="caption" style={[styles.label, { color: focused ? colors.ink : colors.subtle }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
    paddingTop: space.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: space.xs, minHeight: 48 },
  iconWrap: { height: 28, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, lineHeight: 14 },
  // 40 + 2×4 border, lifted 20: the same 28pt as a flat icon, so labels stay level whichever tab is raised.
  raised: {
    width: 52,
    height: 40,
    marginTop: -20,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surfaceBar,
    boxSizing: 'content-box',
  },
}));
