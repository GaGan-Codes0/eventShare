import { Pressable, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

import { Text } from './text';

type Props<T extends string | number> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

/** A row of mutually exclusive choices, e.g. 20 / 40 / 60 photos. */
export function Segmented<T extends string | number>({ options, value, onChange, accessibilityLabel, disabled }: Props<T>) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={[styles.option, selected && styles.selected]}>
            <Text variant="label" style={{ color: selected ? colors.onPrimary : colors.ink }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  track: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  option: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  selected: { backgroundColor: colors.primary },
}));
