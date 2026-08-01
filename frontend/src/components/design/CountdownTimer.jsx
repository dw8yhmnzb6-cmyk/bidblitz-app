import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BIDBLITZ_BREAKPOINTS, formatBidBlitzDuration } from '../../design/tokens';

function useCompactTimer(compactBelow) {
  const getMatches = () => (typeof window !== 'undefined' ? window.innerWidth < compactBelow : false);
  const [compact, setCompact] = useState(getMatches);

  useEffect(() => {
    const handleResize = () => setCompact(getMatches());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [compactBelow]);

  return compact;
}

export const CountdownTimer = ({
  targetDate,
  seconds,
  status,
  locale = 'de',
  compactBelow = BIDBLITZ_BREAKPOINTS.mobileMd,
  endedLabel,
  className,
  testId = 'countdown-timer',
}) => {
  const getRemaining = () => {
    if (Number.isFinite(Number(seconds))) return Math.max(0, Math.floor(Number(seconds)));
    const targetMs = new Date(targetDate || '').getTime();
    if (Number.isNaN(targetMs)) return 0;
    return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  };

  const [remaining, setRemaining] = useState(getRemaining);
  const compact = useCompactTimer(compactBelow);

  useEffect(() => {
    setRemaining(getRemaining());
    const timer = window.setInterval(() => setRemaining(getRemaining()), 1000);
    return () => window.clearInterval(timer);
  }, [seconds, targetDate]);

  const label = useMemo(() => {
    if (status === 'ended') return endedLabel || (locale.startsWith('de') ? 'Beendet' : 'Ended');
    return formatBidBlitzDuration(remaining, { locale, compact, endedLabel });
  }, [compact, endedLabel, locale, remaining, status]);

  return (
    <span
      data-testid={testId}
      data-compact={compact ? 'true' : 'false'}
      className={cn('font-mono tabular-nums tracking-tight', className)}
    >
      {label}
    </span>
  );
};