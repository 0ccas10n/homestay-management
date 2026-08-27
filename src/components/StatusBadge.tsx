type BadgeVariant = string;

const configs: Record<string, { bg: string; color: string }> = {
  Available: { bg: '#D1FAE5', color: '#065F46' },
  Occupied: { bg: '#DBEAFE', color: '#1E40AF' },
  Cleaning: { bg: '#FEF3C7', color: '#92400E' },
  Maintenance: { bg: '#FEE2E2', color: '#991B1B' },
  Reserved: { bg: '#EDE9FE', color: '#5B21B6' },
  Confirmed: { bg: '#DBEAFE', color: '#1E40AF' },
  'Checked In': { bg: '#D1FAE5', color: '#065F46' },
  'Checked Out': { bg: '#F1F5F9', color: '#475569' },
  Cancelled: { bg: '#FEE2E2', color: '#991B1B' },
  Paid: { bg: '#D1FAE5', color: '#065F46' },
  Partial: { bg: '#FEF3C7', color: '#92400E' },
  Pending: { bg: '#F1F5F9', color: '#475569' },
  Refunded: { bg: '#EDE9FE', color: '#5B21B6' },
  Waiting: { bg: '#FEE2E2', color: '#991B1B' },
  'In Progress': { bg: '#FEF3C7', color: '#92400E' },
  Completed: { bg: '#D1FAE5', color: '#065F46' },
  High: { bg: '#FEE2E2', color: '#991B1B' },
  Medium: { bg: '#FEF3C7', color: '#92400E' },
  Low: { bg: '#D1FAE5', color: '#065F46' },
};

export default function StatusBadge({ status }: { status: BadgeVariant }) {
  const cfg = configs[status] ?? { bg: '#F1F5F9', color: '#475569' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 99, whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {status}
    </span>
  );
}
