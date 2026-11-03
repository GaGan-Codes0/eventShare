import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Camera, House, Images, Menu, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, icon, space } from '@/constants/theme';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Home', icon: House },
  album: { label: 'Album', icon: Images },
  camera: { label: 'Camera', icon: Camera },
  people: { label: 'People', icon: Users },
  more: { label: 'More', icon: Menu },
};

/** Design §7: five tabs, the camera raised in the middle and always one tap away. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
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
            {isCamera ? (
              <View style={[styles.cameraButton, focused && { backgroundColor: colors.primaryPressed }]}>
                <Icon size={icon.lg} color={colors.onPrimary} strokeWidth={icon.stroke} />
              </View>
            ) : (
              <View style={styles.iconWrap}>
                <Icon size={icon.lg} color={focused ? colors.ink : colors.subtle} strokeWidth={icon.stroke} />
                {focused && <View style={styles.dot} />}
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

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
    paddingTop: space.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: space.xs, minHeight: 48 },
  iconWrap: { height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  label: { fontSize: 11, lineHeight: 14 },
  cameraButton: {
    width: 52,
    height: 44,
    marginTop: -16,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.surfaceBar,
    boxSizing: 'content-box',
  },
});
