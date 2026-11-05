import { Pressable, ScrollView } from 'react-native';

import { radius, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

import { Text } from './text';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** A row of filter pills: Everyone / Photographers / Mine. Scrolls sideways if they don't fit. */
export function Chips<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.chip, selected && styles.selected]}>
            <Text variant="label" style={{ color: selected ? colors.onPrimary : colors.ink }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: { gap: 6 },
  chip: { paddingHorizontal: 13, paddingVertical: space.sm, borderRadius: radius.full, backgroundColor: colors.sage },
  selected: { backgroundColor: colors.primary },
}));
