GLOBAL_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
    --bg-primary: #0a0e14;
    --bg-secondary: #111820;
    --bg-tertiary: #161d27;
    --bg-elevated: #1a2332;
    --border-subtle: #1e2a3a;
    --border-medium: #2a3a4e;
    --text-primary: #e6edf3;
    --text-secondary: #8b949e;
    --text-muted: #6e7681;
    --accent-green: #3fb950;
    --accent-green-dim: rgba(63, 185, 80, 0.15);
    --accent-blue: #58a6ff;
    --accent-blue-dim: rgba(88, 166, 255, 0.12);
    --accent-orange: #d29922;
    --accent-orange-dim: rgba(210, 153, 34, 0.12);
    --accent-red: #f85149;
    --accent-red-dim: rgba(248, 81, 73, 0.12);
    --accent-purple: #bc8cff;
    --accent-purple-dim: rgba(188, 140, 255, 0.12);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.35);
}

.stApp {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary) !important;
}

/* ---- Typography ---- */
.app-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0 0.25rem 0;
}
.app-header .logo {
    font-size: 1.75rem;
}
.app-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
}
.app-subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0 0 1.5rem 0;
    font-weight: 400;
}

/* ---- Mode Tabs ---- */
.mode-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 1.5rem;
}
.mode-tab {
    flex: 1;
    padding: 0.85rem 1rem;
    text-align: center;
    font-weight: 500;
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
    text-decoration: none;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    letter-spacing: 0.01em;
}
.mode-tab:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
}
.mode-tab.active {
    color: var(--accent-green);
    border-bottom-color: var(--accent-green);
    font-weight: 600;
}
.mode-tab .tab-label { display: block; }
.mode-tab .tab-desc {
    display: block;
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-top: 0.2rem;
}
.mode-tab.active .tab-desc { color: var(--text-secondary); }

/* ---- Cards ---- */
.card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    margin-bottom: 1rem;
}
.card-header {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
}

/* ---- Pipeline Steps ---- */
.pipeline-steps {
    display: flex;
    gap: 0;
    margin: 1.25rem 0;
    overflow-x: auto;
    padding-bottom: 0.25rem;
}
.pipeline-step {
    flex: 1;
    min-width: 0;
    padding: 0.6rem 0.5rem;
    text-align: center;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--text-muted);
    border-bottom: 2px solid var(--border-subtle);
    transition: all 0.25s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pipeline-step.active {
    color: var(--accent-blue);
    border-bottom-color: var(--accent-blue);
    font-weight: 600;
}
.pipeline-step.done {
    color: var(--accent-green);
    border-bottom-color: var(--accent-green);
}
.pipeline-step.failed {
    color: var(--accent-red);
    border-bottom-color: var(--accent-red);
}
.pipeline-step .step-icon {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.2rem;
}

/* ---- Status Badges ---- */
.badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
}
.badge-pass { background: var(--accent-green-dim); color: var(--accent-green); border: 1px solid rgba(63,185,80,0.25); }
.badge-fail { background: var(--accent-red-dim); color: var(--accent-red); border: 1px solid rgba(248,81,73,0.25); }
.badge-warn { background: var(--accent-orange-dim); color: var(--accent-orange); border: 1px solid rgba(210,153,34,0.25); }
.badge-info { background: var(--accent-blue-dim); color: var(--accent-blue); border: 1px solid rgba(88,166,255,0.25); }
.badge-running { background: var(--accent-purple-dim); color: var(--accent-purple); border: 1px solid rgba(188,140,255,0.25); }

/* ---- Metric Cards ---- */
.metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0;
}
.metric-item {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 0.85rem;
    text-align: center;
}
.metric-item .value {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--accent-green);
    line-height: 1;
}
.metric-item .label {
    font-size: 0.65rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-top: 0.35rem;
}

/* ---- Event Log (Agentic) ---- */
.event-item {
    border-left: 3px solid var(--border-medium);
    padding: 0.65rem 0.85rem;
    margin-bottom: 0.5rem;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--bg-secondary);
    font-size: 0.85rem;
}
.event-item.step { border-left-color: var(--accent-blue); }
.event-item.retry { border-left-color: var(--accent-orange); }
.event-item.success { border-left-color: var(--accent-green); }
.event-item.error { border-left-color: var(--accent-red); }
.event-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.3rem;
}

/* ---- Labware Map Table ---- */
.labware-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
    margin: 0.75rem 0;
}
.labware-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-medium);
}
.labware-table td {
    padding: 0.5rem 0.75rem;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);
}
.labware-table tr:hover td {
    background: var(--bg-tertiary);
}

/* ---- Buttons ---- */
.stButton>button[kind="primary"] {
    background: linear-gradient(135deg, #3fb950 0%, #2ea043 100%) !important;
    border: none !important;
    font-weight: 600 !important;
    font-family: 'Inter', sans-serif !important;
    border-radius: var(--radius-md) !important;
    transition: all 0.2s ease !important;
    letter-spacing: 0.01em !important;
    font-size: 0.85rem !important;
    padding: 0.55rem 1.2rem !important;
}
.stButton>button[kind="primary"]:hover {
    box-shadow: 0 4px 14px rgba(63, 185, 80, 0.25) !important;
    transform: translateY(-1px);
}
.stButton>button[kind="secondary"] {
    background: var(--bg-tertiary) !important;
    border: 1px solid var(--border-medium) !important;
    color: var(--text-primary) !important;
    border-radius: var(--radius-md) !important;
    font-weight: 500 !important;
}

/* ---- Code blocks ---- */
div[data-testid="stCodeBlock"] {
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
}
div[data-testid="stCodeBlock"] code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
    font-size: 0.8rem !important;
}

/* ---- Sidebar ---- */
section[data-testid="stSidebar"] {
    background: var(--bg-secondary) !important;
    border-right: 1px solid var(--border-subtle);
}
section[data-testid="stSidebar"] .stMarkdown h2 {
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: -0.01em;
}

/* ---- Divider ---- */
.divider {
    border: none;
    border-top: 1px solid var(--border-subtle);
    margin: 1.25rem 0;
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
    .mode-tabs { flex-direction: column; }
    .mode-tab { border-bottom: none; border-left: 2px solid transparent; text-align: left; }
    .mode-tab.active { border-left-color: var(--accent-green); }
    .pipeline-steps { flex-wrap: wrap; }
    .pipeline-step { flex-basis: 25%; }
    .metric-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
"""
