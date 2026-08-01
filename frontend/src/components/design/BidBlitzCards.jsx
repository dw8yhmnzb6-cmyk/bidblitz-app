import { cn } from '@/lib/utils';

const baseCardClassName = 'bb-surface p-[var(--bb-card-padding)]';

export const StandardCard = ({ className, ...props }) => <div className={cn(baseCardClassName, className)} {...props} />;

export const PremiumCard = ({ className, ...props }) => (
  <div className={cn(baseCardClassName, 'bg-[linear-gradient(180deg,rgba(8,20,36,0.98),rgba(4,12,24,0.98))] shadow-[0_28px_70px_rgba(0,200,255,0.12)]', className)} {...props} />
);

export const StatCard = ({ className, ...props }) => (
  <div className={cn(baseCardClassName, 'flex flex-col gap-2', className)} {...props} />
);

export const ActionCard = ({ className, ...props }) => (
  <button className={cn(baseCardClassName, 'w-full text-left transition-transform duration-200 hover:-translate-y-0.5', className)} {...props} />
);

export const WarningCard = ({ className, ...props }) => (
  <div className={cn(baseCardClassName, 'border-[rgba(255,204,51,0.32)] bg-[linear-gradient(180deg,rgba(40,28,6,0.96),rgba(24,16,4,0.98))]', className)} {...props} />
);