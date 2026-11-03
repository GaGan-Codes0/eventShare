import { ArrowRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/theme';

import { IconButton } from './icon-button';
import { Text } from './text';

export function SectionHeading({
  eyebrow,
  title,
  onPressMore,
  moreLabel = 'See all',
}: {
  eyebrow?: string;
  title: ReactNode;
  onPressMore?: () => void;
  moreLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        {eyebrow && <Text variant="eyebrow">{eyebrow}</Text>}
        <Text variant="h2" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {onPressMore && <IconButton icon={ArrowRight} outlined size={36} accessibilityLabel={moreLabel} onPress={onPressMore} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm, marginBottom: space.lg },
  text: { flex: 1, gap: space.xs },
});
