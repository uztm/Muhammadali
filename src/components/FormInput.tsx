import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { theme } from '@/constants/theme';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormInput({ label, error, style, ...props }: FormInputProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.subtle}
        style={[styles.input, Boolean(error) && styles.inputError, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 7,
  },
  label: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 16,
  },
  inputError: {
    borderColor: theme.colors.red,
  },
  error: {
    color: theme.colors.red,
    fontFamily: theme.font,
    fontSize: 12,
  },
});
