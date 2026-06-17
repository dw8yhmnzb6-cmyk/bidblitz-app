import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Repeat,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "invoices", label: "Rechnungen", icon: FileText },
  { id: "clients", label: "Mandanten", icon: Building2 },
  { id: "import", label: "Import", icon: Upload },
  { id: "audit", label: "Audit", icon: ClipboardList },
];

const PRIORITY_STYLE = {
  urgent: "bg-[#FF6B6B]/15 border-[#FF6B6B]/30 text-[#FFB4B4]",
  high: "bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#FFD38D]",
  normal: "bg-white/5 border-white/10 text-white/70",
};

const HEALTH_STYLE = {
  green: "bg-emerald-500/15 border-emerald-400/25 text-emerald-300",
  yellow: "bg-amber-500/15 border-amber-400/25 text-amber-200",
  red: "bg-rose-500/15 border-rose-400/25 text-rose-200",
};

const emptyForm = () => ({
  invoiceId: "",
  client: "",
  email: "",
  dueDays: 14,
  recurringEnabled: false,
  recurringFrequency: "monthly",
  nextInvoiceDate: "",
  notes: "",
  items: [{ desc: "", qty: 1, price: "" }],
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const DEMO_DATA = {
  dashboard: {
    summary: {
      clients_total: 3,
      urgent_tasks: 4,
      pending_tasks: 8,
      completed_tasks: 2,
      unpaid_invoices: 3,
      green_clients: 1,
      yellow_clients: 1,
      red_clients: 1,
    },
    tasks: [
      {
        task_id: "demo-missing-docs",
        task_type: "missing_documents",
        status: "pending",
        priority: "urgent",
        title: "Fehlende Dokumente",
        description: "3 Belege fehlen für Nova Trade LLC",
        company: "Nova Trade LLC",
        client_id: "demo-client-1",
        ref_id: "demo-client-1",
        due_at: new Date(Date.now() + 86400000).toISOString(),
        action: "complete_task",
        action_label: "Als erledigt markieren",
        can_complete: true,
      },
      {
        task_id: "demo-overdue-invoice",
        task_type: "unpaid_invoice",
        status: "pending",
        priority: "urgent",
        title: "Unbezahlte Rechnung",
        description: "INV-202605-DEMO · €178.50",
        company: "Luma Studio",
        invoice_id: "demo-invoice-1",
        ref_id: "demo-invoice-1",
        due_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        action: "send_reminder",
        action_label: "Reminder senden",
        can_complete: false,
        is_overdue: true,
      },
      {
        task_id: "demo-filing",
        task_type: "filing_due_soon",
        status: "pending",
        priority: "high",
        title: "Abgabe bald fällig",
        description: "TVSH-Abgabe für Arti Commerce steht an",
        company: "Arti Commerce",
        client_id: "demo-client-2",
        ref_id: "demo-client-2",
        due_at: new Date(Date.now() + 86400000 * 4).toISOString(),
        action: "complete_task",
        action_label: "Auf nächsten Termin schieben",
        can_complete: true,
      },
      {
        task_id: "demo-completed",
        task_type: "pending_review",
        status: "completed",
        priority: "normal",
        title: "Review abgeschlossen",
        description: "2 OCR-Belege geprüft",
        company: "Demo OCR",
        completed_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    clients: [
      {
        client_id: "demo-client-1",
        company_name: "Nova Trade LLC",
        owner_name: "Elira K.",
        email: "nova@demo.test",
        phone: "+383 44 100 200",
        nui: "811223344",
        vat_number: "TVSH-1001",
        locked: false,
        invoice_count: 2,
        open_invoice_count: 1,
        outstanding_total: 178.5,
        next_filing_due_at: new Date(Date.now() + 86400000).toISOString(),
        health: {
          score: { value: 38, status: "red", label: "Critical" },
          reasons: [
            { key: "missing_documents", label: "3 fehlende Belege" },
            { key: "overdue_invoices", label: "1 überfällige Rechnungen" },
          ],
          metrics: { missing_documents: 3, overdue_invoices: 1, pending_reviews: 0, unmatched_bank: 1, filing_due_soon: 1, inactive_uploads: 1, outstanding_total: 178.5 },
        },
      },
      {
        client_id: "demo-client-2",
        company_name: "Arti Commerce",
        owner_name: "Ardit M.",
        email: "arti@demo.test",
        phone: "+383 45 300 500",
        nui: "922334455",
        vat_number: "TVSH-2202",
        locked: false,
        invoice_count: 1,
        open_invoice_count: 1,
        outstanding_total: 89.0,
        next_filing_due_at: new Date(Date.now() + 86400000 * 4).toISOString(),
        health: {
          score: { value: 61, status: "yellow", label: "Warning" },
          reasons: [{ key: "filing_due", label: "Abgabe bald fällig" }],
          metrics: { missing_documents: 1, overdue_invoices: 0, pending_reviews: 0, unmatched_bank: 0, filing_due_soon: 1, inactive_uploads: 0, outstanding_total: 89.0 },
        },
      },
      {
        client_id: "demo-client-3",
        company_name: "Luma Studio",
        owner_name: "Luan R.",
        email: "luma@demo.test",
        phone: "+383 49 111 222",
        nui: "733221100",
        vat_number: "TVSH-3203",
        locked: false,
        invoice_count: 2,
        open_invoice_count: 1,
        outstanding_total: 62.4,
        next_filing_due_at: new Date(Date.now() + 86400000 * 18).toISOString(),
        health: {
          score: { value: 86, status: "green", label: "Healthy" },
          reasons: [],
          metrics: { missing_documents: 0, overdue_invoices: 0, pending_reviews: 0, unmatched_bank: 0, filing_due_soon: 0, inactive_uploads: 0, outstanding_total: 62.4 },
        },
      },
    ],
  },
  invoices: [
    {
      invoice_id: "demo-invoice-1",
      invoice_number: "INV-202605-DEMO",
      scan_code: "BBINV-DEMO01",
      client_name: "Luma Studio",
      client_email: "luma@demo.test",
      items: [{ description: "Monatsabschluss", quantity: 1, unit_price: 150, total: 150 }],
      subtotal: 150,
      tax: 28.5,
      total: 178.5,
      due_days: 14,
      due_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: "sent",
      is_overdue: true,
      pay_url: "/invoice/pay/BBINV-DEMO01",
      public_pay_url: `${window.location.origin}/invoice/pay/BBINV-DEMO01`,
      reminder_count: 2,
      last_reminder_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      recurring: { enabled: true, frequency: "monthly", next_invoice_date: new Date(Date.now() + 86400000 * 15).toISOString() },
      notes: "BidBlitz Pay aktiv",
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
    {
      invoice_id: "demo-invoice-2",
      invoice_number: "INV-202605-ARTI",
      scan_code: "BBINV-DEMO02",
      client_name: "Arti Commerce",
      client_email: "arti@demo.test",
      items: [{ description: "OCR Buchhaltung", quantity: 1, unit_price: 74.79, total: 74.79 }],
      subtotal: 74.79,
      tax: 14.21,
      total: 89,
      due_days: 10,
      due_at: new Date(Date.now() + 86400000 * 4).toISOString(),
      status: "sent",
      is_overdue: false,
      pay_url: "/invoice/pay/BBINV-DEMO02",
      public_pay_url: `${window.location.origin}/invoice/pay/BBINV-DEMO02`,
      reminder_count: 0,
      last_reminder_at: null,
      recurring: { enabled: false, frequency: null, next_invoice_date: null },
      notes: "WhatsApp-Link bereit",
      created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    },
    {
      invoice_id: "demo-invoice-3",
      invoice_number: "INV-202605-NOVA",
      scan_code: "BBINV-DEMO03",
      client_name: "Nova Trade LLC",
      client_email: "nova@demo.test",
      items: [{ description: "Jahresmeldung", quantity: 1, unit_price: 52.44, total: 52.44 }],
      subtotal: 52.44,
      tax: 9.96,
      total: 62.4,
      due_days: 7,
      due_at: new Date(Date.now() + 86400000 * 8).toISOString(),
      status: "paid",
      is_overdue: false,
      pay_url: "/invoice/pay/BBINV-DEMO03",
      public_pay_url: `${window.location.origin}/invoice/pay/BBINV-DEMO03`,
      reminder_count: 1,
      last_reminder_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      recurring: { enabled: true, frequency: "weekly", next_invoice_date: new Date(Date.now() + 86400000 * 7).toISOString() },
      notes: "Bezahlt via QR",
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
      paid_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
  auditLogs: [
    { timestamp: new Date(Date.now() - 3600000).toISOString(), user: "demo@bidblitz.com", company: "Nova Trade LLC", action: "invoice_reminder_sent", target: "INV-202605-DEMO", status: "sent" },
    { timestamp: new Date(Date.now() - 86400000).toISOString(), user: "demo@bidblitz.com", company: "Arti Commerce", action: "client_imported", target: "import-csv", status: "completed" },
    { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), user: "admin@bidblitz.com", company: "System", action: "document_approved", target: "demo-doc-21", status: "approved" },
  ],
};

const formatDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
};

const formatMoney = (value) => `€${Number(value || 0).toFixed(2)}`;

const toInputDate = (value) => (value ? String(value).slice(0, 10) : "");

const toIsoFromDateInput = (value) => (value ? new Date(`${value}T00:00:00`).toISOString() : null);

const buildPaymentLink = (invoice) => invoice?.public_pay_url || `${window.location.origin}${invoice?.pay_url || `/invoice/pay/${invoice?.scan_code}`}`;

async function api(path, { method = "GET", body, formData } = {}) {
  const options = { method, credentials: "include" };
  if (formData) {
    options.body = formData;
  } else if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  return data;
}

function SectionCard({ title, meta, actions, children, testId }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5 shadow-[0_20px_80px_rgba(0,0,0,0.22)]" data-testid={testId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {meta && <p className="mt-1 text-sm text-white/45">{meta}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, tone = "text-white", testId }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid={testId}>
      <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className={`mt-3 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function HealthBadge({ health, testId }) {
  const tone = HEALTH_STYLE[health?.score?.status || "green"];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${tone}`} data-testid={testId}>
      {health?.score?.status === "green" ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
      {health?.score?.label || "Healthy"} · {health?.score?.value ?? 0}
    </span>
  );
}

function InvoicingPage({ onBack }) {
  const fileRef = useRef(null);
  const [tab, setTab] = useState("dashboard");
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dashboard, setDashboard] = useState({ summary: {}, tasks: [], clients: [] });
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClientAuditLogs, setSelectedClientAuditLogs] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [taskFilter, setTaskFilter] = useState("pending");
  const [clientSearch, setClientSearch] = useState("");
  const [reminderHistoryMap, setReminderHistoryMap] = useState({});
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importStats, setImportStats] = useState(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const loadAll = async (keepClientId = "") => {
    setLoading(true);
    try {
      if (demoMode) {
        const demo = clone(DEMO_DATA);
        setDashboard(demo.dashboard);
        setInvoices(demo.invoices);
        setClients(demo.dashboard.clients);
        setAuditLogs(demo.auditLogs);
        const focusId = keepClientId || selectedClientId || demo.dashboard.clients[0]?.client_id;
        setSelectedClientId(focusId || "");
        setSelectedClient(demo.dashboard.clients.find((item) => item.client_id === focusId) || null);
        setSelectedClientAuditLogs(demo.auditLogs.filter((row) => (row.company || "").toLowerCase().includes((demo.dashboard.clients.find((item) => item.client_id === focusId)?.company_name || "").toLowerCase())));
        setLoading(false);
        return;
      }
      const [dashboardRes, invoicesRes, clientsRes, auditRes] = await Promise.all([
        api("/api/invoicing/dashboard"),
        api("/api/invoicing/my-invoices"),
        api("/api/invoicing/clients"),
        api("/api/invoicing/audit-log"),
      ]);
      setDashboard(dashboardRes || { summary: {}, tasks: [], clients: [] });
      setInvoices(invoicesRes?.invoices || []);
      setClients(clientsRes?.clients || []);
      setAuditLogs(auditRes?.logs || []);

      const focusId = keepClientId || selectedClientId;
      const availableClients = clientsRes?.clients || [];
      if (focusId && availableClients.some((item) => item.client_id === focusId)) {
        await loadClientDetail(focusId, false);
      } else {
        setSelectedClientId("");
        setSelectedClient(null);
        setSelectedClientAuditLogs([]);
      }
    } catch (error) {
      toast.error(error.message || "Daten konnten nicht geladen werden");
    }
    setLoading(false);
  };

  const loadClientDetail = async (clientId, useCurrentMode = demoMode) => {
    if (!clientId) return;
    setSelectedClientId(clientId);
    try {
      if (useCurrentMode) {
        const match = clients.find((item) => item.client_id === clientId) || DEMO_DATA.dashboard.clients.find((item) => item.client_id === clientId);
        setSelectedClient(match || null);
        setSelectedClientAuditLogs((auditLogs || DEMO_DATA.auditLogs).filter((row) => (row.company || "").toLowerCase().includes((match?.company_name || "").toLowerCase())));
        return;
      }
      const data = await api(`/api/invoicing/clients/${clientId}`);
      setSelectedClient(data?.client || null);
      if (Array.isArray(data?.audit_logs)) setSelectedClientAuditLogs(data.audit_logs);
    } catch (error) {
      toast.error(error.message || "Mandant konnte nicht geladen werden");
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) await loadAll();
    };
    run();
    return () => {
      active = false;
    };
  }, [demoMode]);

  const taskList = useMemo(() => {
    const tasks = dashboard?.tasks || [];
    if (taskFilter === "completed") return tasks.filter((task) => task.status === "completed");
    if (taskFilter === "urgent") return tasks.filter((task) => task.status !== "completed" && task.priority === "urgent");
    return tasks.filter((task) => task.status !== "completed");
  }, [dashboard, taskFilter]);

  const groupedTasks = useMemo(() => {
    if (taskFilter === "completed") return { completed: taskList };
    return {
      urgent: taskList.filter((task) => task.priority === "urgent"),
      high: taskList.filter((task) => task.priority === "high"),
      normal: taskList.filter((task) => !["urgent", "high"].includes(task.priority)),
    };
  }, [taskList, taskFilter]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => [client.company_name, client.owner_name, client.email, client.nui, client.vat_number].join(" ").toLowerCase().includes(q));
  }, [clientSearch, clients]);

  const resetForm = () => setForm(emptyForm());

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { desc: "", qty: 1, price: "" }] }));
  const removeItem = (index) => setForm((prev) => {
    const nextItems = prev.items.filter((_, itemIndex) => itemIndex !== index);
    return { ...prev, items: nextItems.length ? nextItems : [{ desc: "", qty: 1, price: "" }] };
  });
  const updateItem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const saveInvoice = async () => {
    const items = form.items
      .filter((item) => item.desc && item.price)
      .map((item) => ({ description: item.desc, quantity: Number(item.qty) || 1, unit_price: Number(item.price) || 0 }));
    if (!form.client.trim() || items.length === 0) {
      toast.error("Kunde und mindestens eine Position sind erforderlich");
      return;
    }
    const payload = {
      client_name: form.client.trim(),
      client_email: form.email.trim(),
      due_days: Number(form.dueDays) || 14,
      notes: form.notes,
      items,
      recurring_enabled: Boolean(form.recurringEnabled),
      recurring_frequency: form.recurringFrequency,
      next_invoice_date: form.recurringEnabled ? toIsoFromDateInput(form.nextInvoiceDate) : null,
    };
    setSaving(true);
    try {
      if (demoMode) {
        const invoiceId = form.invoiceId || `demo-${Date.now()}`;
        const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
        const invoice = {
          invoice_id: invoiceId,
          invoice_number: form.invoiceId ? invoices.find((item) => item.invoice_id === form.invoiceId)?.invoice_number : `INV-DEMO-${Date.now()}`,
          scan_code: `BBINV-${Date.now().toString().slice(-6)}`,
          client_name: payload.client_name,
          client_email: payload.client_email,
          items: items.map((item) => ({ ...item, total: Number(item.quantity) * Number(item.unit_price) })),
          subtotal,
          tax: subtotal * 0.19,
          total: subtotal * 1.19,
          due_days: payload.due_days,
          due_at: new Date(Date.now() + payload.due_days * 86400000).toISOString(),
          status: "sent",
          pay_url: `/invoice/pay/BBINV-${Date.now().toString().slice(-6)}`,
          public_pay_url: `${window.location.origin}/invoice/pay/BBINV-${Date.now().toString().slice(-6)}`,
          reminder_count: 0,
          recurring: {
            enabled: payload.recurring_enabled,
            frequency: payload.recurring_enabled ? payload.recurring_frequency : null,
            next_invoice_date: payload.recurring_enabled ? payload.next_invoice_date : null,
          },
          notes: payload.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setInvoices((prev) => (form.invoiceId ? prev.map((item) => (item.invoice_id === form.invoiceId ? { ...item, ...invoice } : item)) : [invoice, ...prev]));
        toast.success(form.invoiceId ? "Demo-Rechnung aktualisiert" : "Demo-Rechnung erstellt");
        resetForm();
        setTab("invoices");
        setSaving(false);
        return;
      }

      if (form.invoiceId) {
        await api(`/api/invoicing/${form.invoiceId}`, { method: "PATCH", body: payload });
        toast.success("Rechnung aktualisiert");
      } else {
        await api("/api/invoicing/create", { method: "POST", body: payload });
        toast.success("Rechnung erstellt");
      }
      resetForm();
      await loadAll(selectedClientId);
      setTab("invoices");
    } catch (error) {
      toast.error(error.message || "Rechnung konnte nicht gespeichert werden");
    }
    setSaving(false);
  };

  const startEdit = (invoice) => {
    setForm({
      invoiceId: invoice.invoice_id,
      client: invoice.client_name || "",
      email: invoice.client_email || "",
      dueDays: invoice.due_days || 14,
      recurringEnabled: Boolean(invoice.recurring?.enabled),
      recurringFrequency: invoice.recurring?.frequency || "monthly",
      nextInvoiceDate: toInputDate(invoice.recurring?.next_invoice_date),
      notes: invoice.notes || "",
      items: (invoice.items || []).map((item) => ({ desc: item.description, qty: item.quantity, price: item.unit_price })) || [{ desc: "", qty: 1, price: "" }],
    });
    setTab("invoices");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const markTaskDone = async (task) => {
    try {
      if (demoMode) {
        setDashboard((prev) => ({
          ...prev,
          tasks: prev.tasks.map((item) => (item.task_id === task.task_id ? { ...item, status: "completed", completed_at: new Date().toISOString() } : item)),
        }));
        toast.success("Demo-Task erledigt");
        return;
      }
      await api("/api/invoicing/tasks/complete", {
        method: "POST",
        body: {
          task_id: task.task_id,
          task_type: task.task_type,
          title: task.title,
          company: task.company,
          client_id: task.client_id || null,
          ref_id: task.ref_id || null,
        },
      });
      toast.success("Task erledigt");
      await loadAll(task.client_id || selectedClientId);
    } catch (error) {
      toast.error(error.message || "Task konnte nicht abgeschlossen werden");
    }
  };

  const sendReminder = async (invoice, kind = "payment") => {
    try {
      if (demoMode) {
        setInvoices((prev) => prev.map((item) => (item.invoice_id === invoice.invoice_id ? { ...item, reminder_count: (item.reminder_count || 0) + 1, last_reminder_at: new Date().toISOString() } : item)));
        setAuditLogs((prev) => [{ timestamp: new Date().toISOString(), user: "demo@bidblitz.com", company: invoice.client_name, action: "invoice_reminder_sent", target: invoice.invoice_number, status: kind }, ...prev]);
        toast.success(kind === "overdue" ? "Demo-Überfälligkeitsmail gesendet" : "Demo-Erinnerung gesendet");
        return;
      }
      const result = await api(`/api/invoicing/${invoice.invoice_id}/reminders/email`, { method: "POST", body: { kind } });
      setReminderHistoryMap((prev) => ({
        ...prev,
        [invoice.invoice_id]: [result.history, ...(prev[invoice.invoice_id] || [])],
      }));
      toast.success(kind === "overdue" ? "Überfälligkeits-Erinnerung gesendet" : "Zahlungserinnerung gesendet");
      await loadAll(selectedClientId);
    } catch (error) {
      toast.error(error.message || "Reminder konnte nicht gesendet werden");
    }
  };

  const loadReminderHistory = async (invoiceId) => {
    if (reminderHistoryMap[invoiceId]) {
      setReminderHistoryMap((prev) => ({ ...prev, [invoiceId]: null }));
      return;
    }
    try {
      if (demoMode) {
        const invoice = invoices.find((item) => item.invoice_id === invoiceId);
        setReminderHistoryMap((prev) => ({
          ...prev,
          [invoiceId]: invoice?.last_reminder_at
            ? [{ id: `demo-${invoiceId}`, sent_at: invoice.last_reminder_at, kind: invoice.is_overdue ? "overdue" : "payment", channel: "email", result: { reason: "sent" } }]
            : [],
        }));
        return;
      }
      const data = await api(`/api/invoicing/${invoiceId}/reminders`);
      setReminderHistoryMap((prev) => ({ ...prev, [invoiceId]: data.history || [] }));
    } catch (error) {
      toast.error(error.message || "Historie konnte nicht geladen werden");
    }
  };

  const copyPaymentLink = async (invoice) => {
    const link = buildPaymentLink(invoice);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        window.prompt("Link kopieren:", link);
      }
      toast.success("Zahlungslink kopiert");
    } catch {
      toast.error("Link konnte nicht kopiert werden");
    }
  };

  const ensurePaymentLink = async (invoice) => {
    if (demoMode) return invoice;
    const result = await api(`/api/invoicing/${invoice.invoice_id}/payment-link`, { method: "POST" });
    const paymentLink = result?.payment_link || {};
    const merged = {
      ...invoice,
      public_pay_url: paymentLink.public_url || invoice.public_pay_url,
      payment_link_token: paymentLink.token || invoice.payment_link_token,
      payment_link_url: paymentLink.public_url || invoice.payment_link_url,
      payment_pdf_url: paymentLink.pdf_url || invoice.payment_pdf_url,
    };
    setInvoices((prev) => prev.map((item) => (item.invoice_id === invoice.invoice_id ? { ...item, ...merged } : item)));
    return merged;
  };

  const openPublicPayPage = async (invoice) => {
    try {
      const enriched = await ensurePaymentLink(invoice);
      window.open(buildPaymentLink(enriched), "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error.message || "Payment Link konnte nicht erstellt werden");
    }
  };

  const openPaymentPdf = async (invoice) => {
    try {
      const enriched = await ensurePaymentLink(invoice);
      window.open(`${API}${enriched.payment_pdf_url || `/api/invoicing/${invoice.invoice_id}/payment-pdf`}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error.message || "PDF konnte nicht geöffnet werden");
    }
  };

  const shareByEmail = async (invoice) => {
    await sendReminder(invoice, "manual");
  };

  const shareWhatsApp = (invoice) => {
    const link = buildPaymentLink(invoice);
    const text = `Bitte bezahle ${invoice.invoice_number} hier: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const generateNextInvoice = async (invoice) => {
    try {
      if (demoMode) {
        toast.success("Demo-Folge-Rechnung erzeugt");
        return;
      }
      await api(`/api/invoicing/${invoice.invoice_id}/generate-next`, { method: "POST" });
      toast.success("Nächste Rechnung erzeugt");
      await loadAll(selectedClientId);
    } catch (error) {
      toast.error(error.message || "Folge-Rechnung konnte nicht erzeugt werden");
    }
  };

  const toggleClientLock = async (client) => {
    try {
      if (demoMode) {
        setClients((prev) => prev.map((item) => (item.client_id === client.client_id ? { ...item, locked: !item.locked } : item)));
        setSelectedClient((prev) => (prev?.client_id === client.client_id ? { ...prev, locked: !prev.locked } : prev));
        toast.success(client.locked ? "Demo-Mandant entsperrt" : "Demo-Mandant gesperrt");
        return;
      }
      await api(`/api/invoicing/clients/${client.client_id}/toggle-lock`, { method: "POST" });
      toast.success(client.locked ? "Mandant entsperrt" : "Mandant gesperrt");
      await loadAll(client.client_id);
    } catch (error) {
      toast.error(error.message || "Status konnte nicht geändert werden");
    }
  };

  const previewCsv = async (file) => {
    if (!file) return;
    setCsvBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api("/api/invoicing/clients/import-preview", { method: "POST", formData });
      setImportPreview(result.rows || []);
      setImportErrors(result.errors || []);
      setImportStats(null);
      toast.success(`${result.valid_count || 0} Zeilen bereit`);
    } catch (error) {
      toast.error(error.message || "CSV konnte nicht gelesen werden");
    }
    setCsvBusy(false);
  };

  const importClients = async () => {
    if (importPreview.length === 0) {
      toast.error("Bitte zuerst CSV prüfen");
      return;
    }
    setCsvBusy(true);
    try {
      const result = await api("/api/invoicing/clients/import", { method: "POST", body: { rows: importPreview } });
      setImportStats(result);
      toast.success(`${result.success_count || 0} Mandanten importiert`);
      await loadAll(selectedClientId);
    } catch (error) {
      toast.error(error.message || "Import fehlgeschlagen");
    }
    setCsvBusy(false);
  };

  const resetDemo = () => {
    setReminderHistoryMap({});
    setImportPreview([]);
    setImportErrors([]);
    setImportStats(null);
    toast.success("Demo-Daten zurückgesetzt");
    loadAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05070B]" data-testid="invoicing-page-loading">
        <Loader2 size={24} className="animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070B] text-white pb-24" data-testid="invoicing-page">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-cyan-500/12 blur-[120px]" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-orange-400/10 blur-[140px]" />
      </div>

      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#05070B]/90 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <button onClick={onBack} className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10" data-testid="invoicing-back-button">
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00C2FF] to-[#FF8E53] text-[#05070B]">
                    <FileText size={18} />
                  </span>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight">Accountant Productivity</h1>
                    <p className="text-sm text-white/50" data-testid="invoicing-page-subtitle">Task Center · Reminder · Health Score · Recurring · Import</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDemoMode((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${demoMode ? "border-amber-400/30 bg-amber-400/15 text-amber-100" : "border-white/10 bg-white/5 text-white/70"}`}
                data-testid="invoicing-demo-toggle"
              >
                <Sparkles size={14} /> {demoMode ? "Demo aktiv" : "Demo Mode"}
              </button>
              <button onClick={() => setTab("invoices")} className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/15 px-4 py-2 text-xs font-bold text-cyan-100" data-testid="invoicing-quick-new-tab-button">
                <Plus size={14} /> Neue / Edit Rechnung
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" data-testid="invoicing-main-tabs">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${active ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/60"}`}
                  data-testid={`invoicing-tab-${item.id}`}
                >
                  <Icon size={14} /> {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6 lg:px-8">
        {demoMode && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-amber-400/25 bg-gradient-to-r from-amber-400/15 to-orange-400/10 p-4 sm:p-5" data-testid="invoicing-demo-banner">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-100">
                  <Sparkles size={16} />
                  <p className="text-sm font-black uppercase tracking-[0.2em]">Demo Mode</p>
                </div>
                <p className="mt-2 text-sm text-amber-50/90" data-testid="invoicing-demo-notice">
                  Sichere Mock-Daten: Demo-Accountant, Demo-Mandanten, Demo-Rechnungen, OCR-Demo-Hinweise und Dashboard-Zahlen. Keine Production-Daten werden verändert.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75" data-testid="invoicing-demo-ocr-card">
                  OCR Demo · 12 Belege erkannt
                </div>
                <button onClick={resetDemo} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white" data-testid="invoicing-demo-reset-button">
                  Reset Demo-Daten
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "dashboard" && (
          <div className="space-y-6" data-testid="invoicing-dashboard-tab">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Urgent" value={dashboard.summary?.urgent_tasks || 0} tone="text-rose-200" testId="task-center-urgent-count" />
              <MetricCard label="Pending" value={dashboard.summary?.pending_tasks || 0} tone="text-white" testId="task-center-pending-count" />
              <MetricCard label="Completed" value={dashboard.summary?.completed_tasks || 0} tone="text-emerald-300" testId="task-center-completed-count" />
              <MetricCard label="Mandanten" value={dashboard.summary?.clients_total || 0} tone="text-cyan-200" testId="task-center-client-count" />
            </div>

            <SectionCard
              title="Task Center"
              meta="Urgent zuerst, gruppiert nach Priorität. Sichere Tasks kannst du direkt abschließen."
              testId="task-center-section"
              actions={
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "urgent", label: "Urgent" },
                    { id: "pending", label: "Pending" },
                    { id: "completed", label: "Completed" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setTaskFilter(filter.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-bold ${taskFilter === filter.id ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/60"}`}
                      data-testid={`task-center-filter-${filter.id}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              }
            >
              {taskList.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-5 py-12 text-center" data-testid="task-center-empty-state">
                  <p className="text-lg font-semibold text-white">Alles sauber</p>
                  <p className="mt-2 text-sm text-white/45">Für diesen Filter gibt es gerade keine Aufgaben.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(groupedTasks).map(([group, items]) => (
                    items?.length ? (
                      <div key={group} className="space-y-3" data-testid={`task-center-group-${group}`}>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                          <AlertTriangle size={14} /> {group === "completed" ? "Abgeschlossen" : group === "urgent" ? "Urgent" : group === "high" ? "High" : "Normal"}
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {items.map((task, index) => (
                            <motion.div
                              key={task.task_id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.04 }}
                              className="rounded-[24px] border border-white/10 bg-black/20 p-4"
                              data-testid={`task-card-${task.task_id}`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${PRIORITY_STYLE[task.priority || "normal"]}`}>{task.priority || "normal"}</span>
                                    {task.status === "completed" && <span className="rounded-full border border-emerald-400/25 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200">done</span>}
                                  </div>
                                  <h3 className="mt-3 text-lg font-semibold text-white">{task.title}</h3>
                                  <p className="mt-1 text-sm text-white/55">{task.description}</p>
                                </div>
                                <div className="text-right text-xs text-white/40" data-testid={`task-due-${task.task_id}`}>
                                  <p>{task.company || "—"}</p>
                                  <p>{task.completed_at ? `Fertig: ${formatDate(task.completed_at)}` : `Fällig: ${formatDate(task.due_at)}`}</p>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {task.status !== "completed" && task.can_complete && (
                                  <button onClick={() => markTaskDone(task)} className="rounded-full border border-emerald-400/20 bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-100" data-testid={`task-complete-${task.task_id}`}>
                                    {task.action_label || "Als erledigt markieren"}
                                  </button>
                                )}
                                {task.invoice_id && task.status !== "completed" && (
                                  <button
                                    onClick={() => {
                                      const invoice = invoices.find((item) => item.invoice_id === task.invoice_id);
                                      if (invoice) sendReminder(invoice, task.is_overdue ? "overdue" : "payment");
                                    }}
                                    className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-2 text-xs font-bold text-cyan-100"
                                    data-testid={`task-reminder-${task.task_id}`}
                                  >
                                    Reminder senden
                                  </button>
                                )}
                                {task.client_id && (
                                  <button onClick={() => { setTab("clients"); loadClientDetail(task.client_id); }} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/75" data-testid={`task-open-client-${task.task_id}`}>
                                    Mandant öffnen
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Client Health" meta="Score sichtbar im Dashboard und in der Mandantenliste." testId="dashboard-health-section">
              <div className="grid gap-3 lg:grid-cols-3">
                {(clients || []).slice(0, 6).map((client) => (
                  <button
                    key={client.client_id}
                    onClick={() => { setTab("clients"); loadClientDetail(client.client_id); }}
                    className="rounded-[24px] border border-white/10 bg-black/20 p-4 text-left transition-colors hover:bg-white/[0.04]"
                    data-testid={`dashboard-client-health-${client.client_id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{client.company_name}</p>
                        <p className="mt-1 text-xs text-white/45">{client.open_invoice_count} offen · {formatMoney(client.outstanding_total)}</p>
                      </div>
                      <HealthBadge health={client.health} testId={`dashboard-health-badge-${client.client_id}`} />
                    </div>
                    {client.health?.reasons?.length > 0 && <p className="mt-3 text-sm text-white/55">{client.health.reasons.map((reason) => reason.label).join(" · ")}</p>}
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "invoices" && (
          <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]" data-testid="invoicing-invoices-tab">
            <SectionCard title={form.invoiceId ? "Rechnung bearbeiten" : "Neue Rechnung / Recurring"} meta="Bestehende Struktur bleibt gleich — nur Reminder und Wiederholung ergänzt." testId="invoice-form-section">
              <div className="space-y-3">
                <input value={form.client} onChange={(event) => setForm((prev) => ({ ...prev, client: event.target.value }))} placeholder="Firmenname / Mandant *" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" data-testid="invoice-form-client-input" />
                <input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="E-Mail *" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" data-testid="invoice-form-email-input" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="number" value={form.dueDays} onChange={(event) => setForm((prev) => ({ ...prev, dueDays: event.target.value }))} placeholder="Fälligkeit in Tagen" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" data-testid="invoice-form-due-days-input" />
                  <select value={form.recurringFrequency} onChange={(event) => setForm((prev) => ({ ...prev, recurringFrequency: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" data-testid="invoice-form-recurring-frequency-select">
                    <option value="monthly">Monatlich</option>
                    <option value="weekly">Wöchentlich</option>
                  </select>
                </div>
                <button onClick={() => setForm((prev) => ({ ...prev, recurringEnabled: !prev.recurringEnabled }))} className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold ${form.recurringEnabled ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/65"}`} data-testid="invoice-form-recurring-toggle">
                  <Repeat size={16} className="mr-2 inline-block" /> Wiederkehrend {form.recurringEnabled ? "aktiv" : "inaktiv"}
                </button>
                {form.recurringEnabled && (
                  <input type="date" value={form.nextInvoiceDate} onChange={(event) => setForm((prev) => ({ ...prev, nextInvoiceDate: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none [color-scheme:dark]" data-testid="invoice-form-next-date-input" />
                )}
                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div key={`${index}-${form.invoiceId || "new"}`} className="rounded-[24px] border border-white/10 bg-black/20 p-3" data-testid={`invoice-form-item-${index}`}>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_110px_auto]">
                        <input value={item.desc} onChange={(event) => updateItem(index, "desc", event.target.value)} placeholder="Beschreibung" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm text-white outline-none" data-testid={`invoice-form-item-desc-${index}`} />
                        <input type="number" value={item.qty} onChange={(event) => updateItem(index, "qty", event.target.value)} placeholder="Menge" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm text-white outline-none" data-testid={`invoice-form-item-qty-${index}`} />
                        <input type="number" value={item.price} onChange={(event) => updateItem(index, "price", event.target.value)} placeholder="Preis" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm text-white outline-none" data-testid={`invoice-form-item-price-${index}`} />
                        <button onClick={() => removeItem(index)} className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60" data-testid={`invoice-form-item-remove-${index}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addItem} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70" data-testid="invoice-form-add-item-button">
                  <Plus size={16} className="mr-2 inline-block" /> Position hinzufügen
                </button>
                <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Interne Notiz / Payment-Hinweis" rows={4} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" data-testid="invoice-form-notes-input" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button onClick={saveInvoice} disabled={saving} className="rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#FF8E53] px-4 py-3 text-sm font-black text-[#05070B] disabled:opacity-50" data-testid="invoice-form-save-button">
                    {saving ? <Loader2 size={16} className="mx-auto animate-spin" /> : form.invoiceId ? "Änderungen speichern" : "Rechnung erstellen"}
                  </button>
                  <button onClick={resetForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70" data-testid="invoice-form-reset-button">
                    Zurücksetzen
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Reminder & BidBlitz Pay" meta="E-Mail, WhatsApp, Copy Link, QR-Code, PDF und öffentliche Payment-Seite." testId="invoice-list-section">
              <div className="space-y-4">
                {invoices.length === 0 && (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-5 py-14 text-center" data-testid="invoice-list-empty-state">
                    <p className="text-lg font-semibold text-white">Noch keine Rechnungen</p>
                    <p className="mt-2 text-sm text-white/45">Erstelle rechts deine erste Rechnung oder aktiviere Demo Mode.</p>
                  </div>
                )}

                {invoices.map((invoice, index) => (
                  <motion.div key={invoice.invoice_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="rounded-[26px] border border-white/10 bg-black/20 p-4" data-testid={`invoice-card-${invoice.invoice_id}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black tracking-wide text-white" data-testid={`invoice-number-${invoice.invoice_id}`}>{invoice.invoice_number}</p>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${invoice.status === "paid" ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-200" : invoice.is_overdue ? "border-rose-400/25 bg-rose-400/15 text-rose-200" : "border-amber-400/25 bg-amber-400/15 text-amber-100"}`} data-testid={`invoice-status-${invoice.invoice_id}`}>
                            {invoice.status === "paid" ? "Bezahlt" : invoice.is_overdue ? "Überfällig" : "Offen"}
                          </span>
                          {invoice.recurring?.enabled && <span className="rounded-full border border-cyan-400/25 bg-cyan-400/15 px-2.5 py-1 text-[11px] font-bold text-cyan-100" data-testid={`invoice-recurring-badge-${invoice.invoice_id}`}>Recurring · {invoice.recurring.frequency}</span>}
                        </div>
                        <p className="mt-2 text-lg font-semibold text-white">{invoice.client_name}</p>
                        <p className="text-sm text-white/45">{invoice.client_email || "Keine E-Mail"}</p>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-2xl font-black text-[#FFCF8B]" data-testid={`invoice-total-${invoice.invoice_id}`}>{formatMoney(invoice.total)}</p>
                        <p className="mt-1 text-xs text-white/45">Fällig {formatDate(invoice.due_at)}</p>
                        {invoice.recurring?.enabled && invoice.recurring?.next_invoice_date && <p className="text-xs text-cyan-100/80">Nächste Rechnung: {formatDate(invoice.recurring.next_invoice_date)}</p>}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="rounded-[22px] border border-white/10 bg-[#0A0A0F] p-3" data-testid={`invoice-items-${invoice.invoice_id}`}>
                        {(invoice.items || []).map((item, itemIndex) => (
                          <div key={`${invoice.invoice_id}-${itemIndex}`} className="flex items-center justify-between gap-4 border-b border-white/5 py-2 last:border-b-0">
                            <div>
                              <p className="text-sm text-white">{item.description}</p>
                              <p className="text-xs text-white/40">{item.quantity} × {formatMoney(item.unit_price)}</p>
                            </div>
                            <p className="text-sm font-semibold text-white/85">{formatMoney(item.total)}</p>
                          </div>
                        ))}
                        {invoice.notes && <p className="mt-3 text-xs text-white/45">{invoice.notes}</p>}
                      </div>

                      <div className="rounded-[22px] border border-white/10 bg-[#0A0A0F] p-3" data-testid={`invoice-reminder-panel-${invoice.invoice_id}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/35">Reminder History</p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/70" data-testid={`invoice-reminder-count-${invoice.invoice_id}`}>{invoice.reminder_count || 0}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/60">Letzter Versand: {invoice.last_reminder_at ? formatDateTime(invoice.last_reminder_at) : "Noch keiner"}</p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button onClick={() => sendReminder(invoice, invoice.is_overdue ? "overdue" : "payment")} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/15 px-3 py-2 text-xs font-bold text-cyan-100" data-testid={`invoice-email-reminder-${invoice.invoice_id}`}>
                            <BellRing size={14} className="mr-2 inline-block" /> E-Mail Reminder
                          </button>
                          <button onClick={() => shareWhatsApp(invoice)} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-100" data-testid={`invoice-whatsapp-share-${invoice.invoice_id}`}>
                            <MessageCircle size={14} className="mr-2 inline-block" /> WhatsApp
                          </button>
                          <button onClick={() => copyPaymentLink(invoice)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/75" data-testid={`invoice-copy-link-${invoice.invoice_id}`}>
                            <Copy size={14} className="mr-2 inline-block" /> Copy Link
                          </button>
                          <button onClick={() => openPublicPayPage(invoice)} className="rounded-2xl border border-orange-400/20 bg-orange-400/15 px-3 py-2 text-xs font-bold text-orange-100" data-testid={`invoice-bidblitz-pay-${invoice.invoice_id}`}>
                            <Send size={14} className="mr-2 inline-block" /> BidBlitz Pay
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-black/20 p-3" data-testid={`invoice-payment-link-box-${invoice.invoice_id}`}>
                          <div className="rounded-2xl bg-white p-2">
                            <QRCodeSVG value={buildPaymentLink(invoice)} size={72} includeMargin data-testid={`invoice-payment-qr-${invoice.invoice_id}`} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-white/80">Smart Payment Link</p>
                            <p className="mt-1 break-all text-[10px] text-white/40">{buildPaymentLink(invoice)}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button onClick={() => shareByEmail(invoice)} className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-2 text-[11px] font-bold text-cyan-100" data-testid={`invoice-send-link-email-${invoice.invoice_id}`}>
                                <Mail size={13} className="mr-1 inline-block" /> Send Link
                              </button>
                              <button onClick={() => openPaymentPdf(invoice)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-white/75" data-testid={`invoice-open-pdf-${invoice.invoice_id}`}>
                                <ExternalLink size={13} className="mr-1 inline-block" /> PDF / QR
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => startEdit(invoice)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70" data-testid={`invoice-edit-${invoice.invoice_id}`}>
                            Bearbeiten
                          </button>
                          {invoice.recurring?.enabled && (
                            <button onClick={() => generateNextInvoice(invoice)} className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-2 text-xs font-bold text-cyan-100" data-testid={`invoice-generate-next-${invoice.invoice_id}`}>
                              <Repeat size={14} className="mr-2 inline-block" /> Generate Next
                            </button>
                          )}
                          <button onClick={() => loadReminderHistory(invoice.invoice_id)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70" data-testid={`invoice-history-toggle-${invoice.invoice_id}`}>
                            Historie
                          </button>
                        </div>
                        {Array.isArray(reminderHistoryMap[invoice.invoice_id]) && (
                          <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3" data-testid={`invoice-history-list-${invoice.invoice_id}`}>
                            {reminderHistoryMap[invoice.invoice_id].length === 0 && <p className="text-xs text-white/45">Noch keine Reminder-Historie.</p>}
                            {reminderHistoryMap[invoice.invoice_id].map((row) => (
                              <div key={row.id || `${invoice.invoice_id}-${row.sent_at}`} className="flex items-center justify-between gap-3 text-xs text-white/70">
                                <span>{row.kind === "overdue" ? "Überfällig" : "Reminder"} · {row.channel || "email"}</span>
                                <span>{formatDateTime(row.sent_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "clients" && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.85fr)]" data-testid="invoicing-clients-tab">
            <SectionCard
              title="Mandantenliste"
              meta="Health Badge sichtbar in Liste und Detail."
              testId="client-list-section"
              actions={
                <div className="relative min-w-[220px]">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                  <input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Mandant suchen" className="w-full rounded-full border border-white/10 bg-black/20 py-2 pl-10 pr-4 text-sm text-white outline-none" data-testid="client-search-input" />
                </div>
              }
            >
              <div className="space-y-3">
                {filteredClients.map((client) => (
                  <button key={client.client_id} onClick={() => loadClientDetail(client.client_id)} className={`w-full rounded-[24px] border p-4 text-left transition-colors ${selectedClientId === client.client_id ? "border-cyan-400/30 bg-cyan-400/10" : "border-white/10 bg-black/20 hover:bg-white/[0.04]"}`} data-testid={`client-card-${client.client_id}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-white">{client.company_name}</p>
                        <p className="mt-1 text-sm text-white/45">{client.owner_name} · {client.email}</p>
                        <p className="mt-2 text-xs text-white/40">{client.open_invoice_count} offen · {formatMoney(client.outstanding_total)}</p>
                      </div>
                      <HealthBadge health={client.health} testId={`client-health-badge-${client.client_id}`} />
                    </div>
                    {client.health?.reasons?.length > 0 && <p className="mt-3 text-sm text-white/55">{client.health.reasons.map((reason) => reason.label).join(" · ")}</p>}
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Mandanten-Detail" meta="Health Score, Gründe, offene Rechnungen und Audit-View." testId="client-detail-section">
              {!selectedClient ? (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-5 py-14 text-center" data-testid="client-detail-empty-state">
                  <p className="text-lg font-semibold text-white">Mandant auswählen</p>
                  <p className="mt-2 text-sm text-white/45">Wähle links einen Mandanten aus, um Score, Gründe und Audit zu sehen.</p>
                </div>
              ) : (
                <div className="space-y-4" data-testid="client-detail-card">
                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xl font-black text-white">{selectedClient.company_name}</p>
                        <p className="mt-1 text-sm text-white/45">{selectedClient.owner_name} · {selectedClient.email}</p>
                        <p className="mt-2 text-xs text-white/40">NUI {selectedClient.nui || "—"} · TVSH {selectedClient.vat_number || "—"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <HealthBadge health={selectedClient.health} testId="client-detail-health-badge" />
                        <button onClick={() => toggleClientLock(selectedClient)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/75" data-testid="client-detail-lock-toggle">
                          {selectedClient.locked ? <Unlock size={14} className="mr-2 inline-block" /> : <Lock size={14} className="mr-2 inline-block" />}
                          {selectedClient.locked ? "Entsperren" : "Sperren"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard label="Offene Rechnungen" value={selectedClient.open_invoice_count || selectedClient.invoice_count || 0} testId="client-detail-open-invoices" />
                    <MetricCard label="Outstanding" value={formatMoney(selectedClient.outstanding_total || selectedClient.health?.metrics?.outstanding_total)} tone="text-[#FFCF8B]" testId="client-detail-outstanding" />
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid="client-detail-reasons-card">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">Health Gründe</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(selectedClient.health?.reasons || []).length === 0 && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-100">Alles stabil</span>}
                      {(selectedClient.health?.reasons || []).map((reason) => (
                        <span key={reason.key} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/75">{reason.label}</span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid="client-detail-audit-card">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">Audit Log</p>
                      <span className="text-xs text-white/35">Date · User · Company · Action · Target · Status</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(selectedClientAuditLogs || []).slice(0, 6).map((log, index) => (
                        <div key={`${log.timestamp}-${index}`} className="grid gap-2 rounded-2xl border border-white/10 bg-[#0A0A0F] p-3 text-xs text-white/70 md:grid-cols-5" data-testid={`client-audit-row-${index}`}>
                          <span>{formatDateTime(log.timestamp)}</span>
                          <span>{log.user}</span>
                          <span>{log.company}</span>
                          <span>{log.action}</span>
                          <span>{log.target} · {log.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {tab === "import" && (
          <SectionCard title="CSV Client Import" meta="Upload, Preview, Validierung und Import ohne neue Infrastruktur." testId="client-import-section">
            <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-3">
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(event) => previewCsv(event.target.files?.[0])} className="hidden" data-testid="client-import-file-input" />
                <button onClick={() => fileRef.current?.click()} disabled={csvBusy} className="w-full rounded-[24px] border border-cyan-400/20 bg-cyan-400/15 px-4 py-4 text-sm font-black text-cyan-100 disabled:opacity-50" data-testid="client-import-upload-button">
                  {csvBusy ? <Loader2 size={16} className="mx-auto animate-spin" /> : <><Upload size={16} className="mr-2 inline-block" /> CSV hochladen</>}
                </button>
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm text-white/70" data-testid="client-import-required-fields">
                  <p className="font-semibold text-white">Pflichtfelder</p>
                  <p className="mt-2">company_name · owner_name · email</p>
                  <p className="mt-2 text-white/45">Optional: phone · NUI · VAT/TVSH number</p>
                </div>
                {importStats && <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/15 p-4 text-sm text-emerald-100" data-testid="client-import-stats">Erfolg {importStats.success_count || 0} · Fehler {importStats.fail_count || 0}</div>}
                <button onClick={importClients} disabled={csvBusy || importPreview.length === 0} className="w-full rounded-[24px] border border-emerald-400/20 bg-emerald-400/15 px-4 py-4 text-sm font-black text-emerald-100 disabled:opacity-50" data-testid="client-import-confirm-button">
                  Mandanten importieren
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid="client-import-preview-card">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35">Preview</p>
                  {importPreview.length === 0 ? (
                    <p className="mt-4 text-sm text-white/45">Noch keine CSV geladen.</p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {importPreview.slice(0, 8).map((row, index) => (
                        <div key={`${row.email}-${index}`} className="grid gap-2 rounded-2xl border border-white/10 bg-[#0A0A0F] p-3 text-sm text-white/75 md:grid-cols-3" data-testid={`client-import-preview-row-${index}`}>
                          <span>{row.company_name}</span>
                          <span>{row.owner_name}</span>
                          <span>{row.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4" data-testid="client-import-errors-card">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35">Validierung</p>
                  {importErrors.length === 0 ? (
                    <p className="mt-4 text-sm text-emerald-100">Keine Fehler gefunden.</p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {importErrors.map((error, index) => (
                        <div key={`${error.row}-${index}`} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100" data-testid={`client-import-error-${index}`}>
                          Zeile {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {tab === "audit" && (
          <SectionCard title="Audit Log View" meta="Lightweight Verlauf für Admin-/Accountant-relevante Aktionen." testId="audit-log-section">
            <div className="space-y-3">
              {(auditLogs || []).length === 0 && <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-5 py-14 text-center text-sm text-white/45" data-testid="audit-log-empty-state">Noch keine Audit-Einträge vorhanden.</div>}
              {(auditLogs || []).map((log, index) => (
                <div key={`${log.timestamp}-${index}`} className="grid gap-3 rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm text-white/70 md:grid-cols-5" data-testid={`audit-log-row-${index}`}>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">Date</p>
                    <p className="mt-2">{formatDateTime(log.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">User</p>
                    <p className="mt-2">{log.user}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">Company</p>
                    <p className="mt-2">{log.company}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">Action</p>
                    <p className="mt-2">{log.action}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">Target / Status</p>
                    <p className="mt-2">{log.target} · {log.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

export default InvoicingPage;
