import { projectCustomerControls } from './projectCustomerControls';

export default function AdminProjectCustomerControls({ project, onNavigate, onOpen, onConnections, opening }) {
  const tools = projectCustomerControls(project);
  return <section className="project-customer-tools" aria-label={`${project.name}: Kundenverwaltung`}>
    <h3>Kundenverwaltung</h3>
    {tools.actions.length > 0 && <p className="customer-tool-list">{tools.actions.join(' · ')}</p>}
    <p className="customer-tool-note">{tools.note}</p>
    {tools.available ? <div className="customer-tool-buttons">
      {tools.native ? <>
        <button type="button" onClick={() => onNavigate(tools.customerPath)}>Kunden · Sperren / Entsperren</button>
        <button type="button" onClick={() => onNavigate(tools.creditPath)}>Gutschriften & Buchungen</button>
      </> : <button type="button" disabled={Boolean(opening)} onClick={() => onOpen(project)}>{opening === project.id ? 'Wird angemeldet…' : `${tools.label} im Projekt öffnen`}</button>}
    </div> : <button type="button" className="customer-connection-button" onClick={onConnections}>Anbindung prüfen</button>}
  </section>;
}
