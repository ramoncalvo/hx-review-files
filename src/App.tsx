import { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng, toSvg } from 'html-to-image';
import './App.css';
import JsonNode from './components/JsonNode';
import CompareView from './components/CompareView';
import ExcelView from './components/ExcelView';
import WelcomeModal from './components/WelcomeModal';
import { jsonToGraph } from './utils/jsonToGraph';
import type { NodeData } from './utils/jsonToGraph';
import { findKeyRange, getPathAtCursor, scrollTextareaToSelection } from './utils/jsonSync';

type Tab = 'viewer' | 'compare' | 'schema';

const nodeTypes = { jsonNode: JsonNode };

const SAMPLE_JSON = JSON.stringify(
  {
    application: {
      id: "app-9f3c2a1b",
      version: "4.12.3",
      environment: "production",
      buildDate: "2026-10-06T08:00:00Z",
      flags: {
        betaFeatures: false,
        maintenanceMode: false,
        analyticsEnabled: true,
        darkModeDefault: true,
        multiTenancy: true,
      },
    },
    organization: {
      id: "org-00421",
      name: "Acme Corporation",
      plan: "enterprise",
      createdAt: "2019-03-14T10:22:00Z",
      billing: {
        cycle: "annual",
        currency: "USD",
        nextRenewal: "2027-03-14",
        seats: 250,
        usedSeats: 187,
        overagePolicy: "block",
        paymentMethod: {
          type: "card",
          last4: "4242",
          brand: "Visa",
          expiresMonth: 11,
          expiresYear: 2028,
        },
      },
      address: {
        street: "1234 Innovation Drive",
        suite: "Suite 500",
        city: "San Francisco",
        state: "CA",
        zip: "94107",
        country: "US",
        coordinates: {
          lat: 37.7749,
          lng: -122.4194,
        },
      },
      contacts: {
        primary: {
          name: "Jordan Lee",
          email: "jordan.lee@acme.com",
          phone: "+1-415-555-0101",
          role: "CTO",
        },
        billing: {
          name: "Morgan Chen",
          email: "billing@acme.com",
          phone: "+1-415-555-0102",
          role: "CFO",
        },
        support: {
          name: "Acme Support Team",
          email: "support@acme.com",
          slackChannel: "#platform-support",
        },
      },
    },
    users: [
      {
        id: "usr-001",
        username: "alice_wonder",
        email: "alice@acme.com",
        fullName: "Alice Wonderland",
        avatar: "https://cdn.example.com/avatars/alice.png",
        active: true,
        verified: true,
        createdAt: "2021-06-01T09:00:00Z",
        lastLogin: "2026-10-05T14:32:11Z",
        role: "admin",
        permissions: ["read", "write", "delete", "manage_users", "billing"],
        preferences: {
          theme: "dark",
          language: "en",
          timezone: "America/Los_Angeles",
          notifications: {
            email: true,
            push: true,
            slack: true,
            digest: "daily",
          },
          dashboard: {
            layout: "grid",
            defaultView: "overview",
            widgets: ["metrics", "alerts", "activity", "deployments"],
          },
        },
        mfa: {
          enabled: true,
          method: "totp",
          backupCodesRemaining: 6,
        },
        sessions: [
          { id: "sess-aaa1", ip: "203.0.113.42", userAgent: "Mozilla/5.0", createdAt: "2026-10-05T14:32:11Z", expiresAt: "2026-10-19T14:32:11Z" },
          { id: "sess-aaa2", ip: "198.51.100.7", userAgent: "Claude Code CLI/1.0", createdAt: "2026-10-04T10:00:00Z", expiresAt: "2026-10-18T10:00:00Z" },
        ],
      },
      {
        id: "usr-002",
        username: "bob_builder",
        email: "bob@acme.com",
        fullName: "Bob Builder",
        active: true,
        verified: true,
        createdAt: "2022-01-15T08:30:00Z",
        lastLogin: "2026-10-06T07:12:00Z",
        role: "developer",
        permissions: ["read", "write"],
        preferences: {
          theme: "light",
          language: "en",
          timezone: "Europe/London",
          notifications: { email: true, push: false, slack: true, digest: "weekly" },
        },
        mfa: { enabled: false, method: null, backupCodesRemaining: 0 },
      },
    ],
    services: {
      api: {
        baseUrl: "https://api.acme.com/v4",
        rateLimit: { requestsPerMinute: 1000, burstSize: 200 },
        authentication: { method: "bearer", tokenTtlSeconds: 3600, refreshEnabled: true },
        cors: { allowedOrigins: ["https://app.acme.com", "https://admin.acme.com"], allowCredentials: true },
        endpoints: {
          health: "/health",
          metrics: "/metrics",
          graphql: "/graphql",
          rest: "/rest/v1",
          webhooks: "/webhooks",
        },
      },
      database: {
        primary: {
          engine: "postgresql",
          version: "16.2",
          host: "db-primary.internal",
          port: 5432,
          name: "acme_prod",
          poolMin: 5,
          poolMax: 50,
          ssl: true,
          replication: { enabled: true, replicas: 2, syncMode: "async" },
        },
        cache: {
          engine: "redis",
          version: "7.2",
          host: "cache.internal",
          port: 6379,
          maxMemoryMb: 4096,
          evictionPolicy: "allkeys-lru",
          cluster: { enabled: true, shards: 3 },
        },
        search: {
          engine: "elasticsearch",
          version: "8.13",
          host: "search.internal",
          port: 9200,
          indices: ["users", "documents", "events", "audit_logs"],
        },
      },
      storage: {
        provider: "s3",
        region: "us-west-2",
        buckets: {
          assets: { name: "acme-assets-prod", public: true, cdn: "https://cdn.acme.com" },
          uploads: { name: "acme-uploads-prod", public: false, maxSizeMb: 500 },
          backups: { name: "acme-backups-prod", public: false, retentionDays: 90, encrypted: true },
        },
      },
      messaging: {
        provider: "kafka",
        brokers: ["kafka-1.internal:9092", "kafka-2.internal:9092", "kafka-3.internal:9092"],
        topics: {
          events: { partitions: 12, replicationFactor: 3, retentionHours: 168 },
          notifications: { partitions: 6, replicationFactor: 3, retentionHours: 48 },
          audit: { partitions: 3, replicationFactor: 3, retentionHours: 720 },
        },
        consumerGroups: ["api-consumers", "analytics-consumers", "audit-consumers"],
      },
    },
    deployments: [
      {
        id: "dep-20261006-001",
        status: "success",
        environment: "production",
        version: "4.12.3",
        previousVersion: "4.12.2",
        startedAt: "2026-10-06T04:00:00Z",
        completedAt: "2026-10-06T04:17:34Z",
        durationSeconds: 1054,
        triggeredBy: "usr-001",
        commitSha: "a3f8c2d9e1b5047f6c8d2a1e3b9f7c4d2e8a1b3c",
        commitMessage: "feat: add real-time collaboration to document editor",
        pipeline: {
          stages: [
            { name: "build", status: "success", durationSeconds: 142 },
            { name: "test", status: "success", durationSeconds: 389, coverage: 91.4 },
            { name: "security-scan", status: "success", durationSeconds: 67, vulnerabilities: 0 },
            { name: "deploy-canary", status: "success", durationSeconds: 210, trafficPercent: 5 },
            { name: "deploy-full", status: "success", durationSeconds: 246, trafficPercent: 100 },
          ],
        },
        rollback: { available: true, expiresAt: "2026-10-13T04:17:34Z" },
      },
    ],
    monitoring: {
      uptime: { last24h: 99.98, last7d: 99.95, last30d: 99.93 },
      latency: { p50Ms: 42, p95Ms: 118, p99Ms: 287 },
      errors: { rate1m: 0.002, rate5m: 0.0018, rate15m: 0.0021 },
      alerts: {
        active: 1,
        items: [
          {
            id: "alert-7712",
            severity: "warning",
            title: "Search index lag > 30s",
            service: "elasticsearch",
            firedAt: "2026-10-06T07:45:00Z",
            assignee: "usr-002",
            silenced: false,
          },
        ],
      },
      dashboards: {
        overview: "https://grafana.internal/d/overview",
        apiLatency: "https://grafana.internal/d/api-latency",
        dbHealth: "https://grafana.internal/d/db-health",
        deployments: "https://grafana.internal/d/deployments",
      },
    },
    featureFlags: {
      newEditor: { enabled: true, rolloutPercent: 100, enabledFor: ["all"] },
      aiAssistant: { enabled: true, rolloutPercent: 50, enabledFor: ["enterprise", "pro"] },
      offlineMode: { enabled: false, rolloutPercent: 0, enabledFor: [] },
      newBilling: { enabled: true, rolloutPercent: 20, enabledFor: ["beta_testers"] },
      collaborationV2: { enabled: true, rolloutPercent: 100, enabledFor: ["all"] },
    },
    audit: {
      retentionDays: 365,
      lastExportAt: "2026-10-05T00:00:00Z",
      recentEvents: [
        { ts: "2026-10-06T07:50:00Z", actor: "usr-001", action: "user.login", resource: "session", ip: "203.0.113.42", result: "success" },
        { ts: "2026-10-06T07:48:00Z", actor: "usr-001", action: "flag.update", resource: "featureFlags.aiAssistant", ip: "203.0.113.42", result: "success" },
        { ts: "2026-10-06T06:00:00Z", actor: "system", action: "backup.create", resource: "database.primary", ip: "10.0.0.1", result: "success" },
        { ts: "2026-10-06T04:17:34Z", actor: "usr-001", action: "deploy.complete", resource: "dep-20261006-001", ip: "203.0.113.42", result: "success" },
      ],
    },
  },
  null,
  2
);

function FlowCanvas({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
}: {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodeClick: NodeMouseHandler;
}) {
  useReactFlow();

  // Apply selected flag without mutating original nodes
  const displayNodes = useMemo(() =>
    nodes.map(n => ({ ...n, selected: n.id === selectedNodeId })),
    [nodes, selectedNodeId]
  );

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      onNodesChange={() => {}}
      onEdgesChange={() => {}}
      onNodeClick={onNodeClick}
      minZoom={0.05}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} color="#21262d" gap={20} size={1} />
      <Controls />
      <MiniMap
        nodeColor="#21262d"
        maskColor="rgba(13,17,23,0.8)"
        style={{ bottom: 16, right: 16 }}
      />
    </ReactFlow>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);

  const attempt = () => {
    if (input === (import.meta.env.VITE_APP_PASSWORD ?? '')) {
      onUnlock();
    } else {
      setWrong(true);
      setInput('');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
        padding: '36px 32px', width: 320, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#58a6ff', marginBottom: 4 }}>
            Ramon <span style={{ color: '#f78166' }}>JSON Viewer</span>
          </div>
          <div style={{ fontSize: 12, color: '#8b949e' }}>Enter password to continue</div>
        </div>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={e => { setInput(e.target.value); setWrong(false); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Password"
          style={{
            background: '#0d1117', border: `1px solid ${wrong ? '#f85149' : '#30363d'}`,
            borderRadius: 6, padding: '8px 12px', color: '#e6edf3',
            fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        {wrong && (
          <div style={{ fontSize: 12, color: '#f85149', marginTop: -8 }}>Incorrect password</div>
        )}
        <button
          onClick={attempt}
          style={{
            background: '#238636', border: '1px solid #2ea043', borderRadius: 6,
            color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 0',
            cursor: 'pointer', width: '100%',
          }}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('viewer');
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const graph = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText);
      setError(null);
      return jsonToGraph(parsed);
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [jsonText]);

  // ── Node click → highlight in textarea ──────────────────────────
  const handleNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const data = node.data as NodeData;
    setSelectedNodeId(node.id);
    const range = findKeyRange(jsonText, data.path);
    if (range && textareaRef.current) {
      scrollTextareaToSelection(textareaRef.current, range.start, range.end);
    }
  }, [jsonText]);

  // ── Textarea cursor → highlight node ────────────────────────────
  const handleTextareaCursor = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !graph) return;
    const cursor = el.selectionStart;
    const path = getPathAtCursor(el.value, cursor);
    if (!path.length) { setSelectedNodeId(null); return; }

    // Find the node whose path matches the deepest common prefix
    let best: Node<NodeData> | null = null;
    let bestScore = -1;
    for (const node of graph.nodes) {
      const np = (node.data as NodeData).path;
      let score = 0;
      for (let i = 0; i < np.length && i < path.length; i++) {
        if (np[i] === path[i]) score++;
        else break;
      }
      if (score > bestScore || (score === bestScore && np.length <= path.length)) {
        bestScore = score;
        best = node;
      }
    }
    if (best && bestScore > 0) setSelectedNodeId(best.id);
    else setSelectedNodeId(null);
  }, [graph]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJsonText(text);
    } catch {
      // silently fail if clipboard not available
    }
  }, []);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [jsonText]);

  const handleClear = useCallback(() => {
    setJsonText('');
    setError(null);
  }, []);

  const exportPng = useCallback(async () => {
    const el = canvasRef.current?.querySelector('.react-flow__renderer') as HTMLElement | null;
    if (!el) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: '#0d1117',
        pixelRatio: 2,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      a.download = `json-view-${ts}.png`;
      a.click();
    } finally {
      setExporting(false);
      setShowExport(false);
    }
  }, []);

  const exportSvg = useCallback(async () => {
    const el = canvasRef.current?.querySelector('.react-flow__renderer') as HTMLElement | null;
    if (!el) return;
    setExporting(true);
    try {
      const dataUrl = await toSvg(el, {
        backgroundColor: '#0d1117',
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      a.download = `json-view-${ts}.svg`;
      a.click();
    } finally {
      setExporting(false);
      setShowExport(false);
    }
  }, []);

  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = graph?.edges.length ?? 0;

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="app">
      {/* ── Toolbar ── */}
      <div className="toolbar">
        <span className="toolbar-logo">Ramon<span> JSON Viewer</span></span>
        <div className="toolbar-sep" />

        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'viewer' ? 'active' : ''}`}
            onClick={() => setActiveTab('viewer')}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13 }}>
              <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Z"/>
            </svg>
            Viewer
          </button>
          <button
            className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13 }}>
              <path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4.5a.75.75 0 0 0 0 1.5h2.75v2.75a.75.75 0 0 0 1.5 0V6.5h2.75a.75.75 0 0 0 0-1.5H8.75ZM1.5 11.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1-.75-.75Z"/>
            </svg>
            Compare
          </button>
          <button
            className={`tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
            onClick={() => setActiveTab('schema')}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13 }}>
              <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v3.5A1.75 1.75 0 0 1 14.25 7H1.75A1.75 1.75 0 0 1 0 5.25Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25Zm-1.75 7.5C0 8.784.784 8 1.75 8h12.5C15.216 8 16 8.784 16 9.75v3.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25Z"/>
            </svg>
            Schema
          </button>
        </div>

        {activeTab === 'viewer' && <div className="toolbar-sep" />}

        {activeTab === 'viewer' && (
          <button className="toolbar-btn" onClick={handlePaste} title="Paste from clipboard">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.75 1a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-3a.75.75 0 0 0-.75-.75h-4.5Zm.75 3V2.5h3V4h-3Zm-2.874-.467a.75.75 0 0 0-.752-1.298A1.75 1.75 0 0 0 2 4.75v8.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0 0 14 13.25v-8.5a1.75 1.75 0 0 0-.874-1.515.75.75 0 1 0-.752 1.298.25.25 0 0 1 .126.217v8.5a.25.25 0 0 1-.25.25h-8.5a.25.25 0 0 1-.25-.25v-8.5a.25.25 0 0 1 .126-.217Z"/>
            </svg>
            Paste
          </button>
        )}

        {activeTab === 'viewer' && (
          <button className="toolbar-btn" onClick={handleFormat} title="Format JSON">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v3.5A1.75 1.75 0 0 1 14.25 7H1.75A1.75 1.75 0 0 1 0 5.25Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25Zm-1.75 7.5C0 8.784.784 8 1.75 8h12.5C15.216 8 16 8.784 16 9.75v3.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25Z"/>
            </svg>
            Format
          </button>
        )}

        {activeTab === 'viewer' && (
          <button className="toolbar-btn danger" onClick={handleClear} title="Clear editor">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.576l-.66-6.6a.75.75 0 1 1 1.492-.149ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/>
            </svg>
            Clear
          </button>
        )}

        {activeTab === 'viewer' && <div className="toolbar-sep" />}

        {activeTab === 'viewer' && (
          <button
            className="toolbar-btn primary"
            onClick={() => setShowExport(true)}
            disabled={!graph || exporting}
            title="Export to image"
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"/>
              <path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.97a.749.749 0 1 1 1.06 1.061l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.061l1.97 1.97Z"/>
            </svg>
            Export
          </button>
        )}

        {activeTab === 'viewer' && graph && (
          <span className="toolbar-info">
            {nodeCount} nodes · {edgeCount} edges
          </span>
        )}
      </div>

      {/* ── Compare tab ── */}
      {activeTab === 'compare' && <CompareView />}

      {/* ── Schema tab ── */}
      {activeTab === 'schema' && <ExcelView jsonText={jsonText} />}

      {/* ── Main workspace ── */}
      <div className="workspace" style={{ display: activeTab === 'viewer' ? 'flex' : 'none' }}>
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">JSON Input</div>
          <textarea
            ref={textareaRef}
            className="json-textarea"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            onClick={handleTextareaCursor}
            onKeyUp={handleTextareaCursor}
            placeholder={'Paste your JSON here…\n\n{\n  "key": "value"\n}'}
            spellCheck={false}
          />
          {error && <div className="error-bar">⚠ {error}</div>}
          <div className="sidebar-actions">
            <label className="toolbar-btn" style={{ justifyContent: 'center' }}>
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 14, height: 14 }}>
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/>
              </svg>
              Load file
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setJsonText(ev.target?.result as string ?? '');
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {/* Canvas */}
        <div className="canvas-area" ref={canvasRef}>
          {graph ? (
            <ReactFlowProvider>
              <FlowCanvas
                nodes={graph.nodes}
                edges={graph.edges}
                selectedNodeId={selectedNodeId}
                onNodeClick={handleNodeClick}
              />
            </ReactFlowProvider>
          ) : (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
              </svg>
              <p>Paste valid JSON on the left to visualize it</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Welcome modal ── */}
      {showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}

      {/* ── Export modal ── */}
      {showExport && (
        <div className="export-overlay" onClick={() => setShowExport(false)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Export graph</h3>

            <div className="export-option" onClick={exportPng}>
              <div className="export-option-icon">🖼</div>
              <div className="export-option-info">
                <strong>PNG Image</strong>
                <span>High-resolution raster image (2×)</span>
              </div>
            </div>

            <div className="export-option" onClick={exportSvg}>
              <div className="export-option-icon">✦</div>
              <div className="export-option-info">
                <strong>SVG Vector</strong>
                <span>Scalable, perfect for docs &amp; review</span>
              </div>
            </div>

            <button className="modal-close" onClick={() => setShowExport(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
