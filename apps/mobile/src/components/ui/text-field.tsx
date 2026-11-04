import { TextInput, View, type TextInputProps } from 'react-native';

import { radius, space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

import { Text } from './text';

export type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
};

export function TextField({ label, hint, error, style, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text variant="label" color="accent">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.subtle}
        maxFontSizeMultiplier={1.3}
        style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts }) => ({
  field: { gap: space.sm, marginVertical: space.md },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
  },
}));
