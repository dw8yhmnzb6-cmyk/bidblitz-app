import { Home, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton, GhostButton } from './BidBlitzButtons';

export const BidBlitzPageShell = ({
  title,
  subtitle,
  children,
  onBack,
  onHome,
  headerActions,
  className,
  contentClassName,
  disableBottomNavClearance = false,
  testId = 'bidblitz-page-shell',
}) => (
  <section className={cn('bb-page-shell', className)} data-testid={testId} data-scroll-page="true">
    <div className="bb-page-shell__inner">
      <header className="bb-page-shell__header" data-testid={`${testId}-header`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack ? (
            <IconButton type="button" onClick={onBack} data-testid={`${testId}-back-button`} aria-label="Zurück">
              <ArrowLeft size={18} />
            </IconButton>
          ) : null}
          <div className="bb-page-shell__header-copy">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.95] text-white">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm md:text-lg text-[var(--bb-text-secondary)]">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerActions}
          {onHome ? (
            <GhostButton type="button" onClick={onHome} className="px-4" data-testid={`${testId}-home-button`}>
              <Home size={16} />
              <span>Zur Startseite</span>
            </GhostButton>
          ) : null}
        </div>
      </header>
      <div className={cn('bb-page-shell__content', disableBottomNavClearance && 'bb-page-shell__content--no-bottom-nav', contentClassName)}>
        {children}
      </div>
    </div>
  </section>
);