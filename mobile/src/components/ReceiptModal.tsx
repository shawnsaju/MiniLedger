import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Loan } from '../api';
import { colors, space, type } from '../theme';
import { Button } from './Button';

export function ReceiptModal({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [loan?.id]);

  return (
    <Modal visible={!!loan} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            Receipt from {loan?.friendName}
          </Text>
          <Button title="Close" variant="text" onPress={onClose} />
        </View>
        <View style={styles.body}>
          {loan && !failed ? (
            <Image
              source={api.receiptSource(loan.id)}
              style={styles.image}
              resizeMode="contain"
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setFailed(true);
                setLoading(false);
              }}
              accessibilityLabel={`Receipt photo for ${loan.friendName}`}
            />
          ) : null}
          {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.white} /> : null}
          {failed ? <Text style={styles.error}>This receipt couldn't be loaded.</Text> : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E131C' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  title: { ...type.label, color: colors.white, flex: 1, fontSize: 16 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  error: { color: colors.white, fontSize: 15 },
});
