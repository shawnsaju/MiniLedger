import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, api } from '../api';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, radius, space, type } from '../theme';

const RESEND_SECONDS = 15; // matches the server's cooldown between OTP requests

interface Props {
  notice?: string;
  onLoggedIn: (token: string) => Promise<void>;
}

export function LoginScreen({ notice, onLoggedIn }: Props) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

  async function sendCode() {
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter your 10-digit mobile number.');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await api.requestOtp(phone.trim());
      setStep('otp');
      setOtp('');
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const { token } = await api.verifyOtp(phone.trim(), otp);
      await onLoggedIn(token); // this screen unmounts on success
    } catch (e) {
      setError(messageOf(e));
      setOtp('');
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={type.title}>MiniLedger</Text>
            <Text style={styles.tagline}>Keep track of the money you've lent to friends.</Text>
          </View>

          {notice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {step === 'phone' ? (
            <View style={styles.form}>
              <TextField
                label="Mobile number"
                prefix={phone.startsWith('+') ? undefined : '+91'}
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  setError(undefined);
                }}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={18}
                error={error}
                onSubmitEditing={sendCode}
              />
              <Button title="Send code" onPress={sendCode} loading={loading} />
              <View style={styles.demo}>
                <Text style={styles.demoText}>
                  Demo mode: no SMS is sent. The code is printed in the backend's terminal.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={type.body}>
                Enter the 6-digit code for <Text style={styles.strong}>{phone.trim()}</Text>.
              </Text>
              <TextField
                label="6-digit code"
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/\D/g, ''));
                  setError(undefined);
                }}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
                error={error}
                onSubmitEditing={verify}
                style={styles.otpInput}
              />
              <Button title="Verify and continue" onPress={verify} loading={loading} />
              <View style={styles.row}>
                <Button
                  title="Change number"
                  variant="text"
                  onPress={() => {
                    setStep('phone');
                    setError(undefined);
                  }}
                />
                <Button
                  title={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                  variant="text"
                  disabled={resendIn > 0 || loading}
                  onPress={sendCode}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xxl },
  hero: { gap: space.sm },
  tagline: { ...type.body, color: colors.muted, maxWidth: 300 },
  form: { gap: space.lg },
  strong: { fontWeight: '700' },
  otpInput: { fontSize: 24, letterSpacing: 8, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  notice: {
    backgroundColor: colors.stampWash,
    borderColor: colors.stamp,
    borderWidth: 1,
    borderRadius: radius.field,
    padding: space.md,
  },
  noticeText: { color: colors.stamp, fontWeight: '600', fontSize: 14 },
  demo: {
    borderLeftWidth: 3,
    borderLeftColor: colors.rule,
    paddingLeft: space.md,
  },
  demoText: type.small,
});
