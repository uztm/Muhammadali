import { FormInput } from '@/components/FormInput';

interface NumberInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  suffix?: string;
}

export function NumberInput({ label, value, onChangeText, error, suffix }: NumberInputProps) {
  return (
    <FormInput
      label={suffix ? `${label} (${suffix})` : label}
      value={value}
      onChangeText={onChangeText}
      error={error}
      keyboardType="decimal-pad"
    />
  );
}
