import { StyleSheet, Text, View } from 'react-native';
import type { Summary } from '../api';
import { money } from '../format';
import { colors, radius, space, type } from '../theme';

/**
 * Total lent, with a bar that splits it into repaid / still pending / overdue so you can see
 * at a glance how much of your money is back and how much is late.
 */
export function SummaryCard({ summary }: { summary: Summary | null }) {
  const s = summary ?? {
    totalLent: 0,
    totalRepaid: 0,
    outstanding: 0,
    overdueAmount: 0,
    entryCount: 0,
    repaidCount: 0,
    overdueCount: 0,
  };
  const pendingNotLate = Math.max(0, s.outstanding - s.overdueAmount);
  const segments = [
    { key: 'repaid', value: s.totalRepaid, color: colors.repaid },
    { key: 'pending', value: pendingNotLate, color: colors.pending },
    { key: 'overdue', value: s.overdueAmount, color: colors.stamp },
  ].filter((seg) => seg.value > 0);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={type.small}>Total lent</Text>
      <Text style={styles.total}>{money(s.totalLent)}</Text>

      <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no">
        {segments.map((seg) => (
          <View key={seg.key} style={{ flex: seg.value, backgroundColor: seg.color }} />
        ))}
      </View>

      <View style={styles.figures}>
        <Figure label="Repaid" value={s.totalRepaid} color={colors.repaid} />
        <Figure label="Still owed" value={s.outstanding} color={colors.pending} />
        <Figure
          label={s.overdueCount > 0 ? `Overdue (${s.overdueCount})` : 'Overdue'}
          value={s.overdueAmount}
          color={s.overdueAmount > 0 ? colors.stamp : colors.muted}
        />
      </View>
    </View>
  );
}

function Figure({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.figure}>
      <View style={styles.labelRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={type.small}>{label}</Text>
      </View>
      <Text style={[styles.figureValue, type.amount, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {money(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: space.xl,
    gap: space.xs,
    marginBottom: space.lg,
  },
  total: { ...type.amount, fontSize: 38, color: colors.ink, letterSpacing: -1 },
  bar: {
    flexDirection: 'row',
    height: 10,
    marginVertical: space.lg,
    borderRadius: radius.bar,
    overflow: 'hidden',
    backgroundColor: colors.rule,
    gap: 2,
  },
  figures: { flexDirection: 'row', gap: space.md },
  figure: { flex: 1, gap: space.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  figureValue: { fontSize: 17 },
});
