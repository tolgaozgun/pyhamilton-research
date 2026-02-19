# PyHamilton Automation Agent

AI-powered PyHamilton script generation with three workflow modes, validated pipelines, and autonomous error correction.

## Architecture

- **Backend**: FastAPI (Python 3.12) — LLM orchestration, validation pipeline, RAG, simulation
- **Frontend**: React + TypeScript + Vite + Tailwind CSS — modern dark-mode UI
- **Desktop**: Electron — cross-platform Mac/Windows/Linux app
- **Infra**: Docker Compose for containerized deployment, GitHub Actions for CI/CD

## Modes

| Mode | Target User | Description |
|------|-------------|-------------|
| **Simple** | Bench scientists | Prompt in, script out. No validation. |
| **Developer** | Automation engineers | 8-step validated pipeline with review checkpoints |
| **Agentic** | Power users | Autonomous pipeline with error diagnosis and retry |

## Quick Start

### Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Docker

```bash
docker compose up --build
```

Backend at :8000, frontend at :3000.

### Electron (Desktop App)

```bash
cd frontend
npm run electron:dev     # Development
npm run electron:build   # Package for current platform
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Models, enums, constants
│   │   ├── api/routes/          # REST + SSE endpoints
│   │   ├── core/                # Pipeline, safety, RAG, simulator, comparison
│   │   ├── providers/           # LLM abstraction (Google, OpenAI, Anthropic, OpenRouter)
│   │   ├── prompts/             # System prompts and templates
│   │   └── agents/              # Agent tools
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/               # Simple, Developer, Agentic, Settings
│   │   ├── components/          # CodeBlock, PipelineProgress, EventLog, etc.
│   │   ├── api/                 # API client
│   │   ├── store/               # Zustand state management
│   │   └── types/               # TypeScript types
│   ├── electron/                # Electron wrapper
│   ├── Dockerfile
│   └── electron-builder.yml
├── docker-compose.yml
├── .github/workflows/
│   ├── ci.yml                   # Build verification
│   └── release.yml              # Electron release (Mac/Win/Linux)
└── docs/
    ├── PRD.md
    └── UPDATED_PRD.md
```

## Releases

Push a tag `v*` to trigger the release workflow, which builds unsigned Electron apps for Mac (DMG), Windows (NSIS), and Linux (AppImage).

```bash
git tag v1.0.0
git push origin v1.0.0
```
