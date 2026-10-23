import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, api, type ReceiptFile } from '../api';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { addDays, formatDate, startOfToday, toYmd } from '../format';
import { colors, radius, space, type } from '../theme';

interface Props {
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

type Errors = { friendName?: string; amount?: string; dueDate?: string };

// Same rules as the server, so mistakes are caught before a round trip. The server still re-checks.
function validate(name: string, amountText: string): { errors: Errors; amount: number } {
  const errors: Errors = {};
  if (!name.trim()) errors.friendName = "Enter your friend's name.";
  else if (name.trim().length > 100) errors.friendName = 'Keep the name under 100 characters.';

  const cleaned = amountText.replace(/,/g, '').trim();
  const amount = Number(cleaned);
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) errors.amount = 'Enter an amount like 500 or 1250.50.';
  else if (amount <= 0) errors.amount = 'The amount must be more than 0.';
  else if (amount > 999_999_999) errors.amount = 'That amount is too large.';
  return { errors, amount };
}

function receiptFrom(asset: ImagePicker.ImagePickerAsset): ReceiptFile {
  const ext = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
  const guessed =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' || ext === 'heif' ? 'image/heic' : 'image/jpeg';
  const declared = asset.mimeType === 'image/heif' ? 'image/heic' : asset.mimeType;
  return {
    uri: asset.uri,
    name: asset.fileName ?? `receipt-${Date.now()}.${ext ?? 'jpg'}`,
    type: declared ?? guessed,
  };
}

export function AddLoanScreen({ onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => addDays(startOfToday(), 7));
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  function openDatePicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dueDate,
        mode: 'date',
        onValueChange: (_event, date) => setDueDate(date),
      });
    } else {
      setShowIosPicker((v) => !v);
    }
  }

  async function pickReceipt(source: 'camera' | 'library') {
    setFormError(undefined);
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setFormError('Camera access is off. Allow it in Settings, or choose a photo from your library.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7, // keeps phone photos well under the server's 5 MB limit
      // iOS: hand back a JPEG instead of HEIC so the receipt displays everywhere
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) setReceipt(result.assets[0]);
  }

  async function save() {
    const checked = validate(name, amount);
    setErrors(checked.errors);
    setFormError(undefined);
    if (Object.keys(checked.errors).length) return;

    setSaving(true);
    try {
      await api.createLoan({
        friendName: name.trim(),
        amount: checked.amount,
        dueDate: toYmd(dueDate),
        receipt: receipt ? receiptFrom(receipt) : undefined,
      });
      await onSaved();
    } catch (e) {
      if (e instanceof ApiError) {
        // Server-side validation messages go under the matching field.
        const { friendName, amount: amt, dueDate: due } = e.fieldErrors;
        if (friendName || amt || due) setErrors({ friendName, amount: amt, dueDate: due });
        else setFormError(e.message);
      } else {
        setFormError('Something went wrong. Try again.');
      }
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={type.heading}>New entry</Text>
        <Button title="Cancel" variant="text" onPress={onClose} disabled={saving} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextField
            label="Friend's name"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setErrors((e) => ({ ...e, friendName: undefined }));
            }}
            placeholder="Asha"
            autoCapitalize="words"
            maxLength={100}
            error={errors.friendName}
          />

          <TextField
            label="Amount"
            prefix="₹"
            value={amount}
            onChangeText={(t) => {
              setAmount(t);
              setErrors((e) => ({ ...e, amount: undefined }));
            }}
            placeholder="500"
            keyboardType="decimal-pad"
            error={errors.amount}
          />

          <View style={styles.group}>
            <Text style={type.label}>Due date</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Due date, ${formatDate(dueDate)}. Tap to change.`}
              onPress={openDatePicker}
              style={styles.dateBox}
            >
              <Text style={type.body}>{formatDate(dueDate)}</Text>
              <Text style={styles.change}>Change</Text>
            </Pressable>
            {errors.dueDate ? <Text style={styles.error}>{errors.dueDate}</Text> : null}
            {Platform.OS === 'ios' && showIosPicker ? (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display="inline"
                onValueChange={(_event, date) => setDueDate(date)}
              />
            ) : null}
          </View>

          <View style={styles.group}>
            <Text style={type.label}>Receipt photo (optional)</Text>
            {receipt ? (
              <View style={styles.receiptRow}>
                <Image source={{ uri: receipt.uri }} style={styles.thumb} accessibilityLabel="Selected receipt photo" />
                <Button title="Remove photo" variant="outline" small onPress={() => setReceipt(null)} />
              </View>
            ) : (
              <View style={styles.receiptRow}>
                <Button title="Take photo" variant="outline" small onPress={() => pickReceipt('camera')} />
                <Button title="Choose photo" variant="outline" small onPress={() => pickReceipt('library')} />
              </View>
            )}
          </View>

          {formError ? (
            <View style={styles.formError} accessibilityLiveRegion="polite">
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          ) : null}

          <Button title="Save entry" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  content: { padding: space.xl, gap: space.xl },
  group: { gap: space.sm },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.field,
    backgroundColor: colors.field,
  },
  change: { color: colors.pending, fontWeight: '700', fontSize: 14 },
  error: { fontSize: 13, color: colors.stamp, fontWeight: '600' },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 96, height: 96, borderRadius: radius.field, backgroundColor: colors.rule },
  formError: {
    backgroundColor: colors.stampWash,
    borderWidth: 1,
    borderColor: colors.stamp,
    borderRadius: radius.field,
    padding: space.md,
  },
  formErrorText: { color: colors.stamp, fontWeight: '600', fontSize: 14 },
});
