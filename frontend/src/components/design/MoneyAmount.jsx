import { cn } from '@/lib/utils';
import { formatBidBlitzCurrency } from '../../design/tokens';

export const MoneyAmount = ({
  value = 0,
  locale = 'de',
  currency = 'EUR',
  compact = false,
  privacy = false,
  signDisplay = 'auto',
  className,
  testId = 'money-amount',
}) => {
  const numericValue = Number(value || 0);
  const toneClass = numericValue > 0
    ? 'text-[var(--bb-text-primary)]'
    : numericValue < 0
      ? 'text-[var(--bb-accent-danger)]'
      : 'text-[var(--bb-text-primary)]';

  return (
    <span
      data-testid={testId}
      data-locale={locale}
      data-currency={currency}
      data-compact={compact ? 'true' : 'false'}
      className={cn('font-mono tabular-nums tracking-tight', toneClass, className)}
    >
      {formatBidBlitzCurrency(numericValue, { locale, currency, compact, privacy, signDisplay })}
    </span>
  );
};