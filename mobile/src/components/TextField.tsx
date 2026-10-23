import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, space, type } from '../theme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
}

export function TextField({ label, error, hint, prefix, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>{label}</Text>
      <View style={[styles.box, !!error && styles.boxError]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.disabled}
          style={[styles.input, style]}
          {...input}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={type.small}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.field,
    backgroundColor: colors.field,
  },
  boxError: { borderColor: colors.stamp },
  prefix: { ...type.body, color: colors.muted, marginRight: space.sm, fontWeight: '600' },
  input: { flex: 1, ...type.body, paddingVertical: space.md },
  error: { fontSize: 13, color: colors.stamp, fontWeight: '600' },
});
