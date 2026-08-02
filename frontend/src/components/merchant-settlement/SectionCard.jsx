export const SectionCard = ({ title, subtitle = "", actions, children, testId }) => (
  <section className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid={testId}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-white/60">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);