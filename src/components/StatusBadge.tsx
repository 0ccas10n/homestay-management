import { formatStatusLabel } from '@/utils/format';

type BadgeVariant = string;

// Keys are normalized to lowercase snake_case so lookups work regardless of
// whether the caller passes a raw DB value ("checked_in") or a pre-formatted
// label ("Checked In").
const configs: Record<string, { bg: string; color: string }> = {
  available: { bg: '#D1FAE5', color: '#065F46' },
  occupied: { bg: '#DBEAFE', color: '#1E40AF' },
  cleaning: { bg: '#FEF3C7', color: '#92400E' },
  needs_cleaning: { bg: '#FEF3C7', color: '#92400E' },
  maintenance: { bg: '#FEE2E2', color: '#991B1B' },
  inactive: { bg: '#F1F5F9', color: '#475569' },
  reserved: { bg: '#EDE9FE', color: '#5B21B6' },
  inquiry: { bg: '#EDE9FE', color: '#5B21B6' },
  confirmed: { bg: '#DBEAFE', color: '#1E40AF' },
  checked_in: { bg: '#D1FAE5', color: '#065F46' },
  checked_out: { bg: '#F1F5F9', color: '#475569' },
  cancelled: { bg: '#FEE2E2', color: '#991B1B' },
  no_show: { bg: '#FEF3C7', color: '#92400E' },
  paid: { bg: '#D1FAE5', color: '#065F46' },
  partial: { bg: '#FEF3C7', color: '#92400E' },
  pending: { bg: '#F1F5F9', color: '#475569' },
  refunded: { bg: '#EDE9FE', color: '#5B21B6' },
  waiting: { bg: '#FEE2E2', color: '#991B1B' },
  in_progress: { bg: '#FEF3C7', color: '#92400E' },
  completed: { bg: '#D1FAE5', color: '#065F46' },
  high: { bg: '#FEE2E2', color: '#991B1B' },
  medium: { bg: '#FEF3C7', color: '#92400E' },
  low: { bg: '#D1FAE5', color: '#065F46' },
};

export default function StatusBadge({ status }: { status: BadgeVariant }) {
  const key = status.trim().toLowerCase().replace(/\s+/g, '_');
  const cfg = configs[key] ?? { bg: '#F1F5F9', color: '#475569' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 99, whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {formatStatusLabel(status)}
    </span>
  );
}
