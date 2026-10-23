import { StyleSheet, Text, View } from 'react-native';
import type { Loan } from '../api';
import { dueLabel, money } from '../format';
import { colors, radius, space, type } from '../theme';
import { Button } from './Button';

interface Props {
  loan: Loan;
  busy: boolean;
  onRepay: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
  onOpenReceipt: (loan: Loan) => void;
}

export function LoanItem({ loan, busy, onRepay, onDelete, onOpenReceipt }: Props) {
  const overdue = loan.status === 'overdue';
  const repaid = loan.status === 'repaid';
  const subtitleColor = overdue ? colors.stamp : repaid ? colors.repaid : colors.muted;

  return (
    <View style={[styles.card, overdue && styles.overdueCard, repaid && styles.repaidCard]}>
      <View style={styles.top}>
        <View style={styles.main}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, repaid && styles.dim]} numberOfLines={1}>
              {loan.friendName}
            </Text>
            {overdue ? (
              <View style={styles.stamp}>
                <Text style={styles.stampText}>Overdue</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.subtitle, { color: subtitleColor }, overdue && styles.bold]}>
            {dueLabel(loan)}
          </Text>
        </View>
        <Text style={[styles.amount, type.amount, repaid && styles.dim, overdue && { color: colors.stamp }]}>
          {money(loan.amount)}
        </Text>
      </View>

      {!repaid || loan.hasReceipt || repaid ? (
        <View style={styles.actions}>
          {!repaid ? (
            <Button
              title="Mark as repaid"
              variant="outline"
              small
              loading={busy}
              onPress={() => onRepay(loan)}
            />
          ) : null}
          {loan.hasReceipt ? (
            <Button title="View receipt" variant="text" small onPress={() => onOpenReceipt(loan)} />
          ) : null}
          {repaid ? (
            <Button
              title="Delete"
              variant="outline"
              small
              loading={busy}
              onPress={() => onDelete(loan)}
              style={styles.deleteBtn}
              textStyle={styles.deleteBtnText}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: space.lg,
    gap: space.md,
  },
  // Overdue: red edge + tinted background so late entries stand out in a long list.
  overdueCard: {
    backgroundColor: colors.stampWash,
    borderColor: colors.stamp,
    borderLeftWidth: 6,
  },
  repaidCard: { backgroundColor: colors.field },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  main: { flex: 1, gap: space.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...type.body, fontWeight: '700', flexShrink: 1 },
  dim: { opacity: 0.55 },
  subtitle: { fontSize: 13 },
  bold: { fontWeight: '700' },
  amount: { fontSize: 18, color: colors.ink },
  stamp: {
    borderWidth: 1.5,
    borderColor: colors.stamp,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    transform: [{ rotate: '-3deg' }],
  },
  stampText: { color: colors.stamp, fontWeight: '800', fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  deleteBtn: { borderColor: colors.stamp },
  deleteBtnText: { color: colors.stamp },
});
