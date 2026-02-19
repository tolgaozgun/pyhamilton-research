Below is a **clean, opinionated PRD** derived directly from your project plan and notes. I’ve filled in gaps, made decisions explicit, and removed ambiguity. Where I made assumptions beyond your notes, they are clearly marked.

Source: your handwritten project plan (pages 1–2) 

---

# Product Requirements Document (PRD)

**Project:** PyHamilton Automation Agent
**Owner:** You
**Status:** Draft v1
**Target Users:** Bench scientists, automation engineers, developer-operators
**Core Value:** Safely convert human intent (text + optional image) into executable, correct PyHamilton protocols.

---

## 1. Problem Statement

Programming liquid-handling robots with PyHamilton is:

* Error-prone (syntax, API misuse, hardware assumptions)
* Slow (manual scripting, debugging, iteration)
* Unsafe for non-experts (easy to damage hardware or invalidate experiments)

There is no structured system that:

1. Generates PyHamilton scripts from intent
2. Validates correctness and safety
3. Executes or simulates them reliably
4. Scales from novice to expert workflows

---

## 2. Goals & Non-Goals

### Goals

* Generate **working PyHamilton scripts** from structured or free-form input
* Support **multiple safety levels**, from novice-safe to developer-fast
* Provide **measurable correctness guarantees**
* Enable **agentic workflows** with tool use (script creation + execution)
* Minimize deck movement and unsafe assumptions
* Support optional **image-based deck layout inference**

### Non-Goals

* Full LIMS integration (out of scope v1)
* Arbitrary robot brands (PyHamilton only)
* Fully autonomous unsupervised execution in v1
* High-precision vision calibration (keep assumptions simple)

---

## 3. User Personas

### 3.1 Bench Scientist (Simple Mode)

* Wants automation without writing code
* Safety > flexibility
* Accepts slower iteration

### 3.2 Automation Engineer (Developer Mode)

* Knows PyHamilton
* Wants speed, fewer guardrails
* Will debug manually

### 3.3 Advanced User / Researcher (Agentic Mode)

* Wants AI-driven protocol generation and execution
* Accepts risk with visibility
* Interested in scaling and experimentation

---

## 4. Product Modes (Core Requirement)

### Mode 1: **Simple Linear Workflow (Safe Mode)**

**Target:** Bench scientists
**Characteristics:**

* Strict linear execution
* Mandatory safety checks
* Limited API surface
* Predefined deck assumptions

**Requirements:**

* Block unsafe commands
* Validate volumes, tips, labware positions
* No dynamic control flow
* No direct hardware execution without confirmation

---

### Mode 2: **Developer Linear Workflow (Fast Mode)**

**Target:** Automation engineers
**Characteristics:**

* Linear workflow
* Reduced or no safety checks
* Full PyHamilton API access
* Faster iteration

**Requirements:**

* Syntax validation only
* Optional unit tests
* Execution behind explicit user approval

---

### Mode 3: **Agentic Workflow (Advanced Mode)**

**Target:** Power users
**Characteristics:**

* LLM with tool use
* Multi-step planning
* Script creation + execution tools
* Optional RAG knowledge base

**Agent Tools:**

* `create_pyhamilton_script`
* `run_pyhamilton_script`
* `validate_script`
* `simulate_run`

**Requirements:**

* Streaming output (thought → plan → code → execution)
* Tool-call visibility
* Hard execution boundaries (no silent runs)

---

## 5. Input Modalities

### 5.1 Text Input

* Free-form natural language
* Optional structured schema (YAML/JSON)
* Streaming token-by-token feedback

### 5.2 Image Input (Optional, v1.5)

* Cell phone photo of deck layout
* Model infers:

  * Labware positions
  * Tip racks
  * Plate types

**Constraints:**

* Assume default deck geometry
* No fine-grained calibration
* User can override inferred layout

---

## 6. Script Generation Pipeline

1. Parse user intent
2. Select mode (Simple / Developer / Agentic)
3. Generate **top-k candidate scripts**
4. Validate candidates
5. Select best passing script
6. Execute or return script

---

## 7. Correctness & Quality Metrics (Hard Requirements)

### 7.1 Functional Correctness (Primary)

**Pass@k**

* At least **1 of top-k generated scripts passes unit tests**
* This is the **minimum bar** for release

### 7.2 Syntax / Compilation Error Rate

* % of scripts failing Python execution
* Tracked per mode
* Must decrease over time

### 7.3 API Hallucination Rate

* % of calls to nonexistent PyHamilton APIs
* Zero tolerance in Simple Mode
* Logged + visible in Developer/Agentic modes

---

## 8. Safety Requirements

### Simple Mode (Mandatory)

* Volume bounds enforced
* Tip reuse prevented
* Collision-prone movements blocked
* Deck assumptions fixed and explicit

### Developer / Agentic Mode

* Safety warnings only
* Explicit user acknowledgment required before execution

---

## 9. Deck Layout Assumptions (Explicit Design Choice)

* Start from **default deck state**
* Optimize to **minimize movement**
* Prefer static, simple assumptions over complex inference
* Image-based inference is **assistive**, not authoritative

---

## 10. Installation & Environment Setup

### Required

* Script to:

  * Install PyHamilton
  * Copy required libraries
  * Validate environment
* One-command bootstrap

---

## 11. RAG-Supported Knowledge Base (Optional but Recommended)

**Content:**

* PyHamilton docs
* Internal lab protocols
* Known-safe deck layouts
* Common failure patterns

**Used by:**

* Agentic Mode only (v1)
* Improves correctness and reduces hallucinations

---

## 12. Open Questions / Risks

* How much autonomy to allow agentic execution?
* Where to draw the hard stop between “assist” and “act”?
* How to version safety policies without breaking workflows?
* Whether to fine-tune vs rely on prompt + RAG

---

## 13. Success Criteria (Launch)

* ≥90% scripts compile successfully
* Pass@k ≥ 1 for standard test suite
* Zero unsafe executions in Simple Mode
* Users can generate and run a basic protocol end-to-end in <5 minutes

---

## Final Note (Direct)

Your core idea is solid. The **three-mode split is correct** and aligns with real lab behavior. The biggest risk is under-specifying **safety boundaries** in Agentic Mode—lock those down early or you’ll regret it.

If you want, next steps could be:

* Turning this into an **execution-state machine**
* Writing a **unit test spec for PyHamilton**
* Designing the **agent tool API**
* Or producing a **V0 UX flow** for Simple Mode

Say what you want next.
