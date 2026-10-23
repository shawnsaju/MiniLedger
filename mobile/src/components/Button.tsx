import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'text';
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, small, style, textStyle }: Props) {
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? colors.white : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'text' && styles.text,
        inactive && variant === 'primary' && styles.primaryDisabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            small && styles.labelSmall,
            { color: inactive && variant !== 'primary' ? colors.disabled : textColor },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 38, paddingHorizontal: 14 },
  primary: { backgroundColor: colors.ink },
  primaryDisabled: { backgroundColor: colors.disabled },
  outline: { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: 'transparent' },
  text: { backgroundColor: 'transparent', paddingHorizontal: 8 },
  pressed: { opacity: 0.75 },
  label: { fontSize: 16, fontWeight: '700' },
  labelSmall: { fontSize: 14 },
});
