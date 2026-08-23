import React, { useEffect, useMemo, useRef, useState } from "react";
import { demoCredentials, getSession, signIn, signOut, touchSession } from "./lib/auth";
import { canAccess, recordAudit } from "./lib/security";
import { createRecord, flushPendingWrites, hasSupabaseConfig, listRecords, pendingWriteCount, subscribeToTable, updateRecord } from "./lib/data";
import EnhancedModuleView from "./components/EnhancedModuleView";
import DashboardLiveView from "./components/DashboardLiveView";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bike,
  Bell,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Database,
  FileClock,
  Gauge,
  LayoutDashboard,
  Link2,
  MapPin,
  MessageCircle,
  Menu,
  MoreHorizontal,
  Radio,
  Search,
  ScanLine,
  Settings,
  ShieldCheck,
  Smartphone,
  Moon,
  Sun,
  Star,
  Download,
  Users,
  Wifi,
  X,
  Zap
} from "lucide-react";
import "./styles/variables.css";
import "./styles/global.css";
import "./styles/responsive.css";
import "./styles/auth.css";
import "./styles/spec.css";
import "./styles/brand.css";
import "./styles/chrome.css";
import "./styles/device.css";
import "./styles/chat.css";
import "./styles/scanner.css";
import "./styles/notifications.css";
import "./styles/directory.css";
import "./styles/details.css";
import "./styles/errors.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    recordAudit({ action: "application error", resource: "Application", detail: error.message });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="app-error"><span className="brand-mark"><Zap size={17} fill="currentColor" /></span><h1>Something went wrong</h1><p>The workspace could not load this view. Your session is still protected.</p><button className="button primary" onClick={() => window.location.reload()}>Reload workspace</button></main>;
  }
}

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, key: "Dashboard", section: "OVERVIEW" },
  { label: "Customers", icon: Users, key: "Customers", section: "OPERATIONS" },
  { label: "Products", icon: Bike, key: "Products", section: "OPERATIONS" },
  { label: "Trackers", icon: Radio, key: "GPS Trackers", section: "OPERATIONS" },
  { label: "Live Map", icon: MapPin, key: "Live Map", section: "OPERATIONS" },
  { label: "Screening", icon: ClipboardList, key: "Screening", section: "OPERATIONS" },
  { label: "Support cases", icon: MessageCircle, key: "Support Cases", section: "OPERATIONS" },
  { label: "Payments", icon: CreditCard, key: "Payments", section: "FINANCE" },
  { label: "Accounts", icon: CircleDollarSign, key: "Finance Accounts", section: "FINANCE" },
  { label: "Users", icon: ShieldCheck, key: "Users", section: "ADMIN" },
  { label: "Alerts", icon: Bell, key: "Alerts", section: "ADMIN" },
  { label: "Reports", icon: BarChart3, key: "Reports", section: "ADMIN" },
  { label: "Settings", icon: Settings, key: "Settings", section: "SYSTEM" },
  { label: "Audit Logs", icon: FileClock, key: "Audit Logs", section: "SYSTEM" }
];

const fleet = [];
const stats = [];
const quickAddPages = new Set(["Dashboard", "Customers", "Products", "GPS Trackers", "Screening", "Support Cases", "Payments"]);

function addLabel(page) {
  if (page === "Dashboard") return "customer";
  if (page === "GPS Trackers") return "tracker";
  if (page === "Screening") return "application";
  if (page === "Support Cases") return "support case";
  return page.endsWith("s") ? page.slice(0, -1).toLowerCase() : page.toLowerCase();
}

function AppContent() {
  const [session, setSession] = useState(getSession);
  const [active, setActive] = useState(() => canAccess(getSession()?.role, "Dashboard") ? "Dashboard" : "Payments");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All status");
  const [showAdd, setShowAdd] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [systemOnline, setSystemOnline] = useState(() => navigator.onLine);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [pendingSync, setPendingSync] = useState(pendingWriteCount());
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [newRecord, setNewRecord] = useState({ name: "", email: "", notes: "", productType: "bike", otherType: "", customerId: "", trackerId: "" });
  const [productLinks, setProductLinks] = useState({ customers: [], trackers: [] });
  const [saveState, setSaveState] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("jixels_theme") || "light");
  const [recentPages, setRecentPages] = useState(() => JSON.parse(localStorage.getItem("jixels_recent_pages") || '["Dashboard"]'));
  const [favoritePages, setFavoritePages] = useState(() => JSON.parse(localStorage.getItem("jixels_favorite_pages") || "[]"));
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [installPrompt, setInstallPrompt] = useState(null);

  const filteredFleet = useMemo(() => fleet.filter((bike) => {
    const matchesQuery = `${bike.id} ${bike.customer} ${bike.location}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "All status" || bike.status === filter;
    return matchesQuery && matchesFilter;
  }), [query, filter]);

  useEffect(() => {
    if (!session) return undefined;
    const refresh = () => setSession(touchSession());
    const events = ["click", "keydown", "pointerdown"];
    events.forEach((event) => window.addEventListener(event, refresh));
    const interval = window.setInterval(() => {
      if (!touchSession()) setSession(null);
    }, 60_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, refresh));
      window.clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    const openSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  useEffect(() => {
    const updateConnection = () => setSystemOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => { window.removeEventListener("online", updateConnection); window.removeEventListener("offline", updateConnection); };
  }, []);

  useEffect(() => {
    const sync = async () => { await flushPendingWrites(); setPendingSync(pendingWriteCount()); };
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, []);
  useEffect(() => {
    if (!session || !hasSupabaseConfig) return undefined;
    const watch = (table, title, matches = (event) => event.eventType === "INSERT") => subscribeToTable(table, (event) => {
      if (!matches(event)) return;
      const record = event.new;
      setNotifications((items) => [{ id: `${table}-${record.id}`, title, detail: record.title || record.full_name || record.identifier || "New workspace activity", time: "Just now", unread: true }, ...items].slice(0, 20));
    });
    const unsubscribers = [
      watch("support_cases", "New support case"),
      watch("screening_applications", "Screening decision", (event) => event.eventType === "UPDATE" && ["approved", "declined"].includes(event.new.status) && event.old?.status !== event.new.status),
      watch("trackers", "Tracker offline", (event) => event.eventType === "UPDATE" && event.old?.is_online && !event.new.is_online),
      watch("alerts", "New alert")
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [session]);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("jixels_theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("jixels_recent_pages", JSON.stringify(recentPages)); }, [recentPages]);
  useEffect(() => { localStorage.setItem("jixels_favorite_pages", JSON.stringify(favoritePages)); }, [favoritePages]);
  useEffect(() => { const timer = window.setInterval(() => setLastUpdated(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const capture = (event) => { event.preventDefault(); setInstallPrompt(event); }; window.addEventListener("beforeinstallprompt", capture); return () => window.removeEventListener("beforeinstallprompt", capture); }, []);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(null), 3600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!showAdd || active !== "Products" || !hasSupabaseConfig) return undefined;
    let mounted = true;
    Promise.all([listRecords("customers", { pageSize: 100 }), listRecords("trackers", { pageSize: 100 })]).then(([customers, trackers]) => {
      if (mounted) setProductLinks({ customers: customers.data || [], trackers: trackers.data || [] });
    });
    return () => { mounted = false; };
  }, [showAdd, active]);

  if (!session) {
    return <LoginScreen onSignIn={setSession} />;
  }

  function choosePage(label) {
    setActive(label);
    setRecentPages((pages) => [label, ...pages.filter((page) => page !== label)].slice(0, 4));
    recordAudit({ action: "viewed", resource: label });
    setSidebarOpen(false);
  }
  function toggleFavorite(label = active) { setFavoritePages((pages) => pages.includes(label) ? pages.filter((page) => page !== label) : [...pages, label]); }
  async function installApp() { if (!installPrompt) return; await installPrompt.prompt(); setInstallPrompt(null); setToast({ tone: "success", message: "Install request opened." }); }
  async function saveNewRecord() {
    const table = active === "Products" ? "bikes" : active === "GPS Trackers" ? "trackers" : active === "Payments" ? "payments" : active === "Support Cases" ? "support_cases" : active === "Screening" ? "screening_applications" : "customers";
    const isOtherProduct = newRecord.productType === "other";
    const record = table === "bikes" ? { identifier: newRecord.name, model: newRecord.email.trim() || "Unspecified", product_type: newRecord.productType, custom_product_type: isOtherProduct ? newRecord.otherType.trim() : null, customer_id: newRecord.customerId || null } : table === "trackers" ? { identifier: newRecord.name } : table === "support_cases" ? { title: newRecord.name, notes: newRecord.notes || null, priority: "normal", created_by: session?.userId || null } : table === "screening_applications" ? { full_name: newRecord.name, email: newRecord.email || null, phone: newRecord.notes || null } : table === "payments" ? { amount: Number(newRecord.notes || 0), currency: "KES" } : { full_name: newRecord.name, email: newRecord.email || null, phone: newRecord.notes || null };
    if (!newRecord.name) { setSaveState("Enter a name or identifier."); return; }
    if (table === "bikes" && isOtherProduct && !newRecord.otherType.trim()) { setSaveState("Enter the product type."); return; }
    if (table === "bikes" && !newRecord.customerId) { setSaveState("Select the customer for this product."); return; }
    const result = await createRecord(table, record);
    if (result.error && !result.queued) { setSaveState(`Could not save: ${result.error.message}`); return; }
    if (table === "bikes" && newRecord.trackerId && result.data?.id) {
      const linkResult = await updateRecord("trackers", newRecord.trackerId, { bike_id: result.data.id });
      if (linkResult.error) { setSaveState(`Product saved, but tracker could not be linked: ${linkResult.error.message}`); return; }
    }
    recordAudit({ action: "created record", resource: active, detail: newRecord.name }); setNewRecord({ name: "", email: "", notes: "", productType: "bike", otherType: "", customerId: "", trackerId: "" }); setSaveState(""); setShowAdd(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="brand"><img className="brand-logo" src="https://www.jixels.com/assets/jixels-logo-form-ni-tenje-cropped.jpeg" alt="Jixels Form Ni Tenje" /></div>
        <button className="sidebar-collapse icon-btn" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}><Menu size={17}/></button>
        <div className="workspace-switcher"><span className="workspace-avatar">JT</span><span><strong>Jixels Technologies</strong><small>Admin workspace</small></span><ChevronDown size={15} /></div>
        <nav>
          {favoritePages.length > 0 && <><p className="nav-section">FAVORITES</p>{favoritePages.map((key) => { const item = navigation.find((entry) => entry.key === key); return item && <button className={`nav-item favorite ${active === item.key ? "active" : ""}`} key={`favorite-${item.key}`} onClick={() => choosePage(item.key)}><Star size={16} fill="currentColor"/><span>{item.label}</span></button>; })}</>}
          {navigation.filter((item) => canAccess(session.role, item.key)).map((item, index, visibleNavigation) => (
            <div key={item.section + item.label}>
              {(index === 0 || visibleNavigation[index - 1].section !== item.section) && <p className="nav-section">{item.section}</p>}
              <button className={`nav-item ${active === item.key ? "active" : ""}`} onClick={() => choosePage(item.key)}><item.icon size={17} strokeWidth={active === item.key ? 2.3 : 1.8} /><span>{item.label}</span>{item.count && <em>{item.count}</em>}{item.live && <i />}</button>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer"><div className="secure-badge"><ShieldCheck size={16} /><span><strong>{pendingSync ? `${pendingSync} change${pendingSync > 1 ? "s" : ""} waiting to sync` : "Workspace secure"}</strong><small>{pendingSync ? "Will retry when online" : "Live sync enabled"}</small></span><Check size={14} /></div><button className="profile-mini" onClick={() => setConfirmSignOut(true)}><span className="user-avatar">JM</span><span><strong>{session.name}</strong><small>{session.role}</small></span><MoreHorizontal size={16} /></button></div>
      </aside>
      {sidebarOpen && <button className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <main className="main-content">
        <header className="topbar"><button className="menu-button icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className={`topbar-actions ${mobileSearchOpen ? "mobile-search-open" : ""}`}><label className="global-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setCommandOpen(true)} placeholder="Search workspace" /></label><button className="mobile-search-button icon-btn" onClick={() => setMobileSearchOpen((open) => !open)} aria-label="Search workspace"><Search size={18}/></button><button className="icon-btn notification" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Open notifications"><Bell size={18}/>{notifications.some((item) => item.unread) && <span/>}</button><div className="top-profile"><span className="user-avatar">{session.name?.slice(0, 2).toUpperCase()}</span><span><strong>{session.name}</strong><small>{session.role}</small></span></div></div>{notificationsOpen && <NotificationPanel notifications={notifications} onClose={() => setNotificationsOpen(false)} onRead={() => setNotifications((items) => items.map((item) => ({ ...item, unread: false })))} />}</header>
        <div className="page-content">
          <section className="page-heading"><div><div className="eyebrow"><span className="pulse" />OPERATIONS</div><h1>{active === "Dashboard" ? "Dashboard Overview" : active}</h1><p>{active === "Dashboard" ? "Fleet-wide numbers and system health, at a glance." : `${active} workspace.`}</p></div><div className="heading-actions"><span className="sync-status"><span />{hasSupabaseConfig ? "Live data" : "Setup needed"}</span>{quickAddPages.has(active) && <button className="button primary" onClick={() => setShowAdd(true)}>+ Add {addLabel(active)}</button>}</div></section>
          {active === "Dashboard" ? <DashboardLiveView onStart={(page) => { choosePage(page); setShowAdd(true); }} /> : active === "Tracking & Support" ? <ModuleView title={active} setShowAdd={setShowAdd} /> : <EnhancedModuleView title={active} setShowAdd={setShowAdd} />}
          <footer className="system-footer"><span><strong>JIXELS ADMIN</strong> · Form Ni Tenje · Operations workspace</span><span className="footer-links"><button>Privacy</button><button>Security</button><button>Support</button><span>© 2026 Jixels Technologies</span></span></footer>
        </div>
      </main>
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} onUnread={() => setChatUnread((count) => count + 1)} />}
      {scannerOpen && <ScannerPanel onClose={() => setScannerOpen(false)} onResult={(value) => { setQuery(value); choosePage("GPS Trackers"); setScannerOpen(false); }} />}
      {confirmSignOut && <ConfirmDialog title="Sign out of workspace?" detail="Unsynced changes will remain queued on this device and retry the next time you sign in." confirmLabel="Sign out" onCancel={() => setConfirmSignOut(false)} onConfirm={() => { recordAudit({ action: "signed out", resource: "Authentication" }); signOut(); setSession(null); }} />}
      {commandOpen && <CommandPalette query={query} setQuery={setQuery} active={active} onClose={() => setCommandOpen(false)} onNavigate={choosePage} onChat={() => { setChatOpen(true); setChatUnread(0); setCommandOpen(false); }} onScanner={() => { setScannerOpen(true); setCommandOpen(false); }} />}
      {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">QUICK ACTION</span><h2>Add {active === "Dashboard" ? "customer" : active.slice(0, -1).toLowerCase()}</h2></div><button className="icon-btn" onClick={() => setShowAdd(false)} aria-label="Close"><X size={18} /></button></div><label>{active === "Products" ? "Product name or ID" : "Full name or identifier"}<input value={newRecord.name} onChange={(e) => setNewRecord((r) => ({ ...r, name: e.target.value }))} placeholder={active === "Products" ? "Enter a product name or ID" : "Enter a name or ID"} /></label>{active === "Products" && <><label>Product type<select value={newRecord.productType} onChange={(e) => setNewRecord((r) => ({ ...r, productType: e.target.value }))}><option value="bike">Bike</option><option value="car">Car</option><option value="asset">Asset</option><option value="device">Device</option><option value="other">Other</option></select></label>{newRecord.productType === "other" && <label>Type of product<input value={newRecord.otherType} onChange={(e) => setNewRecord((r) => ({ ...r, otherType: e.target.value }))} placeholder="Type product category" /></label>}<label>Customer<select value={newRecord.customerId} onChange={(e) => setNewRecord((r) => ({ ...r, customerId: e.target.value }))}><option value="">Select a customer</option>{productLinks.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}</select></label><label>Tracker (optional)<select value={newRecord.trackerId} onChange={(e) => setNewRecord((r) => ({ ...r, trackerId: e.target.value }))}><option value="">No tracker linked</option>{productLinks.trackers.map((tracker) => <option key={tracker.id} value={tracker.id}>{tracker.identifier}{tracker.bike_id ? " (currently linked)" : ""}</option>)}</select></label></>}<label>{active === "Products" ? "Product model" : "Email address"}<input value={newRecord.email} onChange={(e) => setNewRecord((r) => ({ ...r, email: e.target.value }))} placeholder={active === "Products" ? "Optional product model" : "name@company.com"} type={active === "Products" ? "text" : "email"} /></label>{active !== "Products" && <label>Notes / model / amount<textarea value={newRecord.notes} onChange={(e) => setNewRecord((r) => ({ ...r, notes: e.target.value }))} placeholder="Add optional notes" rows="3" /></label>}{saveState && <p className="import-message">{saveState}</p>}<div className="modal-actions"><button className="button secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="button primary" onClick={saveNewRecord}>Create record</button></div></div></div>}
    </div>
  );
}

function App() {
  return <AppErrorBoundary><AppContent /></AppErrorBoundary>;
}

function Dashboard({ filter, setFilter, filteredFleet, setShowAdd }) {
  return <>
    <section className="stat-grid">{stats.map((stat) => <article className="stat-card" key={stat.label}><div className={`stat-icon ${stat.tone}`}><stat.icon size={19} /></div><div className="stat-copy"><span>{stat.label}</span><strong>{stat.value}</strong><small className={stat.tone === "red" ? "negative" : "positive"}>{stat.tone === "red" ? <ArrowUpRight size={13} /> : <ArrowUpRight size={13} />}{stat.trend} <i>{stat.note}</i></small></div><div className="sparkline"><span /><span /><span /><span /><span /><span /><span /></div></article>)}</section>
    <section className="dashboard-grid"><article className="panel revenue-panel"><div className="panel-heading"><div><h2>Revenue overview</h2><p>Monthly recurring revenue</p></div><select defaultValue="Last 6 months"><option>Last 6 months</option><option>Last 12 months</option></select></div><div className="revenue-total"><strong>R 284,920</strong><span><ArrowUpRight size={14} /> 18.4%</span></div><div className="chart"><div className="chart-labels"><span>R 350k</span><span>R 250k</span><span>R 150k</span><span>R 50k</span></div><div className="chart-lines"><i /><i /><i /><i /><svg viewBox="0 0 700 190" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1f8a70" stopOpacity=".22" /><stop offset="1" stopColor="#1f8a70" stopOpacity="0" /></linearGradient></defs><path d="M0 153 C48 145 70 150 105 129 S166 135 205 111 S260 116 302 89 S360 106 401 78 S463 77 501 59 S555 75 595 38 S654 43 700 16 V190 H0Z" fill="url(#area)" /><path d="M0 153 C48 145 70 150 105 129 S166 135 205 111 S260 116 302 89 S360 106 401 78 S463 77 501 59 S555 75 595 38 S654 43 700 16" fill="none" stroke="#1f8a70" strokeWidth="3" /></svg></div><div className="chart-months"><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div></div></article><article className="panel alerts-panel"><div className="panel-heading"><div><h2>Needs attention</h2><p>Items requiring your review</p></div><button className="text-button">View all <ArrowUpRight size={14} /></button></div><div className="alert-list"><AlertItem icon={AlertTriangle} tone="red" title="6 trackers offline" detail="Last seen more than 24h ago" /><AlertItem icon={CreditCard} tone="orange" title="3 failed payments" detail="Review payment method issues" /><AlertItem icon={Database} tone="blue" title="API latency increased" detail="Payments API · 420ms average" /></div><button className="outline-button" onClick={() => setShowAdd(true)}>Review all alerts <ArrowUpRight size={15} /></button></article></section>
    <section className="panel fleet-panel"><div className="panel-heading fleet-heading"><div><h2>Fleet activity</h2><p>Live status across connected bikes</p></div><div className="table-tools"><label className="table-search"><Search size={15} /><input placeholder="Search fleet" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All status</option><option>Moving</option><option>Parked</option><option>Low battery</option></select><button className="icon-btn"><MoreHorizontal size={18} /></button></div></div><div className="table-wrap"><table><thead><tr><th>Bike / tracker</th><th>Customer</th><th>Last location</th><th>Battery</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{filteredFleet.map((bike) => <tr key={bike.id}><td><div className="bike-id"><span className="bike-thumb"><Bike size={16} /></span><span><strong>{bike.id}</strong><small>{bike.model}</small></span></div></td><td>{bike.customer}</td><td><span className="location"><MapPin size={14} />{bike.location}</span></td><td><span className={`battery ${bike.battery < 25 ? "low" : ""}`}><span style={{ width: `${bike.battery}%` }} /> </span><small>{bike.battery}%</small></td><td><span className={`status ${bike.status === "Moving" ? "moving" : bike.status === "Parked" ? "parked" : "warning"}`}><span />{bike.status}</span></td><td className="muted-cell">{bike.updated}</td><td><button className="icon-btn"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{filteredFleet.length === 0 && <div className="empty-state"><Search size={22} /><strong>No fleet matches</strong><span>Try a different search or status filter.</span></div>}</div></section>
  </>;
}

function AlertItem({ icon: Icon, tone, title, detail }) { return <div className="alert-item"><span className={`alert-icon ${tone}`}><Icon size={17} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={15} className="alert-arrow" /></div>; }

function NotificationPanel({ notifications, onClose, onRead }) {
  return <div className="notification-panel"><div className="notification-panel-heading"><div><span className="eyebrow">ACTIVITY CENTER</span><h2>Notifications</h2></div><button className="text-button" onClick={onRead}>Mark all read</button></div><div className="notification-list">{notifications.map((item) => <button className={`notification-item ${item.unread ? "unread" : ""}`} key={item.id} onClick={onRead}><span className="notification-icon"><Bell size={14} /></span><span><strong>{item.title}</strong><small>{item.detail}</small><time>{item.time}</time></span>{item.unread && <i />}</button>)}</div><button className="notification-footer" onClick={() => { onRead(); onClose(); }}>View alert center <ArrowUpRight size={14} /></button></div>;
}

function CommandPalette({ query, setQuery, active, onClose, onNavigate, onChat, onScanner }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const normalized = query.toLowerCase();
  const pages = navigation.filter((item) => canAccess(getSession()?.role, item.key) && item.label.toLowerCase().includes(normalized));
  const actions = [{ label: "Open support chat", icon: MessageCircle, run: onChat }, { label: "Scan product or tracker", icon: ScanLine, run: onScanner }].filter((item) => item.label.toLowerCase().includes(normalized));
  return <div className="command-backdrop" onMouseDown={onClose}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}><div className="command-search"><Search size={18}/><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a page or run an action..." aria-label="Search workspace"/><kbd>ESC</kbd></div><div className="command-results"><span className="command-label">PAGES</span>{pages.map((item) => <button className={active === item.key ? "active" : ""} key={item.key} onClick={() => { onNavigate(item.key); onClose(); }}><item.icon size={16}/><span>{item.label}</span>{active === item.key && <small>Current</small>}</button>)}<span className="command-label">QUICK ACTIONS</span>{actions.map((item) => <button key={item.label} onClick={item.run}><item.icon size={16}/><span>{item.label}</span><ArrowUpRight size={14}/></button>)}{!pages.length && !actions.length && <div className="command-empty">No workspace results for “{query}”.</div>}</div><footer><span>Use this palette anytime</span><kbd>⌘ K</kbd></footer></section></div>;
}

function ConfirmDialog({ title, detail, confirmLabel, onCancel, onConfirm }) {
  return <div className="modal-backdrop" role="presentation"><div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><div className="modal-header"><div><span className="eyebrow">CONFIRM ACTION</span><h2 id="confirm-title">{title}</h2></div></div><p>{detail}</p><div className="modal-actions"><button className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary" onClick={onConfirm}>{confirmLabel}</button></div></div></div>;
}

function ChatPanel({ onClose, onUnread }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageState, setMessageState] = useState("");
  const loadMessages = async () => {
    if (!hasSupabaseConfig) { setMessageState("Configure Supabase to use live support chat."); return; }
    const { data, error } = await listRecords("chat_messages", { pageSize: 100, order: "created_at", ascending: true });
    if (error) setMessageState("Unable to load chat messages.");
    else setMessages(data.map((item) => ({ id: item.id, author: item.author_name || "Support desk", text: item.body, time: new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), mine: item.sender_id === getSession()?.userId })));
  };
  useEffect(() => { loadMessages(); return subscribeToTable("chat_messages", (event) => { if (event.eventType === "INSERT") { const item = event.new; setMessages((current) => current.some((m) => m.id === item.id) ? current : [...current, { id: item.id, author: item.author_name || "Support desk", text: item.body, time: new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), mine: item.sender_id === getSession()?.userId }]); onUnread(); } }); }, []);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setDraft("");
    const result = await createRecord("chat_messages", { body: text, author_name: getSession()?.name || "Administrator", sender_id: getSession()?.userId || null });
    if (result.error) setMessageState(result.queued ? "Message queued until connectivity returns." : "Message could not be sent.");
    else { setMessages((current) => [...current, { id: result.data.id, author: result.data.author_name, text: result.data.body, time, mine: true }]); setMessageState(""); }
  }

  return <aside className="chat-panel" aria-label="Support chat"><div className="chat-header"><div><span className="eyebrow">SUPPORT DESK</span><h2>Operations chat</h2><small><span /> Live Supabase Realtime channel</small></div><button className="icon-btn" onClick={onClose} aria-label="Close chat"><X size={18} /></button></div><div className="chat-messages">{messages.length === 0 ? <div className="chat-empty"><MessageCircle size={22} /><strong>Start a support conversation</strong><span>Ask about trackers, payments, or a customer account.</span></div> : messages.map((message, index) => <div className={`chat-message ${message.mine ? "mine" : ""}`} key={message.id || `${message.time}-${index}`}><span className="chat-author">{message.author}</span><p>{message.text}</p><small>{message.time}</small></div>)}</div>{messageState && <p className="import-message">{messageState}</p>}<div className="chat-quick-replies"><button onClick={() => setDraft("Please check tracker status for ")}>Tracker status</button><button onClick={() => setDraft("I need help with a payment for ")}>Payment help</button></div><form className="chat-compose" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." aria-label="Message" /><button className="button primary" type="submit" aria-label="Send message"><ArrowUpRight size={16} /></button></form></aside>;
}

function exportCsv(filename, headers, rows) {
  const escapeCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  return text.trim().split(/\r?\n/).map((line) => {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += character;
    }
    cells.push(cell.trim());
    return cells;
  });
}

function DashboardSpec() {
  const [data, setData] = useState({ customers: 0, products: 0, screening: 0, alerts: [], recentProducts: [] });
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!hasSupabaseConfig) { setMessage("Connect Supabase to view live operational data."); return; }
    const [customers, products, screening, alerts] = await Promise.all([listRecords("customers", { pageSize: 1 }), listRecords("bikes", { pageSize: 5 }), listRecords("screening_applications", { pageSize: 1 }), listRecords("alerts", { pageSize: 5 })]);
    const error = customers.error || products.error || screening.error || alerts.error;
    if (error) { setMessage(`Live data unavailable: ${error.message}`); return; }
    setData({ customers: customers.count, products: products.count, screening: screening.count, alerts: alerts.data.filter((alert) => !alert.resolved_at), recentProducts: products.data });
    setMessage("");
  };
  useEffect(() => { load(); const unsubscribers = ["customers", "bikes", "screening_applications", "alerts"].map((table) => subscribeToTable(table, load)); return () => unsubscribers.forEach((unsubscribe) => unsubscribe()); }, []);
  const cards = [{ label: "Customers", value: data.customers, icon: Users, tone: "blue" }, { label: "Products", value: data.products, icon: Bike, tone: "mint" }, { label: "Screening", value: data.screening, icon: ClipboardList, tone: "orange" }, { label: "Open alerts", value: data.alerts.length, icon: Bell, tone: "red" }];
  return <><section className="spec-stat-grid">{cards.map((card) => <article className="stat-card" key={card.label}><div className={`stat-icon ${card.tone}`}><card.icon size={18}/></div><div className="stat-copy"><span>{card.label}</span><strong>{card.value}</strong><small><i>Live records</i></small></div></article>)}</section>{message && <div className="import-message" role="status">{message}</div>}<section className="dashboard-grid spec-dashboard-grid"><article className="panel"><div className="panel-heading"><div><h2>Product activity</h2><p>Most recently registered products.</p></div></div>{data.recentProducts.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Type</th><th>Status</th></tr></thead><tbody>{data.recentProducts.map((product) => <tr key={product.id}><td><strong>{product.identifier}</strong></td><td>{product.product_type === "other" ? product.custom_product_type || "Other" : product.product_type}</td><td><span className="status moving"><span/>{product.status}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><Bike size={22}/><strong>No products yet</strong><span>Products will appear here once registered.</span></div>}</article><article className="panel recent-panel"><div className="panel-heading"><div><h2>Recent alerts</h2><p>Unresolved operational alerts.</p></div></div>{data.alerts.length ? <div className="recent-alerts">{data.alerts.map((alert) => <AlertItem key={alert.id} icon={alert.severity === "critical" ? AlertTriangle : Bell} tone={alert.severity === "critical" ? "red" : alert.severity === "warning" ? "orange" : "blue"} title={alert.title} detail={alert.detail || "No additional detail"}/>)}</div> : <div className="empty-state"><Bell size={22}/><strong>No open alerts</strong><span>New alerts will appear here.</span></div>}</article></section></>;
}

function ScannerPanel({ onClose, onResult }) {
  const videoRef = useRef(null);
  const [manualId, setManualId] = useState("");
  const [cameraState, setCameraState] = useState("starting");

  useEffect(() => {
    let stream;
    let timer;
    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia || !("BarcodeDetector" in window)) { setCameraState("manual"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
        setCameraState("ready");
        timer = window.setInterval(async () => { const codes = await detector.detect(videoRef.current); if (codes[0]?.rawValue) onResult(codes[0].rawValue); }, 500);
      } catch { setCameraState("manual"); }
    }
    startScanner();
    return () => { if (timer) window.clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [onResult]);

  return <div className="scanner-backdrop" onClick={onClose}><div className="scanner-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow"><ScanLine size={13} /> IDENTIFIER SCANNER</span><h2>Scan bike or tracker</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close scanner"><X size={18} /></button></div><div className={`scanner-viewport ${cameraState}`}><video ref={videoRef} muted playsInline aria-label="Camera scanner preview" />{cameraState === "starting" && <span>Starting camera...</span>}{cameraState === "manual" && <div className="scanner-fallback"><ScanLine size={25} /><strong>Camera scanning unavailable</strong><small>Enter the bike or tracker ID below.</small></div>}{cameraState === "ready" && <span className="scanner-frame" />}</div><form className="manual-scan" onSubmit={(event) => { event.preventDefault(); if (manualId.trim()) onResult(manualId.trim()); }}><label>Manual identifier<input value={manualId} onChange={(event) => setManualId(event.target.value)} placeholder="e.g. KDX 221B or T-230" /></label><button className="button primary" type="submit">Find record</button></form><p className="scanner-note">Camera access is used only while this scanner is open. No camera footage is saved.</p></div></div>;
}

function LoginScreen({ onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    const result = await signIn(email, password);
    if (result.error) setError(result.error);
    else { recordAudit({ action: "signed in", resource: "Authentication" }); onSignIn(result.data); }
    setLoading(false);
  }

  function useDemoAccount() {
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
    setError("");
  }

  return <main className="login-screen"><div className="login-brand"><img className="login-logo" src="https://www.jixels.com/assets/jixels-logo-form-ni-tenje-cropped.jpeg" alt="Jixels Form Ni Tenje" /></div><form className="login-card" onSubmit={submit}><div className="eyebrow"><ShieldCheck size={13} /> SECURE ADMIN ACCESS</div><h1>Welcome back</h1><p>Sign in to manage your workspace.</p><label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@company.com" autoComplete="email" required /></label><label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Enter your password" autoComplete="current-password" required /></label>{error && <div className="login-error"><AlertTriangle size={15} />{error}</div>}<button className="button primary login-button" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button><button className="demo-button" type="button" onClick={useDemoAccount}>Use demo account</button></form><small className="login-footer">Jixels Technologies</small></main>;
}

function ModuleView({ setShowAdd }) { return <TrackingSupport setShowAdd={setShowAdd} />; }

function TrackingSupport({ setShowAdd }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(fleet[0].id);
  const [notice, setNotice] = useState("");
  const matches = fleet.filter((bike) => `${bike.id} ${bike.customer} ${bike.location}`.toLowerCase().includes(query.toLowerCase()));
  const selected = fleet.find((bike) => bike.id === selectedId) || matches[0] || fleet[0];
  async function openCase() { const result = await createRecord("alerts", { kind: "support_case", title: `Support case: ${selected.id}`, detail: `Opened from tracking support for ${selected.customer}`, severity: "info" }); setNotice(result.queued ? "Support case queued for sync." : result.error ? "Could not open case. Check connectivity." : "Support case opened and added to Alerts."); recordAudit({ action: "opened support case", resource: selected.id }); }
  return <section className="support-layout"><article className="panel support-search-panel"><div className="panel-heading"><div><h2>Tracking &amp; Support</h2><p>Find a bike, inspect its last status, and open a case without leaving the workspace.</p></div><span className="sync-status"><span />Live</span></div><label className="support-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bike, tracker or customer" /><kbd>⌘ K</kbd></label><div className="support-shortlist"><span className="shortlist-label">FLEET SHORTLIST · {matches.length} MATCHES</span>{matches.map((bike) => <button key={bike.id} className={`shortlist-item ${selected.id === bike.id ? "selected" : ""}`} onClick={() => setSelectedId(bike.id)}><Bike size={15} /><span><strong>{bike.id}</strong><small>{bike.customer} · {bike.status}</small></span><i className={bike.status === "Low battery" ? "offline" : ""} /></button>)}{!matches.length && <div className="empty-state"><Search size={20}/><strong>No bike found</strong><span>Try an ID, customer, or location.</span></div>}</div></article><article className="panel selected-bike-panel"><div className="selected-bike-header"><div><span className="eyebrow">SELECTED BIKE</span><h2>{selected.id}</h2><p>Owner <strong>{selected.customer}</strong> · {selected.model}</p></div><span className="online-pill"><span />{selected.status}</span></div><div className="bike-facts"><div><span>Last seen</span><strong>{selected.updated}</strong></div><div><span>Battery</span><strong>{selected.battery}%</strong></div><div><span>Location</span><strong className="on-track">{selected.location}</strong></div></div><div className="support-actions"><button className="button primary" onClick={openCase}>Open support case</button><button className="button secondary" onClick={() => setShowAdd(true)}>Add record</button><button className="button secondary" onClick={() => navigator.clipboard?.writeText(selected.id).then(() => setNotice(`${selected.id} copied.`))}>Copy ID</button></div>{notice && <div className="import-message" role="status">{notice}</div>}<div className="support-note"><ShieldCheck size={16} /><span><strong>Fast, focused support context.</strong><small>Live tracker details and case handling remain one click away.</small></span></div></article></section>;
}

export default App;
