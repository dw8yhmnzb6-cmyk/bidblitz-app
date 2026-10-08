import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  Bell,
  Bot,
  Camera,
  ChevronDown,
  CircleDot,
  CloudSun,
  Cpu,
  Flame,
  Gauge,
  Globe2,
  HardDrive,
  Layers3,
  MapPin,
  Plane,
  Radio,
  RefreshCw,
  Satellite,
  Search,
  Send,
  Ship,
  Siren,
  Wifi,
  Zap,
} from "lucide-react";
import "./TheEyePage.css";

const LAYERS = [
  ["Kameras", Camera, null, "cyan"],
  ["Flugzeuge", Plane, null, "blue"],
  ["Schiffe", Ship, null, "amber"],
  ["Satelliten", Satellite, null, "violet"],
  ["Wetter", CloudSun, null, "sky"],
  ["Feuer", Flame, null, "red"],
  ["Erdbeben", Activity, null, "orange"],
  ["Kraftwerke", Zap, null, "yellow"],
  ["BidBlitz Geräte", Cpu, null, "green"],
];

const ICONS = {
  camera: Camera,
  power_station: Zap,
  scooter: Gauge,
  charger: Zap,
  taxi: MapPin,
  vehicle: MapPin,
  drone: Plane,
  aion_core: Bot,
  aion_tablet: Bot,
  sensor: Radio,
};

function StatusDot({ status }) {
  const normalized = ["online", "warning", "offline"].includes(status) ? status : "unknown";
  const label = normalized === "online"
    ? "Online"
    : normalized === "warning"
      ? "Warnung"
      : normalized === "offline"
        ? "Offline"
        : "Unknown";
  return <span className={`eye-status eye-status--${normalized}`}><span />{label}</span>;
}

function MetricCard({ icon: Icon, value, label, tone }) {
  return (
    <div className={`eye-metric eye-tone-${tone}`}>
      <Icon size={20} />
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  );
}

export default function TheEyePage({ onNavigate }) {
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [worldMapMode, setWorldMapMode] = useState(false);
  const [worldZoom, setWorldZoom] = useState(2);
  const [loading, setLoading] = useState(true);
  const [deviceDataState, setDeviceDataState] = useState("loading");
  const [query, setQuery] = useState("");
  const [activeLayers, setActiveLayers] = useState(() => Object.fromEntries(LAYERS.map(([name]) => [name, true])));
  const [tab, setTab] = useState("Übersicht");
  const [liveConnected, setLiveConnected] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [locationSummary, setLocationSummary] = useState(null);
  const [locationDetail, setLocationDetail] = useState(null);
  const [scopedDevices, setScopedDevices] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [streamSession, setStreamSession] = useState(null);
  const [streamMessage, setStreamMessage] = useState("");
  const [siteHealth, setSiteHealth] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [incidentSummary, setIncidentSummary] = useState({ open_total: 0, by_severity: {} });
  const [correlating, setCorrelating] = useState(false);
  const [actions, setActions] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [actionSummary, setActionSummary] = useState({
    open_actions: 0,
    open_tickets: 0,
    actions_by_priority: {},
    tickets_by_priority: {},
  });
  const [maintenanceSummary, setMaintenanceSummary] = useState({
    open_work_orders: 0,
    waiting_parts: 0,
    active_rma: 0,
    low_stock_items: 0,
    inventory_items: 0,
  });
  const [workOrders, setWorkOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [dataQuality, setDataQuality] = useState({
    overall_trust: null,
    trust_state: "unknown",
    sources_total: 0,
    live_sources: 0,
    delayed_sources: 0,
    offline_sources: 0,
    open_issues: 0,
    conflicts: 0,
    schema_errors: 0,
    sources: [],
    issues: [],
  });
  const [providerOverview, setProviderOverview] = useState({
    providers_total: 0,
    healthy: 0,
    degraded: 0,
    down_or_partial: 0,
    high_risk: 0,
    without_fallback: 0,
    monthly_cost: 0,
    providers: [],
  });
  const [projectOverview, setProjectOverview] = useState({
    projects_total: 0,
    healthy: 0,
    warning_or_worse: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    active_users: 0,
    critical_alerts: 0,
    open_incidents: 0,
    projects: [],
  });
  const [securityOverview, setSecurityOverview] = useState({
    open_security_events: 0,
    critical: 0,
    high: 0,
    auth_events: 0,
    device_events: 0,
    api_events: 0,
    pending_approvals: 0,
    events: [],
    approvals: [],
  });
  const [readiness, setReadiness] = useState({
    code_ready: false,
    staging_ready: false,
    production_ready: false,
    staging_blockers: [],
    warnings: [],
    runtime_config: {},
  });
  const [continuityOverview, setContinuityOverview] = useState({
    continuity_score: null,
    status: "unknown",
    emergency_mode: { mode: "unknown" },
    backup_services: 0,
    backup_failed: 0,
    backup_warning: 0,
    restore_untested: 0,
    failover_records: 0,
    failover_failed: 0,
    without_secondary: 0,
    drills_total: 0,
    drill_failed: 0,
    backups: [],
    failovers: [],
    drills: [],
  });
  const [aionInput, setAionInput] = useState("");
  const [aionBusy, setAionBusy] = useState(false);
  const [aionAnswer, setAionAnswer] = useState(null);
  const [aionSessionId, setAionSessionId] = useState(null);
  const [executiveOverview, setExecutiveOverview] = useState({
    snapshot: {
      projects_total: 0,
      projects_healthy: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      active_users: 0,
      open_incidents: 0,
      critical_incidents: 0,
      security_open: 0,
      security_critical: 0,
      pending_approvals: 0,
      provider_monthly_cost: 0,
      data_trust_score: null,
      priorities: [],
    },
    recent_briefs: [],
  });

  useEffect(() => {
    let cancelled = false;
    const loadReadiness = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/readiness", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setReadiness(data);
      } catch {
        // Readiness remains conservative if the diagnostic endpoint is unavailable.
      }
    };
    loadReadiness();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadContinuity = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/continuity/overview", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setContinuityOverview(data);
      } catch {
        // Continuity starts healthy until reports are registered.
      }
    };
    loadContinuity();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadExecutive = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/executive/overview", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setExecutiveOverview(data);
      } catch {
        // Executive Intelligence starts with the local empty summary.
      }
    };
    loadExecutive();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSecurity = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/security/overview", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setSecurityOverview(data);
      } catch {
        // Security Intelligence remains empty until events or approvals exist.
      }
    };
    loadSecurity();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadProjects = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/project-intelligence/overview", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setProjectOverview(data);
      } catch {
        // Project Intelligence remains empty until project connectors start sending snapshots.
      }
    };
    loadProjects();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadProviders = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/providers/overview", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setProviderOverview(data);
      } catch {
        // Provider intelligence can start empty until integrations are registered.
      }
    };
    loadProviders();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDataQuality = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/data-quality/overview", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setDataQuality(data);
      } catch {
        // Keep default trust summary when the quality service has no data yet.
      }
    };
    loadDataQuality();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadMaintenance = async () => {
      try {
        const [summaryRes, workOrdersRes, inventoryRes] = await Promise.all([
          fetch("/api/the-eye/admin/maintenance/summary", { credentials: "include" }),
          fetch("/api/the-eye/admin/work-orders?limit=50", { credentials: "include" }),
          fetch("/api/the-eye/admin/inventory/items?limit=100", { credentials: "include" }),
        ]);
        if (summaryRes.ok) {
          const data = await summaryRes.json();
          if (!cancelled) setMaintenanceSummary(data);
        }
        if (workOrdersRes.ok) {
          const data = await workOrdersRes.json();
          if (!cancelled) setWorkOrders(Array.isArray(data.work_orders) ? data.work_orders : []);
        }
        if (inventoryRes.ok) {
          const data = await inventoryRes.json();
          if (!cancelled) setInventoryItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (!cancelled) {
          setWorkOrders([]);
          setInventoryItems([]);
        }
      }
    };
    loadMaintenance();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadActions = async () => {
      try {
        const [actionsRes, ticketsRes, summaryRes] = await Promise.all([
          fetch("/api/the-eye/admin/actions?limit=50", { credentials: "include" }),
          fetch("/api/the-eye/admin/tickets?limit=50", { credentials: "include" }),
          fetch("/api/the-eye/admin/actions/summary", { credentials: "include" }),
        ]);
        if (actionsRes.ok) {
          const data = await actionsRes.json();
          if (!cancelled) setActions(Array.isArray(data.actions) ? data.actions : []);
        }
        if (ticketsRes.ok) {
          const data = await ticketsRes.json();
          if (!cancelled) setTickets(Array.isArray(data.tickets) ? data.tickets : []);
        }
        if (summaryRes.ok) {
          const data = await summaryRes.json();
          if (!cancelled) setActionSummary(data);
        }
      } catch {
        if (!cancelled) {
          setActions([]);
          setTickets([]);
        }
      }
    };
    loadActions();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadIncidents = async () => {
      try {
        const [listRes, summaryRes] = await Promise.all([
          fetch("/api/the-eye/admin/incidents?limit=50", { credentials: "include" }),
          fetch("/api/the-eye/admin/incidents/summary", { credentials: "include" }),
        ]);
        if (listRes.ok) {
          const data = await listRes.json();
          if (!cancelled) setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
        }
        if (summaryRes.ok) {
          const summary = await summaryRes.json();
          if (!cancelled) setIncidentSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setIncidents([]);
          setIncidentSummary({ open_total: 0, by_severity: {} });
        }
      }
    };
    loadIncidents();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCameras = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/cameras?limit=500", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.cameras)) {
          setCameras(data.cameras);
          setSelectedCameraId((current) => (
            current && data.cameras.some((camera) => camera.camera_id === current)
              ? current
              : data.cameras[0]?.camera_id || null
          ));
        }
      } catch {
        if (!cancelled) setCameras([]);
      }
    };
    loadCameras();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/map/devices", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          const nextDevices = Array.isArray(data.devices) ? data.devices : [];
          setDevices(nextDevices);
          setDeviceDataState(nextDevices.length ? "live" : "empty");
          setSelectedId((current) => (
            current && nextDevices.some((d) => d.device_id === current)
              ? current
              : nextDevices[0]?.device_id || null
          ));
        }
      } catch {
        if (!cancelled) {
          setDevices([]);
          setSelectedId(null);
          setDeviceDataState("unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/the-eye/admin/search?q=${encodeURIComponent(value)}&limit=10`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data.results) ? data.results : []);
        setSearchOpen(true);
      } catch (error) {
        if (error?.name !== "AbortError") {
          setSearchResults([]);
          setSearchOpen(false);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectSearchResult = async (result) => {
    setSearchOpen(false);
    setQuery(result?.title || "");
    setLocationDetail(null);
    setScopedDevices(null);

    if (result?.entity_type === "device" && result?.entity_id) {
      setSelectedId(result.entity_id);
      if (result?.location?.lat != null && result?.location?.lng != null) {
        setMapFocus({
          label: result.title || result.entity_id,
          city: result.city,
          country: result.country,
          lat: Number(result.location.lat),
          lng: Number(result.location.lng),
          zoom: "device",
        });
      }
    }

    if (result?.entity_type === "camera" && result?.camera_id) {
      setSelectedCameraId(result.camera_id);
      const linkedDevice = devices.find((device) => device.device_id === result.device_id);
      if (linkedDevice) {
        setSelectedId(linkedDevice.device_id);
        if (linkedDevice?.location?.lat != null && linkedDevice?.location?.lng != null) {
          setMapFocus({
            label: result.title || result.camera_id,
            city: linkedDevice.city,
            country: linkedDevice.country,
            lat: Number(linkedDevice.location.lat),
            lng: Number(linkedDevice.location.lng),
            zoom: "device",
          });
        }
      }
    }

    if (result?.entity_id?.startsWith?.("LOC-")) {
      try {
        const res = await fetch(`/api/the-eye/admin/locations/${encodeURIComponent(result.entity_id)}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const detail = await res.json();
        setLocationDetail(detail);
        setSiteHealth(null);
        if (detail?.location?.location_type === "site") {
          const siteId = detail?.location?.code || detail?.location?.location_id;
          if (siteId) {
            try {
              const healthRes = await fetch(`/api/the-eye/admin/sites/${encodeURIComponent(siteId)}/health`, {
                credentials: "include",
              });
              if (healthRes.ok) {
                setSiteHealth(await healthRes.json());
              }
            } catch {
              setSiteHealth(null);
            }
          }
        }
        const point = detail?.location?.location;
        if (point?.lat != null && point?.lng != null) {
          setMapFocus({
            label: detail?.location?.name || result?.title,
            city: detail?.location?.city,
            country: detail?.location?.country,
            lat: Number(point.lat),
            lng: Number(point.lng),
            zoom: detail?.location?.location_type || "location",
          });
        }
      } catch {
        setLocationDetail(null);
      }
    }

    const city = result?.city || (result?.entity_type === "city" ? result?.title : null);
    if (!city) {
      setLocationSummary(null);
      return;
    }

    try {
      const params = new URLSearchParams({ city });
      if (result?.country) params.set("country", result.country);
      const res = await fetch(`/api/the-eye/admin/location-summary?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLocationSummary(data);

      const point = data?.location?.location;
      if (point?.lat != null && point?.lng != null) {
        setMapFocus({
          label: data?.location?.city || city,
          city: data?.location?.city || city,
          country: data?.location?.country || result?.country,
          lat: Number(point.lat),
          lng: Number(point.lng),
          zoom: "city",
        });
      } else if (result?.location?.lat != null && result?.location?.lng != null) {
        setMapFocus({
          label: result?.title || city,
          city,
          country: result?.country,
          lat: Number(result.location.lat),
          lng: Number(result.location.lng),
          zoom: result?.entity_type || "location",
        });
      } else {
        setMapFocus((current) => current || {
          label: data?.location?.city || city,
          city: data?.location?.city || city,
          country: data?.location?.country || result?.country,
          lat: null,
          lng: null,
          zoom: "city",
        });
      }

      const mapParams = new URLSearchParams();
      if (result?.entity_id?.startsWith?.("LOC-")) {
        mapParams.set("location_id", result.entity_id);
      } else {
        mapParams.set("city", city);
        if (result?.country) mapParams.set("country", result.country);
      }
      const mapRes = await fetch(`/api/the-eye/admin/map/devices?${mapParams.toString()}`, {
        credentials: "include",
      });
      if (mapRes.ok) {
        const mapData = await mapRes.json();
        setScopedDevices(Array.isArray(mapData.devices) ? mapData.devices : []);
      }
    } catch {
      setLocationSummary(null);
      setScopedDevices(null);
    }
  };

  useEffect(() => {
    let stopped = false;
    let socket = null;
    let retryTimer = null;

    const mergeDevice = (deviceId, patch) => {
      setDevices((current) => current.map((device) => (
        device.device_id === deviceId ? { ...device, ...patch } : device
      )));
    };

    const connect = () => {
      if (stopped) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/the-eye/ws`);

      socket.onopen = () => setLiveConnected(false);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const payload = message?.payload || {};

          if (message.type === "connected" && payload.service === "the-eye") {
            setLiveConnected(true);
            return;
          }
          if (message.type === "error") {
            setLiveConnected(false);
            return;
          }

          if (message.type === "device.registered" && payload.device_id) {
            setDeviceDataState("live");
            setDevices((current) => (
              current.some((device) => device.device_id === payload.device_id)
                ? current.map((device) => device.device_id === payload.device_id ? { ...device, ...payload } : device)
                : [payload, ...current]
            ));
          } else if (message.type === "device.heartbeat" && payload.device_id) {
            mergeDevice(payload.device_id, payload);
          } else if (message.type === "device.location" && payload.device_id) {
            mergeDevice(payload.device_id, payload);
          } else if (message.type === "device.telemetry" && payload.device_id) {
            mergeDevice(payload.device_id, {
              connection_status: payload.connection_status || "online",
              last_telemetry: payload.metrics,
              last_seen_at: payload.received_at,
            });
          } else if (message.type === "camera.created" && payload.camera_id) {
            setCameras((current) => (
              current.some((camera) => camera.camera_id === payload.camera_id)
                ? current.map((camera) => camera.camera_id === payload.camera_id ? { ...camera, ...payload } : camera)
                : [payload, ...current]
            ));
          } else if ((message.type === "camera.updated" || message.type === "camera.health") && payload.camera_id) {
            setCameras((current) => current.map((camera) => (
              camera.camera_id === payload.camera_id ? { ...camera, ...payload } : camera
            )));
          } else if (message.type === "network.health" && payload.node_id) {
            setSiteHealth((current) => {
              if (!current?.network) return current;
              return {
                ...current,
                network: current.network.map((node) => (
                  node.node_id === payload.node_id ? { ...node, ...payload } : node
                )),
              };
            });
          } else if ((message.type === "incident.created" || message.type === "incident.updated") && payload.incident_id) {
            setIncidents((current) => {
              const exists = current.some((incident) => incident.incident_id === payload.incident_id);
              return exists
                ? current.map((incident) => incident.incident_id === payload.incident_id ? payload : incident)
                : [payload, ...current];
            });
            setIncidentSummary((current) => ({
              ...current,
              open_total: Math.max(0, current.open_total + (message.type === "incident.created" ? 1 : 0)),
            }));
          } else if ((message.type === "action.created" || message.type === "action.updated") && payload.action_id) {
            setActions((current) => {
              const exists = current.some((item) => item.action_id === payload.action_id);
              return exists
                ? current.map((item) => item.action_id === payload.action_id ? payload : item)
                : [payload, ...current];
            });
          } else if ((message.type === "ticket.created" || message.type === "ticket.updated") && payload.ticket_id) {
            setTickets((current) => {
              const exists = current.some((item) => item.ticket_id === payload.ticket_id);
              return exists
                ? current.map((item) => item.ticket_id === payload.ticket_id ? payload : item)
                : [payload, ...current];
            });
          } else if ((message.type === "work_order.created" || message.type === "work_order.updated") && payload.work_order_id) {
            setWorkOrders((current) => {
              const exists = current.some((item) => item.work_order_id === payload.work_order_id);
              return exists
                ? current.map((item) => item.work_order_id === payload.work_order_id ? payload : item)
                : [payload, ...current];
            });
          } else if ((message.type === "inventory.created" || message.type === "inventory.updated") && payload.inventory_item_id) {
            setInventoryItems((current) => {
              const exists = current.some((item) => item.inventory_item_id === payload.inventory_item_id);
              return exists
                ? current.map((item) => item.inventory_item_id === payload.inventory_item_id ? payload : item)
                : [payload, ...current];
            });
          } else if ((message.type === "rma.created" || message.type === "rma.updated") && payload.rma_id) {
            setMaintenanceSummary((current) => ({
              ...current,
              active_rma: Math.max(0, current.active_rma + (message.type === "rma.created" ? 1 : 0)),
            }));
          } else if (message.type === "data_quality.source" && payload.source_id) {
            setDataQuality((current) => ({
              ...current,
              sources: [
                payload,
                ...(current.sources || []).filter((source) => source.source_id !== payload.source_id),
              ].slice(0, 20),
            }));
          } else if (message.type === "data_quality.issue_created" && payload.issue_id) {
            setDataQuality((current) => ({
              ...current,
              open_issues: Number(current.open_issues || 0) + 1,
              conflicts: Number(current.conflicts || 0) + (payload.issue_type === "data_conflict" ? 1 : 0),
              schema_errors: Number(current.schema_errors || 0) + (payload.issue_type === "schema_error" ? 1 : 0),
              issues: [payload, ...(current.issues || [])].slice(0, 20),
            }));
          } else if (message.type === "data_quality.issue_resolved" && payload.issue_id) {
            setDataQuality((current) => ({
              ...current,
              open_issues: Math.max(0, Number(current.open_issues || 0) - 1),
              conflicts: Math.max(0, Number(current.conflicts || 0) - (payload.issue_type === "data_conflict" ? 1 : 0)),
              schema_errors: Math.max(0, Number(current.schema_errors || 0) - (payload.issue_type === "schema_error" ? 1 : 0)),
              issues: (current.issues || []).filter((issue) => issue.issue_id !== payload.issue_id),
            }));
          } else if ((message.type === "provider.created" || message.type === "provider.updated" || message.type === "provider.health") && payload.provider_id) {
            setProviderOverview((current) => ({
              ...current,
              providers: [
                payload,
                ...(current.providers || []).filter((provider) => provider.provider_id !== payload.provider_id),
              ].slice(0, 20),
            }));
          } else if ((message.type === "project.created" || message.type === "project.snapshot") && (payload.project_id || payload.project_key)) {
            setProjectOverview((current) => {
              const row = {
                project_id: payload.project_id,
                project_key: payload.project_key,
                name: payload.name || payload.project_key,
                status: payload.status,
                health_score: payload.health_score,
                risk_score: payload.risk_score,
                data_trust_score: payload.data_trust_score,
                revenue: payload.revenue || 0,
                cost: payload.cost || 0,
                profit: payload.profit || 0,
                active_users: payload.active_users || 0,
                critical_alerts: payload.critical_alerts || 0,
                open_incidents: payload.open_incidents || 0,
                uptime_percent: payload.uptime_percent,
                latency_p95_ms: payload.latency_p95_ms,
              };
              const key = payload.project_key;
              const exists = (current.projects || []).some((project) => project.project_key === key);
              return {
                ...current,
                projects: exists
                  ? current.projects.map((project) => project.project_key === key ? { ...project, ...row } : project)
                  : [row, ...(current.projects || [])],
              };
            });
          } else if (message.type === "security.event" && payload.event_id) {
            setSecurityOverview((current) => ({
              ...current,
              open_security_events: Number(current.open_security_events || 0) + 1,
              critical: Number(current.critical || 0) + (payload.severity === "critical" ? 1 : 0),
              high: Number(current.high || 0) + (payload.severity === "high" ? 1 : 0),
              events: [payload, ...(current.events || [])].slice(0, 20),
            }));
          } else if (message.type === "security.event_resolved" && payload.event_id) {
            setSecurityOverview((current) => ({
              ...current,
              open_security_events: Math.max(0, Number(current.open_security_events || 0) - 1),
              critical: Math.max(0, Number(current.critical || 0) - (payload.severity === "critical" ? 1 : 0)),
              high: Math.max(0, Number(current.high || 0) - (payload.severity === "high" ? 1 : 0)),
              events: (current.events || []).filter((event) => event.event_id !== payload.event_id),
            }));
          } else if ((message.type === "approval.created" || message.type === "approval.updated") && payload.approval_id) {
            setSecurityOverview((current) => {
              const pending = payload.status === "pending";
              const existedPending = (current.approvals || []).some((item) => item.approval_id === payload.approval_id && item.status === "pending");
              const nextApprovals = pending
                ? [payload, ...(current.approvals || []).filter((item) => item.approval_id !== payload.approval_id)].slice(0, 20)
                : (current.approvals || []).filter((item) => item.approval_id !== payload.approval_id);
              return {
                ...current,
                pending_approvals: Math.max(0, Number(current.pending_approvals || 0) + (pending && !existedPending ? 1 : !pending && existedPending ? -1 : 0)),
                approvals: nextApprovals,
              };
            });
          } else if (message.type === "executive.brief_created" && payload.brief_id) {
            setExecutiveOverview((current) => ({
              ...current,
              recent_briefs: [payload, ...(current.recent_briefs || []).filter((brief) => brief.brief_id !== payload.brief_id)].slice(0, 10),
            }));
          } else if (message.type === "continuity.emergency_mode" && payload.mode) {
            setContinuityOverview((current) => ({
              ...current,
              emergency_mode: payload,
            }));
          }
        } catch {
          // Ignore malformed realtime messages; REST data remains authoritative.
        }
      };
      socket.onclose = (event) => {
        setLiveConnected(false);
        if (!stopped && event.code !== 4401 && event.code !== 4403) {
          retryTimer = window.setTimeout(connect, 2000);
        }
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      stopped = true;
      setLiveConnected(false);
      if (retryTimer) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  const correlateCurrentSite = async () => {
    const siteId = locationDetail?.location?.location_type === "site"
      ? (locationDetail?.location?.code || locationDetail?.location?.location_id)
      : null;
    if (!siteId || correlating) return;

    setCorrelating(true);
    try {
      const res = await fetch(
        `/api/the-eye/admin/incidents/correlate-site/${encodeURIComponent(siteId)}`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      if (data?.incident?.incident_id) {
        setIncidents((current) => {
          const exists = current.some((incident) => incident.incident_id === data.incident.incident_id);
          return exists
            ? current.map((incident) => incident.incident_id === data.incident.incident_id ? data.incident : incident)
            : [data.incident, ...current];
        });
      }
      const summaryRes = await fetch("/api/the-eye/admin/incidents/summary", { credentials: "include" });
      if (summaryRes.ok) setIncidentSummary(await summaryRes.json());
    } catch {
      // Keep the dashboard usable if correlation cannot run.
    } finally {
      setCorrelating(false);
    }
  };

  const askAion = async () => {
    const question = aionInput.trim();
    if (!question || aionBusy) return;
    setAionBusy(true);
    try {
      const res = await fetch("/api/the-eye/admin/aion/query", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context: {
            session_id: aionSessionId,
            selected_device_id: selectedId,
            selected_camera_id: selectedCameraId,
            location_id: locationDetail?.location?.location_id || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setAionSessionId(data.session_id || aionSessionId);
      setAionAnswer(data.answer || null);
      setAionInput("");
    } catch (error) {
      setAionAnswer({
        intent: "error",
        facts: [],
        analysis: [error?.message || "AION konnte die Anfrage nicht verarbeiten."],
        assumptions: [],
        confidence: 0,
      });
    } finally {
      setAionBusy(false);
    }
  };

  const visibleDevices = scopedDevices ?? devices;

  const selectedCamera = useMemo(() => {
    const byId = cameras.find((camera) => camera.camera_id === selectedCameraId);
    if (byId) return byId;
    const byDevice = cameras.find((camera) => camera.device_id === selectedId);
    return byDevice || cameras[0] || null;
  }, [cameras, selectedCameraId, selectedId]);

  const openCameraStream = async () => {
    if (!selectedCamera?.camera_id) {
      setStreamMessage("Für dieses Gerät ist noch keine Kamera registriert.");
      return;
    }
    setStreamMessage("Stream wird vorbereitet …");
    setStreamSession(null);
    try {
      const res = await fetch(
        `/api/the-eye/admin/cameras/${encodeURIComponent(selectedCamera.camera_id)}/stream-session`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setStreamSession(data);
      setStreamMessage(data.configured ? "Live-Session aktiv" : (data.notice || "Media Gateway noch nicht konfiguriert."));
    } catch (error) {
      setStreamMessage(error?.message || "Stream konnte nicht geöffnet werden.");
    }
  };

  const selected = useMemo(
    () => devices.find((d) => d.device_id === selectedId)
      || visibleDevices.find((d) => d.device_id === selectedId)
      || visibleDevices[0]
      || devices[0],
    [devices, visibleDevices, selectedId]
  );

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || mapFocus) return visibleDevices;
    return visibleDevices.filter((d) => [d.device_id, d.device_type, d.city, d.country].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [visibleDevices, query, mapFocus]);

  const resetMap = () => {
    setMapFocus(null);
    setLocationSummary(null);
    setLocationDetail(null);
    setSiteHealth(null);
    setScopedDevices(null);
    setQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  };

  const focusedPins = useMemo(() => {
    if (!mapFocus) return [];
    const rows = visibleDevices.filter((d) => d?.location?.lat != null && d?.location?.lng != null);
    if (!rows.length) return [];

    const centerLat = mapFocus.lat ?? rows.reduce((sum, d) => sum + Number(d.location.lat), 0) / rows.length;
    const centerLng = mapFocus.lng ?? rows.reduce((sum, d) => sum + Number(d.location.lng), 0) / rows.length;
    const spanLat = Math.max(...rows.map((d) => Math.abs(Number(d.location.lat) - centerLat)), 0.01);
    const spanLng = Math.max(...rows.map((d) => Math.abs(Number(d.location.lng) - centerLng)), 0.01);

    return rows.slice(0, 200).map((device) => ({
      ...device,
      pinX: Math.max(8, Math.min(92, 50 + ((Number(device.location.lng) - centerLng) / (spanLng * 2.4)) * 100)),
      pinY: Math.max(10, Math.min(90, 50 - ((Number(device.location.lat) - centerLat) / (spanLat * 2.4)) * 100)),
    }));
  }, [visibleDevices, mapFocus]);

  const toggleLayer = (name) => setActiveLayers((prev) => ({ ...prev, [name]: !prev[name] }));

  const layerCountFor = (name) => {
    if (name === "Kameras") return cameras.length;
    if (name === "BidBlitz Geräte") return visibleDevices.length;
    return null;
  };

  const dataTrustLabel = dataQuality.overall_trust == null
    ? "UNKNOWN"
    : `${Number(dataQuality.overall_trust).toFixed(1)} / 100 Trust`;
  const executiveTrustLabel = executiveOverview.snapshot?.data_trust_score == null
    ? "UNKNOWN"
    : Number(executiveOverview.snapshot.data_trust_score).toFixed(0);
  const continuityLabel = continuityOverview.continuity_score == null
    ? "UNKNOWN"
    : `${continuityOverview.continuity_score}/100 · ${continuityOverview.status || "unknown"}`;

  const systemStatus = loading
    ? { label: "Daten werden geladen", tone: "unknown" }
    : readiness.staging_ready && liveConnected
      ? { label: "Staging verifiziert", tone: "healthy" }
      : !liveConnected
        ? { label: "Realtime nicht verbunden", tone: "warning" }
        : readiness.staging_blockers?.length
          ? { label: "Readiness blockiert", tone: "warning" }
          : { label: "Readiness nicht verifiziert", tone: "unknown" };

  return (
    <div className="the-eye-page">
      <header className="eye-topbar">
        <button className="eye-brand" onClick={() => onNavigate?.("/")}>
          <span className="eye-logo"><CircleDot size={26} /></span>
          <span><strong>THE EYE</strong><small>by BidBlitz</small></span>
        </button>

        <nav className="eye-nav">
          <button className="active"><Globe2 size={18} />Karte</button>
          <button><Camera size={18} />Live</button>
          <button><Cpu size={18} />Geräte</button>
          <button><Activity size={18} />Analyse</button>
          <button><Bell size={18} />Warnungen{incidentSummary.open_total ? <span className="eye-nav-badge">{incidentSummary.open_total}</span> : null}</button>
          <button><Bot size={18} />AION{securityOverview.pending_approvals ? <span className="eye-nav-badge approval">{securityOverview.pending_approvals}</span> : null}</button>
        </nav>

        <div className="eye-search">
          <Search size={18} />
          <input
            value={query}
            onFocus={() => searchResults.length && setSearchOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Land, Stadt, Straße, Gerät, Kamera ..."
          />
          {searchOpen && searchResults.length > 0 ? (
            <div className="eye-search-results">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.entity_type}:${result.entity_id || result.title}:${index}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSearchResult(result)}
                >
                  <span className="eye-search-result-icon">
                    {result.entity_type === "camera" ? <Camera size={16} /> : result.entity_type === "device" ? <Cpu size={16} /> : <MapPin size={16} />}
                  </span>
                  <span>
                    <strong>{result.title || "Unbekannt"}</strong>
                    <small>{result.subtitle || result.entity_type}</small>
                  </span>
                  <em>{result.entity_type}</em>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="eye-user"><span className={`eye-live-dot${liveConnected ? "" : " offline"}`} /> Admin · {liveConnected ? "Live" : "Verbinden"} <ChevronDown size={15} /></div>
      </header>

      <div className="eye-layout">
        <aside className="eye-sidebar">
          <section>
            <div className="eye-section-title"><span>Ansicht</span><Layers3 size={16} /></div>
            <div className="eye-segment"><button className={!mapFocus ? "active" : ""} onClick={resetMap}>Welt</button><button className={mapFocus ? "active" : ""}>{mapFocus ? "Standort" : "Meine Geräte"}</button></div>
          </section>

          <section className="eye-layer-list">
            <div className="eye-section-title"><span>Layer</span><span className="eye-count">{LAYERS.filter(([n]) => activeLayers[n]).length}</span></div>
            {LAYERS.map(([name, Icon, , tone]) => {
              const count = layerCountFor(name);
              return (
                <button className="eye-layer-row" key={name} onClick={() => toggleLayer(name)}>
                  <span className={`eye-layer-icon eye-tone-${tone}`}><Icon size={17} /></span>
                  <span className="eye-layer-name">{name}</span>
                  <span className="eye-layer-count">{count == null ? "—" : count.toLocaleString("de-DE")}</span>
                  <span className={`eye-switch ${activeLayers[name] ? "on" : ""}`}><span /></span>
                </button>
              );
            })}
          </section>

          <section>
            <div className="eye-section-title"><span>Geräte</span><span>{loading ? "…" : devices.length}</span></div>
            <div className="eye-device-mini-list">
              {filteredDevices.slice(0, 6).map((device) => {
                const Icon = ICONS[device.device_type] || Cpu;
                return (
                  <button key={device.device_id} className={selectedId === device.device_id ? "selected" : ""} onClick={() => { setSelectedId(device.device_id); const linked = cameras.find((camera) => camera.device_id === device.device_id); if (linked) setSelectedCameraId(linked.camera_id); }}>
                    <Icon size={16} />
                    <span><strong>{device.device_id}</strong><small>{device.city || "Unbekannt"}</small></span>
                    <i className={device.connection_status === "online" ? "online" : "offline"} />
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <main className="eye-main">
          {locationDetail?.breadcrumb?.length ? (
            <div className="eye-breadcrumb">
              {locationDetail.breadcrumb.map((item, index) => (
                <span key={item.location_id}>
                  {index > 0 ? <b>›</b> : null}
                  <strong>{item.name}</strong>
                </span>
              ))}
            </div>
          ) : null}
          {locationSummary ? (
            <section className="eye-location-twin">
              <div className="eye-location-title">
                <div>
                  <span>LOCATION DIGITAL TWIN</span>
                  <h2>{locationSummary.location?.city || "Standort"}{locationSummary.location?.country ? ` · ${locationSummary.location.country}` : ""}</h2>
                </div>
                <div className="eye-location-health">
                  <span className="eye-live-dot" />
                  <strong>{locationSummary.location?.health_score ?? "Live"}</strong>
                  <small>{locationSummary.location?.health_score != null ? "Health Score" : "Daten verbunden"}</small>
                </div>
              </div>
              <div className="eye-location-stats">
                <div><span>Geräte</span><strong>{locationSummary.devices?.total ?? 0}</strong></div>
                <div><span>Online</span><strong>{locationSummary.devices?.online ?? 0}</strong></div>
                <div><span>Kameras</span><strong>{locationSummary.devices?.by_type?.camera ?? 0}</strong></div>
                <div><span>Taxi</span><strong>{locationSummary.devices?.by_type?.taxi ?? 0}</strong></div>
                <div><span>Scooter</span><strong>{locationSummary.devices?.by_type?.scooter ?? 0}</strong></div>
                <div><span>Power</span><strong>{locationSummary.devices?.by_type?.power_station ?? 0}</strong></div>
                <div><span>Warnung</span><strong>{locationSummary.devices?.warning ?? 0}</strong></div>
                <div><span>Offline</span><strong>{locationSummary.devices?.offline ?? 0}</strong></div>
              </div>
              {siteHealth ? (
                <div className="eye-site-health">
                  <div>
                    <span>SITE HEALTH</span>
                    <strong>{siteHealth.health_score ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Netzwerk</span>
                    <strong>{siteHealth.summary?.network_nodes ?? 0}</strong>
                    <small>{siteHealth.summary?.network_offline ?? 0} offline</small>
                  </div>
                  <div>
                    <span>Kameras</span>
                    <strong>{siteHealth.summary?.cameras ?? 0}</strong>
                    <small>{siteHealth.summary?.cameras_offline ?? 0} offline</small>
                  </div>
                  <div>
                    <span>Root Cause</span>
                    <strong>{siteHealth.root_cause?.classification || "Kein gemeinsamer Fehler"}</strong>
                    <small>{siteHealth.root_cause?.confidence != null ? `${Math.round(siteHealth.root_cause.confidence * 100)} % Confidence` : "—"}</small>
                    <button className="eye-correlate-btn" onClick={correlateCurrentSite} disabled={correlating}>
                      {correlating ? "Analysiere …" : "Incident korrelieren"}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={`eye-world${mapFocus ? " eye-world--focused" : ""}`}>
            <div className="eye-world-grid" />
            {mapFocus ? (
              <div className="eye-focused-map">
                {mapFocus.lat != null && mapFocus.lng != null ? (
                  <MapContainer
                    key={`${mapFocus.lat}:${mapFocus.lng}:${mapFocus.zoom}`}
                    center={[mapFocus.lat, mapFocus.lng]}
                    zoom={mapFocus.zoom === "device" || mapFocus.zoom === "site" || mapFocus.zoom === "street" ? 16 : 13}
                    scrollWheelZoom
                    className="eye-leaflet-map"
                    zoomControl={false}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {focusedPins.map((device) => (
                      <CircleMarker
                        key={device.device_id}
                        center={[Number(device.location.lat), Number(device.location.lng)]}
                        radius={selectedId === device.device_id ? 9 : 6}
                        pathOptions={{
                          color: device.connection_status === "online" ? "#2fe18a" : device.connection_status === "warning" ? "#ffb63e" : "#ff6767",
                          fillColor: device.connection_status === "online" ? "#2fe18a" : device.connection_status === "warning" ? "#ffb63e" : "#ff6767",
                          fillOpacity: 0.8,
                          weight: 2,
                        }}
                        eventHandlers={{ click: () => { setSelectedId(device.device_id); const linked = cameras.find((camera) => camera.device_id === device.device_id); if (linked) setSelectedCameraId(linked.camera_id); } }}
                      >
                        <Popup>
                          <strong>{device.device_id}</strong><br />
                          {device.device_type} · {device.connection_status}
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                ) : (
                  <>
                    <div className="eye-focused-radar" />
                    <div className="eye-focused-road road-a" />
                    <div className="eye-focused-road road-b" />
                    <div className="eye-focused-road road-c" />
                    {focusedPins.map((device) => {
                      const Icon = ICONS[device.device_type] || Cpu;
                      return (
                        <button
                          key={device.device_id}
                          className={`eye-live-pin ${device.connection_status === "online" ? "online" : device.connection_status === "warning" ? "warning" : "offline"}`}
                          style={{ left: `${device.pinX}%`, top: `${device.pinY}%` }}
                          title={device.device_id}
                          onClick={() => setSelectedId(device.device_id)}
                        >
                          <Icon size={13} />
                        </button>
                      );
                    })}
                  </>
                )}
                <div className="eye-focused-center">
                  <MapPin size={17} />
                  <span>
                    <strong>{mapFocus.label || mapFocus.city || "Standort"}</strong>
                    <small>{[mapFocus.city, mapFocus.country].filter(Boolean).join(" · ")}</small>
                  </span>
                </div>
                <div className="eye-focus-label">
                  <span>DIGITAL MAP</span>
                  <strong>{mapFocus.lat != null && mapFocus.lng != null ? `${mapFocus.lat.toFixed(5)}, ${mapFocus.lng.toFixed(5)}` : "Standortdaten"}</strong>
                </div>
              </div>
            ) : (
            worldMapMode ? (
              <div className="eye-focused-map">
                <MapContainer key={`world-${worldZoom}`} center={[30, 15]} zoom={worldZoom} minZoom={2} maxZoom={9} scrollWheelZoom className="eye-leaflet-map" zoomControl={false}>
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {activeLayers["BidBlitz Geräte"] && visibleDevices.filter((device) => {
                    const lat = Number(device?.location?.lat);
                    const lng = Number(device?.location?.lng);
                    return device?.location?.lat != null && device?.location?.lng != null &&
                      Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
                  }).slice(0, 500).map((device) => (
                    <CircleMarker
                      key={device.device_id}
                      center={[Number(device.location.lat), Number(device.location.lng)]}
                      radius={selectedId === device.device_id ? 9 : 6}
                      pathOptions={{ color: device.connection_status === "online" ? "#2fe18a" : "#ffb63e", fillOpacity: 0.8 }}
                      eventHandlers={{ click: () => setSelectedId(device.device_id) }}
                    >
                      <Popup>{device.name || device.device_id}</Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            ) : (
            <div className="eye-globe">
              <div className="eye-globe-shine" />
              <div className="eye-orbit orbit-a" />
              <div className="eye-orbit orbit-b" />
              <div className="eye-world-label label-eu">EUROPA</div>
              <span className="eye-world-demo-label" title="Die dekorativen Symbole zeigen keine Echtzeitpositionen">Illustrative Ansicht · keine Live-Positionen</span>
              <div className="eye-world-label label-af">AFRIKA</div>
              <div className="eye-world-label label-as">ASIEN</div>
              <div className="eye-prishtina"><span /><strong>Prishtina</strong></div>

              <div className="eye-pin pin-1 cyan"><Camera size={16} /></div>
              <div className="eye-pin pin-2 blue"><Plane size={16} /></div>
              <div className="eye-pin pin-3 amber"><Ship size={16} /></div>
              <div className="eye-pin pin-4 red"><Flame size={16} /></div>
              <div className="eye-pin pin-5 green"><Cpu size={16} /></div>
              <div className="eye-pin pin-6 violet"><Satellite size={16} /></div>
              <div className="eye-pin pin-7 blue"><Plane size={16} /></div>
              <div className="eye-pin pin-8 green"><Cpu size={16} /></div>
            </div>
            )}
            )}

            <div className="eye-map-toolbar">
              <button type="button" disabled={Boolean(mapFocus)} onClick={() => { setWorldMapMode(true); setWorldZoom((z) => Math.min(9, z + 1)); }} aria-label="Weltkarte vergrößern" title={mapFocus ? "Zoom für Standortkarte direkt auf der Karte verwenden" : "Weltkarte vergrößern"}>+</button><button type="button" disabled={Boolean(mapFocus)} onClick={() => { setWorldMapMode(true); setWorldZoom((z) => Math.max(2, z - 1)); }} aria-label="Weltkarte verkleinern" title={mapFocus ? "Zoom für Standortkarte direkt auf der Karte verwenden" : "Weltkarte verkleinern"}>−</button><button type="button" onClick={() => { setWorldMapMode(true); setActiveLayers((previous) => ({ ...previous, "BidBlitz Geräte": !previous["BidBlitz Geräte"] })); }} aria-label="BidBlitz Geräte auf Karte ein- oder ausblenden" aria-pressed={Boolean(activeLayers["BidBlitz Geräte"])} title="Eigene Geräte auf der Karte anzeigen oder ausblenden"><Layers3 size={17} /></button><button onClick={mapFocus ? resetMap : () => setWorldMapMode((current) => !current)}>{mapFocus ? "Welt" : worldMapMode ? "Globus" : "Karte"}</button>
            </div>

            <div className="eye-live-clock"><span><Camera size={15} /> {liveConnected ? "Realtime" : "No Realtime"}</span><strong>{deviceDataState.toUpperCase()}</strong></div>
          </section>

          <section className="eye-metrics">
            <MetricCard icon={Camera} value={cameras.length.toLocaleString("de-DE")} label="Interne Kameras" tone="cyan" />
            <MetricCard icon={Plane} value="—" label="Flüge · keine Quelle" tone="blue" />
            <MetricCard icon={Ship} value="—" label="Schiffe · keine Quelle" tone="amber" />
            <MetricCard icon={Cpu} value={visibleDevices.length.toLocaleString("de-DE")} label={mapFocus ? "Geräte im Bereich" : "Eigene Geräte"} tone="green" />
            <MetricCard icon={Flame} value="—" label="Feuer · keine Quelle" tone="red" />
            <MetricCard icon={Activity} value="—" label="Erdbeben · keine Quelle" tone="orange" />
          </section>

          <section className="eye-incident-strip">
            <div className="eye-incident-summary">
              <span>INCIDENT CENTER</span>
              <strong>{incidentSummary.open_total || 0} offen</strong>
              <small>Critical {incidentSummary.by_severity?.critical || 0} · High {incidentSummary.by_severity?.high || 0}</small>
            </div>
            <div className="eye-incident-list">
              {incidents.filter((incident) => !["resolved", "closed"].includes(incident.status)).slice(0, 3).map((incident) => (
                <div key={incident.incident_id} className={`eye-incident-item ${incident.severity || "medium"}`}>
                  <span>{incident.severity}</span>
                  <strong>{incident.title}</strong>
                  <small>{incident.site_id || "Global"} · {incident.root_cause || "Analyse läuft"}</small>
                </div>
              ))}
              {!incidents.some((incident) => !["resolved", "closed"].includes(incident.status)) ? (
                <div className="eye-incident-empty">Keine offenen Incidents</div>
              ) : null}
            </div>
          </section>

          <section className="eye-action-center">
            <div className="eye-action-head">
              <div>
                <span>ACTION CENTER</span>
                <strong>{actionSummary.open_actions || 0} Aktionen · {actionSummary.open_tickets || 0} Tickets</strong>
              </div>
              <div className="eye-action-kpis">
                <span>P1 {actionSummary.actions_by_priority?.p1 || 0}</span>
                <span>P2 {actionSummary.actions_by_priority?.p2 || 0}</span>
                <span>Tickets P1 {actionSummary.tickets_by_priority?.p1 || 0}</span>
              </div>
            </div>
            <div className="eye-action-columns">
              <div>
                <h4>Offene Aktionen</h4>
                {actions.filter((item) => !["done", "cancelled"].includes(item.status)).slice(0, 4).map((item) => (
                  <div className="eye-action-row" key={item.action_id}>
                    <span className={`prio ${item.priority}`}>{item.priority?.toUpperCase()}</span>
                    <div><strong>{item.title}</strong><small>{item.status} · {item.assigned_to || item.assigned_team || "nicht zugewiesen"}</small></div>
                  </div>
                ))}
                {!actions.some((item) => !["done", "cancelled"].includes(item.status)) ? <div className="eye-action-empty">Keine offenen Aktionen</div> : null}
              </div>
              <div>
                <h4>Techniker / Tickets</h4>
                {tickets.filter((item) => !["resolved", "closed", "cancelled"].includes(item.status)).slice(0, 4).map((item) => (
                  <div className="eye-action-row" key={item.ticket_id}>
                    <span className={`prio ${item.priority}`}>{item.priority?.toUpperCase()}</span>
                    <div><strong>{item.title}</strong><small>{item.category} · {item.status} · {item.assigned_to || item.assigned_team || "nicht zugewiesen"}</small></div>
                  </div>
                ))}
                {!tickets.some((item) => !["resolved", "closed", "cancelled"].includes(item.status)) ? <div className="eye-action-empty">Keine offenen Tickets</div> : null}
              </div>
            </div>
          </section>

          <section className="eye-maintenance-center">
            <div className="eye-maintenance-head">
              <div>
                <span>MAINTENANCE & INVENTORY</span>
                <strong>{maintenanceSummary.open_work_orders || 0} Work Orders · {maintenanceSummary.inventory_items || 0} Lagerpositionen</strong>
              </div>
              <div className="eye-maintenance-kpis">
                <span>Warten auf Teile {maintenanceSummary.waiting_parts || 0}</span>
                <span>Low Stock {maintenanceSummary.low_stock_items || 0}</span>
                <span>RMA {maintenanceSummary.active_rma || 0}</span>
              </div>
            </div>
            <div className="eye-maintenance-columns">
              <div>
                <h4>Wartungsaufträge</h4>
                {workOrders.filter((item) => !["completed", "cancelled"].includes(item.status)).slice(0, 4).map((item) => (
                  <div className="eye-maintenance-row" key={item.work_order_id}>
                    <span className={`state ${item.status}`}>{item.status}</span>
                    <div><strong>{item.title}</strong><small>{item.priority?.toUpperCase()} · {item.site_id || "ohne Site"} · {item.assigned_to || "nicht zugewiesen"}</small></div>
                  </div>
                ))}
                {!workOrders.some((item) => !["completed", "cancelled"].includes(item.status)) ? <div className="eye-maintenance-empty">Keine offenen Wartungsaufträge</div> : null}
              </div>
              <div>
                <h4>Ersatzteile / Lager</h4>
                {inventoryItems
                  .filter((item) => (Number(item.quantity || 0) - Number(item.reserved_quantity || 0)) <= Number(item.reorder_point || 0))
                  .slice(0, 4)
                  .map((item) => (
                    <div className="eye-maintenance-row" key={item.inventory_item_id}>
                      <span className="stock-low">LOW</span>
                      <div><strong>{item.name}</strong><small>{item.quantity || 0} verfügbar · Reorder {item.reorder_point || 0} · {item.warehouse || "Lager"}</small></div>
                    </div>
                  ))}
                {!inventoryItems.some((item) => (Number(item.quantity || 0) - Number(item.reserved_quantity || 0)) <= Number(item.reorder_point || 0)) ? <div className="eye-maintenance-empty">Lagerbestand im grünen Bereich</div> : null}
              </div>
            </div>
          </section>

          <section className="eye-quality-center">
            <div className="eye-quality-head">
              <div>
                <span>DATA QUALITY & TRUST</span>
                <strong>{dataTrustLabel}</strong>
              </div>
              <div className="eye-quality-kpis">
                <span>Live {dataQuality.live_sources || 0}</span>
                <span>Delayed {dataQuality.delayed_sources || 0}</span>
                <span>Offline {dataQuality.offline_sources || 0}</span>
                <span>Issues {dataQuality.open_issues || 0}</span>
              </div>
            </div>
            <div className="eye-quality-columns">
              <div>
                <h4>Datenquellen</h4>
                {(dataQuality.sources || []).slice(0, 4).map((source) => (
                  <div className="eye-quality-row" key={source.source_id}>
                    <span className={`trust-state ${source.status || "offline"}`}>{source.status || "offline"}</span>
                    <div>
                      <strong>{source.name || source.source_id}</strong>
                      <small>Trust {Number(source.trust_score || 0).toFixed(0)} · Freshness {Number(source.freshness_percent || 0).toFixed(0)} %</small>
                    </div>
                  </div>
                ))}
                {!dataQuality.sources?.length ? <div className="eye-quality-empty">Noch keine Datenquellen registriert</div> : null}
              </div>
              <div>
                <h4>Qualitätsprobleme</h4>
                {(dataQuality.issues || []).slice(0, 4).map((issue) => (
                  <div className="eye-quality-row" key={issue.issue_id}>
                    <span className={`quality-severity ${issue.severity || "medium"}`}>{issue.severity || "medium"}</span>
                    <div>
                      <strong>{issue.issue_type}</strong>
                      <small>{issue.description}</small>
                    </div>
                  </div>
                ))}
                {!dataQuality.issues?.length ? <div className="eye-quality-empty">Keine offenen Data-Quality-Probleme</div> : null}
              </div>
            </div>
          </section>

          <section className="eye-provider-center">
            <div className="eye-provider-head">
              <div>
                <span>PROVIDER INTELLIGENCE</span>
                <strong>{providerOverview.providers_total || 0} Provider · {Number(providerOverview.monthly_cost || 0).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} € Kosten</strong>
              </div>
              <div className="eye-provider-kpis">
                <span>Healthy {providerOverview.healthy || 0}</span>
                <span>Degraded {providerOverview.degraded || 0}</span>
                <span>Down {providerOverview.down_or_partial || 0}</span>
                <span>High Risk {providerOverview.high_risk || 0}</span>
                <span>No Fallback {providerOverview.without_fallback || 0}</span>
              </div>
            </div>
            <div className="eye-provider-list">
              {(providerOverview.providers || []).slice(0, 5).map((provider) => (
                <div className="eye-provider-row" key={provider.provider_id}>
                  <span className={`provider-state ${provider.status || "healthy"}`}>{provider.status || "healthy"}</span>
                  <div>
                    <strong>{provider.name}</strong>
                    <small>{provider.category || provider.provider_type} · Risk {provider.risk_score || 0}/100 · {provider.fallback_provider_id ? "Fallback vorhanden" : "Kein Fallback"}</small>
                  </div>
                  <em>{Number(provider.current_cost || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €</em>
                </div>
              ))}
              {!providerOverview.providers?.length ? <div className="eye-provider-empty">Noch keine Provider registriert</div> : null}
            </div>
          </section>

          <section className="eye-project-center">
            <div className="eye-project-head">
              <div>
                <span>PROJECT INTELLIGENCE</span>
                <strong>{projectOverview.projects_total || 0} Projekte · {projectOverview.healthy || 0} healthy</strong>
              </div>
              <div className="eye-project-kpis">
                <span>Umsatz {Number(projectOverview.revenue || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €</span>
                <span>Kosten {Number(projectOverview.cost || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €</span>
                <span>Profit {Number(projectOverview.profit || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €</span>
                <span>Users {Number(projectOverview.active_users || 0).toLocaleString("de-DE")}</span>
              </div>
            </div>
            <div className="eye-project-list">
              {(projectOverview.projects || []).slice(0, 6).map((project) => (
                <div className="eye-project-row" key={project.project_key}>
                  <span className={`project-state ${project.status || "unknown"}`}>{project.status || "unknown"}</span>
                  <div>
                    <strong>{project.name || project.project_key}</strong>
                    <small>Health {project.health_score ?? "—"} · Risk {project.risk_score ?? "—"} · Trust {project.data_trust_score ?? "—"}</small>
                  </div>
                  <div className="eye-project-money">
                    <strong>{Number(project.profit || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €</strong>
                    <small>{project.open_incidents || 0} Incidents</small>
                  </div>
                </div>
              ))}
              {!projectOverview.projects?.length ? <div className="eye-project-empty">Noch keine Projekte mit KPI-Snapshots verbunden</div> : null}
            </div>
          </section>

          <section className="eye-security-center">
            <div className="eye-security-head">
              <div>
                <span>SECURITY & APPROVAL CENTER</span>
                <strong>{securityOverview.open_security_events || 0} offene Security Events · {securityOverview.pending_approvals || 0} Freigaben</strong>
              </div>
              <div className="eye-security-kpis">
                <span>Critical {securityOverview.critical || 0}</span>
                <span>High {securityOverview.high || 0}</span>
                <span>Auth {securityOverview.auth_events || 0}</span>
                <span>Device {securityOverview.device_events || 0}</span>
                <span>API {securityOverview.api_events || 0}</span>
              </div>
            </div>
            <div className="eye-security-columns">
              <div>
                <h4>Security Events</h4>
                {(securityOverview.events || []).slice(0, 4).map((event) => (
                  <div className="eye-security-row" key={event.event_id}>
                    <span className={`security-severity ${event.severity || "medium"}`}>{event.severity || "medium"}</span>
                    <div><strong>{event.event_type}</strong><small>{event.description} · Risk {event.risk_score || 0}/100</small></div>
                  </div>
                ))}
                {!securityOverview.events?.length ? <div className="eye-security-empty">Keine offenen Security Events</div> : null}
              </div>
              <div>
                <h4>Wartende Freigaben</h4>
                {(securityOverview.approvals || []).slice(0, 4).map((approval) => (
                  <div className="eye-security-row" key={approval.approval_id}>
                    <span className={`approval-risk ${approval.risk_level || "high"}`}>{approval.risk_level || "high"}</span>
                    <div><strong>{approval.title}</strong><small>{approval.action_type} · {approval.mode} · {approval.status}</small></div>
                  </div>
                ))}
                {!securityOverview.approvals?.length ? <div className="eye-security-empty">Keine wartenden Freigaben</div> : null}
              </div>
            </div>
          </section>

          <section className="eye-executive-center">
            <div className="eye-executive-head">
              <div>
                <span>EXECUTIVE INTELLIGENCE</span>
                <strong>{executiveOverview.snapshot?.projects_total || 0} Projekte · {executiveOverview.snapshot?.projects_healthy || 0} healthy</strong>
              </div>
              <div className="eye-executive-kpis">
                <span>Umsatz {Number(executiveOverview.snapshot?.revenue || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €</span>
                <span>Profit {Number(executiveOverview.snapshot?.profit || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €</span>
                <span>Incidents {executiveOverview.snapshot?.open_incidents || 0}</span>
                <span>Security {executiveOverview.snapshot?.security_open || 0}</span>
                <span>Trust {executiveTrustLabel}</span>
              </div>
            </div>
            <div className="eye-executive-columns">
              <div>
                <h4>Top Prioritäten</h4>
                {(executiveOverview.snapshot?.priorities || []).slice(0, 5).map((priority, index) => (
                  <div className="eye-executive-row" key={`${priority.type}:${index}`}>
                    <span className={`exec-severity ${priority.severity || "medium"}`}>{priority.severity || "medium"}</span>
                    <div><strong>{priority.title}</strong><small>{priority.type}</small></div>
                  </div>
                ))}
                {!executiveOverview.snapshot?.priorities?.length ? <div className="eye-executive-empty">Keine dringenden Prioritäten</div> : null}
              </div>
              <div>
                <h4>Letzte Executive Briefs</h4>
                {(executiveOverview.recent_briefs || []).slice(0, 4).map((brief) => (
                  <div className="eye-executive-row" key={brief.brief_id}>
                    <span className="exec-brief">{brief.period}</span>
                    <div><strong>{brief.title}</strong><small>{brief.created_at ? new Date(brief.created_at).toLocaleString("de-DE") : "—"}</small></div>
                  </div>
                ))}
                {!executiveOverview.recent_briefs?.length ? <div className="eye-executive-empty">Noch keine gespeicherten Briefings</div> : null}
              </div>
            </div>
          </section>

          <section className="eye-continuity-center">
            <div className="eye-continuity-head">
              <div>
                <span>BUSINESS CONTINUITY</span>
                <strong>{continuityLabel}</strong>
              </div>
              <div className="eye-continuity-kpis">
                <span>Backups {continuityOverview.backup_services || 0}</span>
                <span>Backup Fail {continuityOverview.backup_failed || 0}</span>
                <span>Restore untested {continuityOverview.restore_untested || 0}</span>
                <span>Failover Fail {continuityOverview.failover_failed || 0}</span>
                <span>Drill Fail {continuityOverview.drill_failed || 0}</span>
              </div>
            </div>
            <div className="eye-continuity-columns">
              <div>
                <h4>Emergency Mode</h4>
                <div className={`eye-emergency-mode ${continuityOverview.emergency_mode?.mode || "normal"}`}>
                  <strong>{continuityOverview.emergency_mode?.mode || "normal"}</strong>
                  <small>{continuityOverview.emergency_mode?.reason || "Normalbetrieb"}</small>
                </div>
              </div>
              <div>
                <h4>Backup Health</h4>
                {(continuityOverview.backups || []).slice(0, 3).map((backup) => (
                  <div className="eye-continuity-row" key={backup.backup_id}>
                    <span className={`continuity-state ${backup.status || "unknown"}`}>{backup.status || "unknown"}</span>
                    <div><strong>{backup.service}</strong><small>{backup.tier} · {backup.backup_type} · RPO {backup.rpo_minutes ?? "—"}m</small></div>
                  </div>
                ))}
                {!continuityOverview.backups?.length ? <div className="eye-continuity-empty">Noch keine Backup-Reports</div> : null}
              </div>
            </div>
          </section>

          <section className="eye-readiness-center">
            <div className="eye-readiness-head">
              <div>
                <span>V1 READINESS</span>
                <strong>{readiness.staging_ready ? "Staging Ready" : readiness.code_ready ? "Code Ready · Staging Blocked" : "Readiness wird geprüft"}</strong>
              </div>
              <div className="eye-readiness-kpis">
                <span>Code {readiness.code_ready ? "OK" : "CHECK"}</span>
                <span>Staging {readiness.staging_ready ? "OK" : "BLOCKED"}</span>
                <span>Production {readiness.production_ready ? "READY" : "NOT READY"}</span>
              </div>
            </div>
            <div className="eye-readiness-columns">
              <div>
                <h4>Runtime</h4>
                {Object.entries(readiness.runtime_config || {}).map(([key, value]) => (
                  <div className="eye-readiness-row" key={key}>
                    <span className={`readiness-state ${value ? "ready" : "missing"}`}>{value ? "ready" : "missing"}</span>
                    <div><strong>{key.replaceAll("_", " ")}</strong></div>
                  </div>
                ))}
              </div>
              <div>
                <h4>Blocker / Hinweise</h4>
                {(readiness.staging_blockers || []).slice(0, 4).map((item, index) => (
                  <div className="eye-readiness-note blocker" key={`blocker:${index}`}>{item}</div>
                ))}
                {(readiness.warnings || []).slice(0, 3).map((item, index) => (
                  <div className="eye-readiness-note warning" key={`warning:${index}`}>{item}</div>
                ))}
                {!readiness.staging_blockers?.length && !readiness.warnings?.length ? (
                  <div className="eye-readiness-empty">Keine bekannten Readiness-Hinweise</div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="eye-bottom-grid">
            <div className="eye-panel">
              <div className="eye-panel-title"><span>Verifizierte Incidents</span><RefreshCw size={15} /></div>
              <div className="eye-events">
                {incidents.slice(0, 5).map((incident) => (
                  <div key={incident.incident_id}>
                    <i className={incident.severity === "critical" ? "red" : incident.severity === "high" ? "orange" : "cyan"} />
                    <span>{incident.updated_at ? new Date(incident.updated_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                    <strong>{incident.title}</strong>
                    <small>{incident.site_id || "Global"} · {incident.status || "unknown"}</small>
                  </div>
                ))}
                {!incidents.length ? <div className="eye-events-empty">Keine verifizierten Ereignisse</div> : null}
              </div>
            </div>

            <div className="eye-panel eye-analysis">
              <div className="eye-panel-title"><span>Quellenstatus</span><Activity size={15} /></div>
              <div className="eye-mini-map">
                <div className="eye-mini-grid" />
              </div>
              <div className="eye-analysis-stats">
                <span><Camera size={14} />{cameras.length}</span>
                <span><Cpu size={14} />{visibleDevices.length}</span>
                <span><Globe2 size={14} />World: —</span>
              </div>
            </div>
          </section>
        </main>

        <aside className="eye-rightbar">
          <div className="eye-camera-card">
            <div className="eye-camera-image">
              {streamSession?.playback_url ? (
                <video className="eye-camera-video" src={streamSession.playback_url} controls autoPlay muted playsInline />
              ) : (
                <>
                  <div className="eye-camera-sky" />
                  <div className="eye-camera-city" />
                </>
              )}
              <span className="eye-camera-live"><span />{selectedCamera?.connection_status === "online" ? "LIVE" : "CAM"}</span>
              <strong>{selectedCamera?.name || "Keine Kamera ausgewählt"}</strong>
              {streamMessage ? <small className="eye-camera-message">{streamMessage}</small> : null}
            </div>
            <div className="eye-camera-meta">
              <span>{selectedCamera?.camera_id || "—"}</span>
              <span>{selectedCamera?.camera_type || "—"}</span>
              <span>{selectedCamera?.mode || "—"}</span>
            </div>
          </div>

          <div className="eye-panel eye-device-card">
            <div className="eye-device-header">
              <div><Cpu size={21} /><span><strong>{selected?.device_id || "Kein Gerät"}</strong><small>{selected?.device_type || "—"} · {selected?.city || "—"}</small></span></div>
              <StatusDot status={selected?.connection_status} />
            </div>

            <div className="eye-tabs">
              {["Übersicht", "Live", "Befehle", "Verlauf"].map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}
            </div>

            <div className="eye-device-details">
              <div><span>Geräte-ID</span><strong>{selected?.device_id || "—"}</strong></div>
              <div><span>Status</span><StatusDot status={selected?.connection_status} /></div>
              <div><span>Standort</span><strong>{selected?.location ? `${selected.location.lat}, ${selected.location.lng}` : "—"}</strong></div>
              <div><span>Firmware</span><strong>{selected?.firmware_version || "—"}</strong></div>
              <div><span>Batterie</span><strong>{selected?.battery_percent ?? "—"}{selected?.battery_percent != null ? " %" : ""}</strong></div>
              <div><span>Letzte Verbindung</span><strong>{selected?.last_seen_at ? new Date(selected.last_seen_at).toLocaleTimeString("de-DE") : "—"}</strong></div>
            </div>

            <div className="eye-actions">
              <button className="primary" onClick={openCameraStream} disabled={!selectedCamera?.camera_id}><Camera size={16} />Live öffnen</button>
              <button disabled title="Command UI ist noch nicht sicher verdrahtet"><Send size={16} />Befehl senden</button>
              <button disabled title="Restart muss über Approval/AION verdrahtet werden"><RefreshCw size={16} />Neustarten</button>
              <button disabled title="OTA UI ist noch nicht sicher verdrahtet"><HardDrive size={16} />Firmware</button>
            </div>
          </div>

          <div className="eye-panel eye-aion">
            <div className="eye-panel-title"><span>KI-Assistent AION</span><Bot size={16} /></div>
            <div className="eye-aion-message">
              <div className="eye-aion-orb"><Bot size={26} /></div>
              <p>{aionAnswer ? `Intent: ${aionAnswer.intent} · Confidence ${Math.round((aionAnswer.confidence || 0) * 100)}%` : "Frag AION nach Projekten, Incidents, Geräten, Security, Providern oder Datenqualität."}</p>
            </div>
            {aionAnswer ? (
              <div className="eye-aion-answer">
                {(aionAnswer.facts || []).slice(0, 4).map((fact, index) => (
                  <div key={`${fact.label}:${index}`}><span>{fact.label}</span><strong>{String(fact.value)}</strong></div>
                ))}
                {(aionAnswer.analysis || []).slice(0, 2).map((item, index) => (
                  <p key={`analysis:${index}`}><b>Analyse</b>{item}</p>
                ))}
                {(aionAnswer.assumptions || []).slice(0, 1).map((item, index) => (
                  <p key={`assumption:${index}`} className="assumption"><b>Annahme</b>{item}</p>
                ))}
              </div>
            ) : null}
            <div className="eye-aion-input">
              <input
                value={aionInput}
                onChange={(event) => setAionInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") askAion(); }}
                placeholder="Frag AION ..."
              />
              <button onClick={askAion} disabled={aionBusy}><Send size={17} /></button>
            </div>
          </div>

          <div className={`eye-alert-strip ${systemStatus.tone}`}><Siren size={17} /><span>Systemstatus</span><strong>{systemStatus.label}</strong><Wifi size={16} /></div>
        </aside>
      </div>
    </div>
  );
}
