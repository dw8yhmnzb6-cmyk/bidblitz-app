import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

const baseClassName = 'min-h-[var(--bb-button-height)] rounded-[var(--bb-radius-button)] px-5 text-sm font-bold transition-[transform,background-color,border-color,box-shadow] duration-200';

export const PrimaryButton = ({ className, ...props }) => (
  <Button
    className={cn(baseClassName, 'bg-[linear-gradient(135deg,var(--bb-accent-warning),#FFD96A)] text-[#08111D] shadow-[0_14px_30px_rgba(255,204,51,0.22)] hover:brightness-105', className)}
    {...props}
  />
);

export const SecondaryButton = ({ className, ...props }) => (
  <Button
    variant="outline"
    className={cn(baseClassName, 'border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white', className)}
    {...props}
  />
);

export const GhostButton = ({ className, ...props }) => (
  <Button
    variant="ghost"
    className={cn(baseClassName, 'text-[var(--bb-text-secondary)] hover:bg-white/8 hover:text-white', className)}
    {...props}
  />
);

export const DangerButton = ({ className, ...props }) => (
  <Button
    className={cn(baseClassName, 'bg-[linear-gradient(135deg,var(--bb-accent-danger),#FF7A86)] text-white shadow-[0_14px_30px_rgba(255,77,94,0.24)] hover:brightness-105', className)}
    {...props}
  />
);

export const IconButton = ({ className, ...props }) => (
  <Button
    size="icon"
    className={cn('h-12 w-12 rounded-full border border-white/12 bg-white/6 text-white hover:bg-white/10', className)}
    {...props}
  />
);

export const StickyActionButton = ({ className, children, ...props }) => (
  <div className={cn('bb-sticky-safe', className)} data-testid="sticky-action-button-wrap">
    <PrimaryButton className="min-h-[var(--bb-button-height-primary)] w-full text-base" data-testid="sticky-action-button" {...props}>
      {children}
    </PrimaryButton>
  </div>
);