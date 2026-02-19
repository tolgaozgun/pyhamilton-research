# Product Requirements Document (PRD)

**Project:** PyHamilton Automation Agent
**Version:** 2.0
**Status:** Draft
**Target Audience:** Development team (technical implementation reference)
**Target Users:** Bench scientists, automation engineers, power users / researchers

---

## 1. Problem Statement

Programming liquid-handling robots with PyHamilton is error-prone, slow, and unsafe for non-experts. Manual scripting requires deep knowledge of the PyHamilton API, Hamilton deck geometry, and liquid-handling best practices. Debugging is time-consuming and mistakes can damage hardware or invalidate experiments.

**No structured system currently exists that:**

1. Generates PyHamilton scripts from natural-language intent
2. Validates correctness through simulation
3. Compares results against expected outcomes
4. Iterates automatically on failures (agentic mode)

---

## 2. Goals & Non-Goals

### Goals

- Generate working PyHamilton scripts from natural-language prompts
- Support three operational modes (Simple, Developer, Agentic) for different user needs
- Validate generated scripts through syntax checking and Venus simulator execution
- Provide measurable correctness and quality metrics
- Support LLM-agnostic design (swap providers via config)
- Include RAG with PyHamilton documentation to reduce hallucinations
- Deliver via web app or Electron desktop app

### Non-Goals (v1)

- Full LIMS integration
- Support for non-Hamilton robot brands
- Fully autonomous unsupervised execution
- Image-based deck layout inference (deferred to v1.5)
- Fine-tuning LLMs (rely on prompt engineering + RAG for v1)
- High-precision vision calibration

---

## 3. User Personas

### 3.1 Bench Scientist (Simple Mode)

- Wants automation without writing or understanding code
- Accepts no validation — just needs a file to hand off
- Lowest technical bar; highest need for simplicity

### 3.2 Automation Engineer (Developer Mode)

- Knows PyHamilton and Hamilton hardware
- Wants step-by-step validated code generation with review checkpoints
- Will inspect and edit intermediate outputs (labware maps, code)

### 3.3 Power User / Researcher (Agentic Mode)

- Wants AI-driven protocol generation with automatic error correction
- Comfortable with autonomous retry loops
- Interested in metrics, iteration speed, and scaling

---

## 4. System Architecture Overview

### 4.1 Interface

- **Web app** or **Electron desktop app**
- Chat-style prompt input with mode selection
- Step-by-step progress display (Developer/Agentic modes)
- File download for generated scripts

### 4.2 LLM Backend

- **LLM-agnostic** — providers swapped via config file
- Config file specifies: provider, API key, model name, temperature, max tokens
- No hard dependency on any single LLM vendor
- Example providers: Anthropic Claude, OpenAI GPT-4, open-source models

```yaml
# Example: llm_config.yaml
provider: anthropic
api_key: ${ANTHROPIC_API_KEY}
model: claude-sonnet-4-20250514
temperature: 0.2
max_tokens: 4096
```

### 4.3 Validation Backend

- **Syntax check:** Conda environment with Python — parse/compile generated code
- **Simulation:** Hamilton Venus simulator — run generated scripts to catch runtime errors
- **Outcome comparison:** Programmatic state diff first, LLM-based judgment as fallback for fuzzy goals

### 4.4 Knowledge Base (RAG)

- RAG pipeline with PyHamilton documentation, API references, and known-safe protocols
- Included in v1 for all modes
- Reduces API hallucinations and improves code quality
- Content sources:
  - PyHamilton official docs
  - PyHamilton API reference (function signatures, parameters, types)
  - Common protocol patterns (serial dilution, plate replication, cherry-picking, etc.)
  - Known-safe deck layouts
  - Common failure patterns and fixes

---

## 5. Product Modes

### Mode 1: Simple Mode

**Target:** Bench scientists
**Philosophy:** Prompt in, file out. No friction.

**Flow:**

```
User prompt → LLM generates PyHamilton script → File returned to user
```

**Details:**

| Step | Description | User Action |
|------|-------------|-------------|
| 1 | User enters a natural-language prompt describing the procedure | Write prompt |
| 2 | LLM generates a complete PyHamilton script | None (wait) |
| 3 | Script file is returned for download | Download file |

**Characteristics:**

- No validation, no syntax check, no simulation
- User receives the raw generated file
- Intended for users who will hand the file to an automation engineer or run it themselves
- RAG is used behind the scenes to improve generation quality

**Rationale for no validation:** Simple Mode optimizes for speed and low friction. Users in this mode either have downstream review processes or accept the risk of unvalidated code.

---

### Mode 2: Developer Mode

**Target:** Automation engineers
**Philosophy:** Step-by-step validated generation with human review checkpoints.

**Flow:**

```
Prompt → Feasibility check → Labware map (user review) → Code gen → Syntax check → Simulation → Outcome comparison → Results
```

**Detailed Pipeline:**

| Step | Description | User Action | Failure Behavior |
|------|-------------|-------------|------------------|
| **1. User Input** | User enters: (a) procedure description *(required)*, (b) labware and equipment with locations *(optional)*, (c) expected outcome — final deck state, liquid positions *(optional)* | Write prompt | — |
| **2. Feasibility Check** | LLM API call to assess whether the described procedure is achievable with available PyHamilton capabilities and standard Hamilton hardware | None (wait) | Return error with explanation of why the procedure is not feasible |
| **3. Labware Map Generation** | LLM generates: (a) list of all labware to be used, (b) deck position map, (c) expected outcome state if not provided by user | **Review and edit** labware map and expected outcome before proceeding | User corrects and resubmits |
| **4. Code Generation** | LLM generates the PyHamilton script using the approved labware map and procedure | None (wait) | — |
| **5. Syntax Check** | Run generated code through Python parser in a Conda environment to catch syntax errors | None (wait) | Return syntax errors to user with highlighted lines |
| **6. Simulation Run** | Execute the script in the Hamilton Venus simulator to catch runtime errors (incorrect API calls, invalid movements, resource conflicts) | None (wait) | Return runtime errors with simulator logs |
| **7. Outcome Comparison** | Compare simulator's resulting deck state against expected outcome. **Primary:** programmatic state diff (liquid volumes, tip usage, plate contents). **Fallback:** LLM judges simulator logs against fuzzy/unstructured goals | None (wait) | Return mismatch report showing expected vs. actual state |
| **8. Results** | Present final results: pass/fail status, generated script, simulator logs, outcome comparison report | Download script, review results | — |

**Failure at any step halts the pipeline and returns the error to the user.** The user can modify inputs and restart from step 1, or from the failed step if inputs are unchanged.

---

### Mode 3: Agentic Mode

**Target:** Power users / researchers
**Philosophy:** Same pipeline as Developer Mode, but with autonomous error correction via tool calls.

**Flow:**

```
Developer Mode pipeline → On failure → LLM diagnoses error → LLM fixes script → Re-runs from failed step → Repeat until pass or retry limit
```

**Agent Tools:**

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `create_pyhamilton_script` | Generate or regenerate a PyHamilton script from procedure + labware map | Procedure description, labware map, error context (if retry) | PyHamilton script string |
| `validate_script` | Run syntax check via Python parser in Conda environment | Script string | Pass/fail + error details |
| `simulate_run` | Execute script in Venus simulator | Script string | Simulator state + logs |
| `compare_outcome` | Compare simulator state against expected outcome | Simulator state, expected outcome | Match/mismatch report |

**Retry Loop:**

1. Run the Developer Mode pipeline (steps 1–7)
2. If any step fails (syntax, simulation, or outcome mismatch):
   a. LLM receives the error details and full context
   b. LLM diagnoses the root cause
   c. LLM calls `create_pyhamilton_script` with error context to generate a fix
   d. Pipeline re-runs from the failed step
3. Repeat until success or **retry limit reached**
4. **Retry limit is configurable by the user** (default: 3)
5. If retry limit is exhausted, return the best attempt with full error history

**Agentic Mode Visibility Requirements:**

- Every tool call is logged and displayed to the user in real time
- The user can see: current step, retry count, error diagnosis, fix attempt
- No silent execution — every action is visible
- User can cancel the retry loop at any time

---

## 6. Input Specification

### 6.1 User Prompt (All Modes)

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| Procedure description | **Yes** | Natural-language description of what the protocol should do | "Perform a 1:2 serial dilution across 12 columns of a 96-well plate, starting from column 1 with 200µL of sample" |
| Labware and locations | No | Specific labware types and their deck positions | "96-well plate at position 1, tip rack at position 2, reagent trough at position 3" |
| Expected outcome | No | Description of the final deck state after successful execution | "Column 1: 200µL, Column 2: 100µL, Column 3: 50µL, ... Column 12: ~0.1µL" |

- If labware/locations are not specified, the LLM infers them (Developer/Agentic modes present this for review)
- If expected outcome is not specified, the LLM generates one (Developer/Agentic modes present this for review)

### 6.2 Image Input (v1.5 — Deferred)

- Cell phone photo of deck layout
- Model infers labware positions, tip racks, plate types
- Assume default deck geometry; no fine-grained calibration
- User can override inferred layout
- Assistive only, not authoritative

---

## 7. Outcome Comparison System

The outcome comparison (Developer Mode step 7, Agentic Mode loop) uses a two-tier approach:

### Tier 1: Programmatic State Diff (Primary)

Compare the Venus simulator's final state against the expected outcome on structured fields:

| Field | Comparison Method |
|-------|-------------------|
| Liquid volumes per well | Numeric diff with configurable tolerance (default: ±5%) |
| Tip usage | Exact match — tips used vs. tips expected |
| Plate/labware positions | Exact match — labware present at expected deck positions |
| Liquid types per well | String match — correct reagent in correct location |

A programmatic pass requires **all structured fields to match within tolerance**.

### Tier 2: LLM Judgment (Fallback)

When the expected outcome is fuzzy or unstructured (e.g., "mix the samples well" or "the plate should be ready for the next step"):

- LLM receives the simulator logs and the user's expected outcome description
- LLM makes a judgment call: pass, fail, or ambiguous
- If ambiguous, the result is flagged for user review

**Tier 2 is only invoked when Tier 1 cannot fully evaluate the outcome** (e.g., no structured expected state was provided, or the goal is qualitative).

---

## 8. Metrics & Quality Tracking

### 8.1 Metrics Tracked Across All Modes

| Metric | Description | Tracked In |
|--------|-------------|------------|
| Syntax error rate | % of generated scripts failing Python parsing | Developer, Agentic |
| API hallucination rate | % of scripts containing calls to nonexistent PyHamilton functions | All modes |

### 8.2 Agentic Mode Metrics (Primary Quality Indicators)

| Metric | Description | Target (v1 Launch) |
|--------|-------------|-------------------|
| **First-pass success rate** | % of scripts passing syntax + simulation + outcome comparison on the first attempt | ≥ 60% |
| **Final success rate** | % of scripts passing after all retry attempts | ≥ 90% |
| **Average retries to success** | Mean number of fix cycles needed for successful scripts | ≤ 2.0 |
| **Error category distribution** | Breakdown of failures by type: syntax, runtime, logic/outcome mismatch | Tracked (no target — used for diagnosis) |
| **API hallucination rate** | % of generated scripts containing calls to nonexistent PyHamilton APIs | ≤ 2% |

### 8.3 How Metrics Are Collected

- Every pipeline run (all modes) is logged with: input prompt, generated code, validation results, simulator output, outcome comparison, retry history (Agentic)
- Metrics are computed from logs on a rolling basis
- Dashboard view available in the app (Agentic Mode)

---

## 9. RAG Knowledge Base

### 9.1 Scope (v1)

| Content Type | Description | Priority |
|--------------|-------------|----------|
| PyHamilton API reference | Function signatures, parameter types, return values, usage examples | High |
| Protocol patterns | Common workflows: serial dilution, plate replication, cherry-picking, pooling, normalization | High |
| Deck layouts | Known-safe deck configurations for common Hamilton models | Medium |
| Failure patterns | Common errors and their fixes (e.g., tip collision, volume overflow) | Medium |
| PyHamilton docs | Official documentation and tutorials | High |

### 9.2 RAG Integration

- Relevant documentation is retrieved based on the user's prompt before code generation
- Retrieved context is injected into the LLM prompt alongside the user's procedure description
- In Agentic Mode, RAG is also queried during error diagnosis to find known fixes
- RAG is used in all modes (including Simple Mode) to improve generation quality

### 9.3 RAG Implementation

- Vector database for document embeddings (implementation choice left to dev team)
- Chunked documents with metadata (source, topic, API function name)
- Retrieval: top-k relevant chunks based on semantic similarity to user prompt
- Refresh strategy: manual update when PyHamilton releases new versions

---

## 10. Installation & Environment Setup

### 10.1 Requirements

| Component | Purpose |
|-----------|---------|
| Conda | Python environment management for syntax checking and script execution |
| Python 3.9+ | PyHamilton runtime |
| PyHamilton | Core library for Hamilton robot control |
| Hamilton Venus Simulator | Simulation of script execution |
| Node.js (if Electron) | Desktop app runtime |
| Vector database | RAG knowledge base storage |

### 10.2 Bootstrap

One-command setup script that:

1. Creates and configures the Conda environment
2. Installs PyHamilton and dependencies
3. Validates Venus simulator connection
4. Initializes the RAG knowledge base with PyHamilton docs
5. Validates LLM config file and API connectivity
6. Runs a smoke test (generate + validate a simple protocol)

```bash
# Target: single command to set up everything
./setup.sh
```

---

## 11. Versioning & Roadmap

### v1 (Current Scope)

- Simple, Developer, and Agentic modes
- LLM-agnostic via config file
- Venus simulator integration
- RAG with PyHamilton docs
- Web app or Electron desktop app
- Metrics dashboard (Agentic Mode)

### v1.5 (Next)

- Image-based deck layout inference (cell phone photo → labware map)
- Expanded RAG: internal lab protocols, user-contributed templates
- Improved outcome comparison with richer simulator state parsing

### v2 (Future)

- Multi-LLM evaluation (run same prompt through multiple models, pick best)
- Fine-tuning on PyHamilton-specific datasets
- Protocol library: save, share, and reuse validated protocols
- Full LIMS integration
- Support for additional robot brands

---

## 12. Open Questions & Risks

| Question / Risk | Status | Notes |
|-----------------|--------|-------|
| Venus simulator fidelity — does it catch all runtime errors that would occur on real hardware? | Open | Need to characterize the gap between simulator and hardware behavior |
| RAG knowledge base completeness — is PyHamilton documentation sufficient, or do we need community examples? | Open | Start with official docs, expand based on hallucination rate metrics |
| LLM cost at scale — how expensive is the Agentic Mode retry loop per protocol? | Open | Track token usage per pipeline run; consider cost caps |
| Outcome comparison for complex protocols — can we reliably extract structured state from Venus simulator output? | Open | Spike needed to characterize Venus simulator output format |
| How to handle PyHamilton version updates that change the API? | Open | RAG refresh process needs to be defined |

---

## 13. Success Criteria (v1 Launch)

| Criterion | Target |
|-----------|--------|
| Agentic Mode final success rate | ≥ 90% |
| Agentic Mode first-pass success rate | ≥ 60% |
| Agentic Mode average retries | ≤ 2.0 |
| API hallucination rate | ≤ 2% |
| Syntax error rate (Developer + Agentic) | ≤ 10% |
| End-to-end time for basic protocol (Developer Mode) | < 5 minutes |
| Zero unvalidated executions in Developer Mode | 0 |
| Setup from scratch (bootstrap) | < 15 minutes |

---

## Appendix A: Example Walkthrough — Serial Dilution

**User prompt:** "Perform a 1:2 serial dilution across 12 columns of a 96-well plate, starting from column 1 with 200µL of sample."

### Simple Mode

1. User enters prompt
2. LLM generates PyHamilton script (with RAG context for serial dilution patterns)
3. User downloads `.py` file
4. Done

### Developer Mode

1. **Input:** Prompt entered as above. No labware locations or expected outcome specified.
2. **Feasibility:** LLM confirms serial dilution is a standard PyHamilton operation. Pass.
3. **Labware Map:** LLM generates:
   - 96-well plate at deck position 1
   - 300µL tip rack at deck position 2
   - Reagent trough (diluent) at deck position 3
   - Expected outcome: Column 1 = 200µL, Column 2 = 100µL, ... Column 12 ≈ 0.1µL
   - **User reviews and approves** (or edits positions)
4. **Code Generation:** LLM generates PyHamilton script using approved labware map
5. **Syntax Check:** Python parser validates — pass
6. **Simulation:** Venus simulator runs the script — no runtime errors
7. **Outcome Comparison:** Programmatic diff confirms volumes match within ±5% tolerance
8. **Results:** Pass. User downloads validated script.

### Agentic Mode

Same as Developer Mode, but if step 6 reveals a runtime error (e.g., tip collision because the deck positions are too close), the agent:

1. Reads the error log
2. Diagnoses: "Tip rack at position 2 conflicts with plate at position 1"
3. Calls `create_pyhamilton_script` with updated labware map (moves tip rack to position 5)
4. Re-runs from step 5
5. Passes on retry 2. Logs: 1 retry, error category = runtime, root cause = deck collision