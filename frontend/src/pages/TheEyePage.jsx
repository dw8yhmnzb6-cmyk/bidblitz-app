import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
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

const MOCK_DEVICES = [
  { device_id: "AION-KS-000145", device_type: "camera", connection_status: "online", city: "Prishtina", country: "XK", battery_percent: 87, firmware_version: "1.0.4", location: { lat: 42.6629, lng: 21.1655 } },
  { device_id: "POWER-KS-0032", device_type: "power_station", connection_status: "offline", city: "Prizren", country: "XK", battery_percent: 42, firmware_version: "1.0.2", location: { lat: 42.2139, lng: 20.7397 } },
  { device_id: "SCOOTER-KS-118", device_type: "scooter", connection_status: "online", city: "Prishtina", country: "XK", battery_percent: 64, firmware_version: "2.2.1", location: { lat: 42.6557, lng: 21.1598 } },
];

const LAYERS = [
  ["Kameras", Camera, 177721, "cyan"],
  ["Flugzeuge", Plane, 12438, "blue"],
  ["Schiffe", Ship, 39217, "amber"],
  ["Satelliten", Satellite, 2914, "violet"],
  ["Wetter", CloudSun, null, "sky"],
  ["Feuer", Flame, 342, "red"],
  ["Erdbeben", Activity, 12, "orange"],
  ["Kraftwerke", Zap, 34901, "yellow"],
  ["BidBlitz Geräte", Cpu, 1328, "green"],
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
  const normalized = status === "online" ? "online" : status === "warning" ? "warning" : "offline";
  return <span className={`eye-status eye-status--${normalized}`}><span />{normalized === "online" ? "Online" : normalized === "warning" ? "Warnung" : "Offline"}</span>;
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
  const [devices, setDevices] = useState(MOCK_DEVICES);
  const [selectedId, setSelectedId] = useState(MOCK_DEVICES[0].device_id);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeLayers, setActiveLayers] = useState(() => Object.fromEntries(LAYERS.map(([name]) => [name, true])));
  const [tab, setTab] = useState("Übersicht");
  const [liveConnected, setLiveConnected] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [locationSummary, setLocationSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/the-eye/admin/map/devices", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.devices) && data.devices.length) {
          setDevices(data.devices);
          setSelectedId((current) => data.devices.some((d) => d.device_id === current) ? current : data.devices[0].device_id);
        }
      } catch {
        // Preview remains useful before a real device is registered.
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

    if (result?.entity_type === "device" && result?.entity_id) {
      setSelectedId(result.entity_id);
    }

    const city = result?.city || (result?.entity_type === "city" ? result?.title : null);
    if (!city) return;

    try {
      const params = new URLSearchParams({ city });
      if (result?.country) params.set("country", result.country);
      const res = await fetch(`/api/the-eye/admin/location-summary?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLocationSummary(data);
    } catch {
      setLocationSummary(null);
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

      socket.onopen = () => setLiveConnected(true);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const payload = message?.payload || {};

          if (message.type === "device.registered" && payload.device_id) {
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
          }
        } catch {
          // Ignore malformed realtime messages; REST data remains authoritative.
        }
      };
      socket.onclose = () => {
        setLiveConnected(false);
        if (!stopped) retryTimer = window.setTimeout(connect, 2000);
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

  const selected = useMemo(
    () => devices.find((d) => d.device_id === selectedId) || devices[0],
    [devices, selectedId]
  );

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => [d.device_id, d.device_type, d.city, d.country].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [devices, query]);

  const toggleLayer = (name) => setActiveLayers((prev) => ({ ...prev, [name]: !prev[name] }));

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
          <button><Bell size={18} />Warnungen</button>
          <button><Bot size={18} />AION</button>
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
                    {result.entity_type === "device" ? <Cpu size={16} /> : <MapPin size={16} />}
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
            <div className="eye-segment"><button className="active">Welt</button><button>Meine Geräte</button></div>
          </section>

          <section className="eye-layer-list">
            <div className="eye-section-title"><span>Layer</span><span className="eye-count">{LAYERS.filter(([n]) => activeLayers[n]).length}</span></div>
            {LAYERS.map(([name, Icon, count, tone]) => (
              <button className="eye-layer-row" key={name} onClick={() => toggleLayer(name)}>
                <span className={`eye-layer-icon eye-tone-${tone}`}><Icon size={17} /></span>
                <span className="eye-layer-name">{name}</span>
                {count ? <span className="eye-layer-count">{count.toLocaleString("de-DE")}</span> : null}
                <span className={`eye-switch ${activeLayers[name] ? "on" : ""}`}><span /></span>
              </button>
            ))}
          </section>

          <section>
            <div className="eye-section-title"><span>Geräte</span><span>{loading ? "…" : devices.length}</span></div>
            <div className="eye-device-mini-list">
              {filteredDevices.slice(0, 6).map((device) => {
                const Icon = ICONS[device.device_type] || Cpu;
                return (
                  <button key={device.device_id} className={selectedId === device.device_id ? "selected" : ""} onClick={() => setSelectedId(device.device_id)}>
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
            </section>
          ) : null}

          <section className="eye-world">
            <div className="eye-world-grid" />
            <div className="eye-globe">
              <div className="eye-globe-shine" />
              <div className="eye-orbit orbit-a" />
              <div className="eye-orbit orbit-b" />
              <div className="eye-world-label label-eu">EUROPA</div>
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

            <div className="eye-map-toolbar">
              <button>+</button><button>−</button><button><Layers3 size={17} /></button><button>3D</button>
            </div>

            <div className="eye-live-clock"><span><Camera size={15} /> Live</span><strong>UTC+2</strong></div>
          </section>

          <section className="eye-metrics">
            <MetricCard icon={Camera} value="177.721" label="Kameras" tone="cyan" />
            <MetricCard icon={Plane} value="12.438" label="Flugzeuge" tone="blue" />
            <MetricCard icon={Ship} value="39.217" label="Schiffe" tone="amber" />
            <MetricCard icon={Cpu} value={devices.length.toLocaleString("de-DE")} label="Eigene Geräte" tone="green" />
            <MetricCard icon={Flame} value="342" label="Aktive Feuer" tone="red" />
            <MetricCard icon={Activity} value="12" label="Erdbeben" tone="orange" />
          </section>

          <section className="eye-bottom-grid">
            <div className="eye-panel">
              <div className="eye-panel-title"><span>Letzte Ereignisse</span><RefreshCw size={15} /></div>
              <div className="eye-events">
                <div><i className="cyan" /><span>23:10</span><strong>Kamera online</strong><small>AION-KS-000145 · Prishtina</small></div>
                <div><i className="blue" /><span>23:08</span><strong>Flugzeug über Gebiet</strong><small>10.668 m</small></div>
                <div><i className="amber" /><span>23:03</span><strong>Schiff erkannt</strong><small>Adria</small></div>
                <div><i className="red" /><span>22:59</span><strong>Feuer-Warnung</strong><small>Region Balkan</small></div>
                <div><i className="orange" /><span>22:54</span><strong>Gerät offline</strong><small>POWER-KS-0032 · Prizren</small></div>
              </div>
            </div>

            <div className="eye-panel eye-analysis">
              <div className="eye-panel-title"><span>Weltkarte Analyse</span><Activity size={15} /></div>
              <div className="eye-mini-map">
                <span className="hotspot hs1" /><span className="hotspot hs2" /><span className="hotspot hs3" />
                <div className="eye-mini-grid" />
              </div>
              <div className="eye-analysis-stats">
                <span><Camera size={14} />177.721</span><span><Plane size={14} />12.438</span><span><Ship size={14} />39.217</span>
              </div>
            </div>
          </section>
        </main>

        <aside className="eye-rightbar">
          <div className="eye-camera-card">
            <div className="eye-camera-image">
              <div className="eye-camera-sky" />
              <div className="eye-camera-city" />
              <span className="eye-camera-live"><span />LIVE</span>
              <strong>Prishtina – City Center</strong>
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
              <div><span>Letzte Verbindung</span><strong>{selected?.last_seen_at ? new Date(selected.last_seen_at).toLocaleTimeString("de-DE") : "Preview"}</strong></div>
            </div>

            <div className="eye-actions">
              <button className="primary"><Camera size={16} />Live öffnen</button>
              <button><Send size={16} />Befehl senden</button>
              <button><RefreshCw size={16} />Neustarten</button>
              <button><HardDrive size={16} />Firmware</button>
            </div>
          </div>

          <div className="eye-panel eye-aion">
            <div className="eye-panel-title"><span>KI-Assistent AION</span><Bot size={16} /></div>
            <div className="eye-aion-message">
              <div className="eye-aion-orb"><Bot size={26} /></div>
              <p>Hallo. Ich überwache The Eye. Frag mich nach Geräten, Kameras, Verkehr, Flügen oder Warnungen.</p>
            </div>
            <div className="eye-aion-input"><input placeholder="Sprich mit AION ..." /><button><Send size={17} /></button></div>
          </div>

          <div className="eye-alert-strip"><Siren size={17} /><span>Systemstatus</span><strong>Alle Kerndienste online</strong><Wifi size={16} /></div>
        </aside>
      </div>
    </div>
  );
}
