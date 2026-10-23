import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api, type Loan, type Summary } from '../api';
import { Button } from '../components/Button';
import { LoanItem } from '../components/LoanItem';
import { ReceiptModal } from '../components/ReceiptModal';
import { SummaryCard } from '../components/SummaryCard';
import { money } from '../format';
import { colors, radius, space, type } from '../theme';
import { AddLoanScreen } from './AddLoanScreen';

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

export function HomeScreen({ onLogout }: { onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [receiptLoan, setReceiptLoan] = useState<Loan | null>(null);

  // List and summary are fetched together so the card and the rows never disagree.
  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([api.listLoans(), api.summary()]);
      setLoans(l);
      setSummary(s);
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // An entry can become overdue overnight, so re-check whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmRepay(loan: Loan) {
    Alert.alert('Mark as repaid?', `${loan.friendName} paid back ${money(loan.amount)}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark as repaid',
        onPress: async () => {
          setBusyId(loan.id);
          try {
            await api.repayLoan(loan.id);
          } catch (e) {
            Alert.alert("Couldn't update the entry", messageOf(e));
          } finally {
            await load(); // also corrects the row if it was already repaid elsewhere
            setBusyId(null);
          }
        },
      },
    ]);
  }

  function confirmDelete(loan: Loan) {
    Alert.alert(
      'Delete entry?',
      `Remove ${loan.friendName}'s repaid loan of ${money(loan.amount)}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(loan.id);
            try {
              await api.deleteLoan(loan.id);
            } catch (e) {
              Alert.alert("Couldn't delete the entry", messageOf(e));
            } finally {
              await load();
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  const showEmpty = !loading && loans.length === 0 && !error;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={type.title}>MiniLedger</Text>
        <Button title="Log out" variant="text" small onPress={onLogout} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.center} color={colors.ink} size="large" />
      ) : error && loans.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Couldn't load your entries</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <Button title="Try again" onPress={load} style={styles.retry} />
        </View>
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <LoanItem loan={item} busy={busyId === item.id} onRepay={confirmRepay} onDelete={confirmDelete} onOpenReceipt={setReceiptLoan} />
          )}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          onRefresh={refresh}
          refreshing={refreshing}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
          ListHeaderComponent={
            <View>
              <SummaryCard summary={summary} />
              {error ? (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>{error}</Text>
                </View>
              ) : null}
              {loans.length > 0 ? <Text style={styles.sectionTitle}>Entries</Text> : null}
            </View>
          }
          ListEmptyComponent={
            showEmpty ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No entries yet</Text>
                <Text style={styles.emptyBody}>
                  Add the first loan you've given to a friend and it will show up here.
                </Text>
              </View>
            ) : undefined
          }
        />
      )}

      {!loading ? (
        <View style={[styles.fabWrap, { bottom: insets.bottom + space.lg }]} pointerEvents="box-none">
          <Button title="Add entry" onPress={() => setAdding(true)} style={styles.fab} />
        </View>
      ) : null}

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <AddLoanScreen
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      </Modal>

      <ReceiptModal loan={receiptLoan} onClose={() => setReceiptLoan(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  list: { paddingHorizontal: space.lg },
  gap: { height: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  sectionTitle: { ...type.heading, marginBottom: space.md, marginTop: space.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyTitle: { ...type.heading, textAlign: 'center' },
  emptyBody: { ...type.body, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  retry: { marginTop: space.md, alignSelf: 'center' },
  banner: {
    backgroundColor: colors.stampWash,
    borderWidth: 1,
    borderColor: colors.stamp,
    borderRadius: radius.field,
    padding: space.md,
    marginBottom: space.md,
  },
  bannerText: { color: colors.stamp, fontWeight: '600', fontSize: 14 },
  fabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fab: {
    paddingHorizontal: 36,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
