import { useEffect } from 'react';
import { CheckCircle2, Shield, Sparkles } from 'lucide-react';
import { BidBlitzPageShell } from '../components/design/BidBlitzPageShell';
import { PrimaryButton, SecondaryButton, GhostButton, DangerButton, StickyActionButton } from '../components/design/BidBlitzButtons';
import { StandardCard, PremiumCard, StatCard, WarningCard } from '../components/design/BidBlitzCards';
import { MoneyAmount } from '../components/design/MoneyAmount';
import { CountdownTimer } from '../components/design/CountdownTimer';
import { ProductImageGallery } from '../components/design/ProductImageGallery';
import { bidblitzTokens } from '../design/tokens';

const galleryImages = [
  'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80',
];

export default function DesignSystemPage({ onBack, onNavigate }) {
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]');
    const meta = existing || document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex, nofollow');
    if (!existing) document.head.appendChild(meta);
    return () => {
      if (!existing) meta.remove();
    };
  }, []);

  return (
    <BidBlitzPageShell
      title="BidBlitz Design System"
      subtitle="Zentrale Tokens, sichere Mobile-Standards und QA-relevante Referenzzustände."
      onBack={onBack}
      onHome={() => onNavigate?.('/')}
      disableBottomNavClearance
      testId="design-system-page"
    >
      <div className="bb-grid-auto" data-testid="design-system-content">
        <PremiumCard data-testid="design-system-token-overview">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[var(--bb-accent-cyan)]">Core Tokens</p>
              <h2 className="mt-2 text-2xl font-black text-white">Farben, Safe Areas und Buttonhöhen sind jetzt zentralisiert.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries({
                Hintergrund: bidblitzTokens.colors.background,
                Karte: bidblitzTokens.colors.backgroundElevated,
                Cyan: bidblitzTokens.colors.cyan,
                Warnung: bidblitzTokens.colors.warning,
              }).map(([label, color]) => (
                <div key={label} className="bb-token-chip min-w-[140px]" data-testid={`design-token-${label.toLowerCase()}`}>
                  <div className="h-12 rounded-2xl border border-white/10" style={{ background: color }} />
                  <div className="mt-3 text-sm font-bold text-white">{label}</div>
                  <div className="mt-1 text-xs text-[var(--bb-text-secondary)]">{color}</div>
                </div>
              ))}
            </div>
          </div>
        </PremiumCard>

        <div className="grid gap-3 lg:grid-cols-2">
          <StandardCard data-testid="design-system-typography-card">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--bb-accent-cyan)]">Typografie</p>
            <h2 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black text-white">Groß, klar, mobile-first.</h2>
            <p className="mt-3 text-sm md:text-lg text-[var(--bb-text-secondary)]">Lesbare Mindestgröße 14px, große Headlines, ruhige Sekundärtexte und großzügige Zwischenräume.</p>
          </StandardCard>
          <WarningCard data-testid="design-system-safe-area-card">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--bb-accent-warning)]">Safe Areas</p>
            <div className="mt-4 space-y-2 text-sm text-[var(--bb-text-secondary)]">
              <div>Bottom Nav Clearance: <span className="font-black text-white">calc(bottom-nav + safe-area + 24px)</span></div>
              <div>Button Minimum: <span className="font-black text-white">48px</span></div>
              <div>Primary CTA: <span className="font-black text-white">56px</span></div>
            </div>
          </WarningCard>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <StandardCard data-testid="design-system-money-card">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--bb-accent-cyan)]">MoneyAmount</p>
            <div className="mt-4 flex flex-wrap gap-4 text-2xl font-black">
              <MoneyAmount value={53.72} className="text-3xl" testId="money-amount-de" />
              <MoneyAmount value={1999} className="text-3xl" testId="money-amount-large" />
              <MoneyAmount value={63373479.91} compact locale="de" className="text-3xl" testId="money-amount-compact" />
              <MoneyAmount value={53.72} locale="en" className="text-3xl" testId="money-amount-en" />
            </div>
          </StandardCard>
          <StandardCard data-testid="design-system-countdown-card">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--bb-accent-cyan)]">CountdownTimer</p>
            <div className="mt-4 space-y-3">
              <CountdownTimer seconds={39877} className="text-xl font-black text-white" testId="countdown-expanded" />
              <CountdownTimer seconds={397} className="text-xl font-black text-[var(--bb-accent-warning)]" testId="countdown-compact-preview" />
            </div>
          </StandardCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <StandardCard data-testid="design-system-buttons-card">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--bb-accent-cyan)]">Buttons</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <PrimaryButton data-testid="design-system-primary-button">Primäraktion</PrimaryButton>
              <SecondaryButton data-testid="design-system-secondary-button">Sekundär</SecondaryButton>
              <GhostButton data-testid="design-system-ghost-button">Zurück</GhostButton>
              <DangerButton data-testid="design-system-danger-button">Löschen</DangerButton>
            </div>
          </StandardCard>
          <StandardCard data-testid="design-system-cards-card">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--bb-accent-cyan)]">Cards</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard data-testid="design-system-stat-card">
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--bb-text-muted)]">Wallet</span>
                <MoneyAmount value={445.11} className="text-2xl font-black" testId="design-system-wallet-amount" />
              </StatCard>
              <StatCard data-testid="design-system-status-card">
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--bb-text-muted)]">Status</span>
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--bb-accent-success)]"><CheckCircle2 size={16} /> Visual QA bereit</div>
              </StatCard>
            </div>
          </StandardCard>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <StandardCard data-testid="design-system-gallery-card">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--bb-accent-cyan)]">ProductImageGallery</p>
            <div className="mt-4">
              <ProductImageGallery
                title="BidBlitz Premium Sneaker"
                images={galleryImages}
                productCategory="fashion"
                productSubcategory="sneaker"
                imageCategory="product"
                imageSource="verified-gallery"
                imageVerified
                testId="design-system-gallery"
              />
            </div>
          </StandardCard>
          <PremiumCard data-testid="design-system-rules-card">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--bb-accent-cyan)]">Visual-QA Regeln</p>
            <div className="mt-4 space-y-3 text-sm text-[var(--bb-text-secondary)]">
              <div className="flex items-start gap-3"><Shield size={18} className="mt-0.5 text-[var(--bb-accent-success)]" /><span>Bottom Nav darf keine primären Aktionen verdecken.</span></div>
              <div className="flex items-start gap-3"><Sparkles size={18} className="mt-0.5 text-[var(--bb-accent-cyan)]" /><span>Preise, Countdown und Bilder folgen den zentralen Token- und Metadata-Regeln.</span></div>
              <div className="flex items-start gap-3"><CheckCircle2 size={18} className="mt-0.5 text-[var(--bb-accent-warning)]" /><span>Nur Layout-, Spacing- und Übersetzungsfixes dürfen automatisch vorbereitet werden.</span></div>
            </div>
          </PremiumCard>
        </div>

        <StickyActionButton type="button" onClick={() => onNavigate?.('/auctions')}>
          Design-System live in Auktionen ansehen
        </StickyActionButton>
      </div>
    </BidBlitzPageShell>
  );
}