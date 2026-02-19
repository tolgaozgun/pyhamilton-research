"""RAG knowledge base for PyHamilton documentation and protocol patterns.

Uses ChromaDB when available, falls back to keyword-based retrieval from
built-in knowledge. The builtin reference covers core PyHamilton API and
common protocol patterns — sufficient for v1.
"""

import hashlib
import re
from pathlib import Path
from typing import Optional

from config import RAG_DIR

_chromadb_available = False
try:
    import chromadb
    _chromadb_available = True
except ImportError:
    pass


def _get_store():
    """Lazily create/load the ChromaDB collection (only if available)."""
    if not _chromadb_available:
        return None
    client = chromadb.PersistentClient(path=str(RAG_DIR / "chroma_db"))
    return client.get_or_create_collection(
        name="pyhamilton_docs",
        metadata={"hnsw:space": "cosine"},
    )


def ingest_documents(docs_dir: str | Path) -> int:
    """Ingest .md and .txt files from a directory into the vector store."""
    collection = _get_store()
    if collection is None:
        return 0

    docs_path = Path(docs_dir)
    count = 0

    for fpath in docs_path.rglob("*"):
        if fpath.suffix not in (".md", ".txt", ".py"):
            continue
        text = fpath.read_text(errors="ignore").strip()
        if not text:
            continue

        chunks = _chunk_text(text, max_chars=1500, overlap=200)
        for i, chunk in enumerate(chunks):
            doc_id = hashlib.sha256(f"{fpath}:{i}".encode()).hexdigest()[:16]
            collection.upsert(
                ids=[doc_id],
                documents=[chunk],
                metadatas=[{
                    "source": str(fpath.relative_to(docs_path)),
                    "chunk_index": i,
                    "file_type": fpath.suffix,
                }],
            )
            count += 1

    return count


def _chunk_text(text: str, max_chars: int = 1500, overlap: int = 200) -> list[str]:
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chars and current:
            chunks.append(current.strip())
            overlap_text = current[-overlap:] if len(current) > overlap else current
            current = overlap_text + "\n\n" + para
        else:
            current = current + "\n\n" + para if current else para
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text]


def retrieve(query: str, n_results: int = 5) -> list[dict]:
    """Retrieve relevant document chunks for a query."""
    collection = _get_store()
    if collection is not None and collection.count() > 0:
        try:
            results = collection.query(
                query_texts=[query],
                n_results=min(n_results, collection.count()),
            )
            docs = []
            for i in range(len(results["documents"][0])):
                docs.append({
                    "content": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else None,
                })
            return docs
        except Exception:
            pass

    return _keyword_retrieve(query)


def _keyword_retrieve(query: str) -> list[dict]:
    """Fallback: keyword-based retrieval from built-in knowledge sections."""
    query_lower = query.lower()
    sections = _split_builtin_sections()

    scored = []
    for section in sections:
        keywords = set(re.findall(r'\b\w{3,}\b', query_lower))
        section_lower = section["content"].lower()
        score = sum(1 for kw in keywords if kw in section_lower)
        if score > 0:
            scored.append((score, section))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = [s[1] for s in scored[:3]]

    if not results:
        return [{"content": BUILTIN_PYHAMILTON_REFERENCE, "metadata": {"source": "builtin"}}]
    return results


def _split_builtin_sections() -> list[dict]:
    """Split the built-in reference into titled sections."""
    sections = []
    current_title = "General"
    current_content = ""

    for line in BUILTIN_PYHAMILTON_REFERENCE.split("\n"):
        if line.startswith("## ") or line.startswith("### "):
            if current_content.strip():
                sections.append({
                    "content": current_content.strip(),
                    "metadata": {"source": f"builtin/{current_title}"},
                })
            current_title = line.lstrip("#").strip()
            current_content = line + "\n"
        else:
            current_content += line + "\n"

    if current_content.strip():
        sections.append({
            "content": current_content.strip(),
            "metadata": {"source": f"builtin/{current_title}"},
        })

    return sections


def format_rag_context(docs: list[dict]) -> str:
    """Format retrieved documents into a prompt-ready context block."""
    if not docs:
        return ""
    sections = []
    for i, doc in enumerate(docs, 1):
        source = doc.get("metadata", {}).get("source", "reference")
        sections.append(f"--- Reference {i} (source: {source}) ---\n{doc['content']}")
    return "\n\n".join(sections)


BUILTIN_PYHAMILTON_REFERENCE = """
# PyHamilton API Reference (Core)

## Initialization
```python
from pyhamilton import (
    HamiltonInterface, LayoutManager, ResourceType,
    Plate96, Plate384, Tip96, Tip384, Reservoir,
    initialize, resource_list_with_prefix, normal_logging,
    aspirate, dispense, tip_pick_up, tip_eject,
    aspirate96, dispense96, tip_pick_up_96, tip_eject_96,
    grip_get, grip_place, move_sequence,
)

normal_logging()
with HamiltonInterface(simulate=True) as ham_int:
    initialize(ham_int)
```

## Resource Setup
```python
tips = resource_list_with_prefix(ham_int, "TipRack_", Tip96, 3)
source_plate = resource_list_with_prefix(ham_int, "SourcePlate_", Plate96, 1)
dest_plate = resource_list_with_prefix(ham_int, "DestPlate_", Plate96, 1)
trough = resource_list_with_prefix(ham_int, "Trough_", Reservoir, 1)
```

## Single-Channel Operations
```python
tip_pick_up(ham_int, [tips_position])
aspirate(ham_int, [plate_position], [volume])
dispense(ham_int, [plate_position], [volume])
tip_eject(ham_int, [tips_position])
```

## 96-Head Operations
```python
tip_pick_up_96(ham_int, tips_rack)
aspirate96(ham_int, plate, volume)
dispense96(ham_int, plate, volume)
tip_eject_96(ham_int, tips_rack)
```

## Gripper / Transport
```python
grip_get(ham_int, plate, mode=0, gripWidth=82.0)
grip_place(ham_int, target_position, mode=0)
```

## Serial Dilution Pattern
1. Pick up tips
2. Aspirate from source well
3. Dispense into first column
4. For each subsequent column: aspirate from previous, dispense to next
5. Mix by repeated aspirate/dispense at each step
6. Eject tips

## Plate Replication Pattern
1. For each column: pick tips, aspirate source, dispense dest, eject tips
2. Or use 96-head for full-plate transfer

## Cherry Picking Pattern
1. For each target well: pick tip, aspirate from source well, dispense to target, eject tip
2. Source/target positions come from a hit list

## Volume Constraints
- Minimum: 0.5 uL
- Maximum: 1000 uL (depends on tip type)
- 300 uL tips: 1-300 uL range
- 1000 uL tips: 5-1000 uL range

## Common Deck Positions (Hamilton STAR)
- Positions 1-24 (left to right)
- Tip racks typically at positions 1-3
- Plates typically at positions 4-8
- Troughs/reservoirs at positions 9-12

## Common Errors and Fixes
- Tip collision: move tip rack to non-adjacent position from plates
- Volume overflow: check tip capacity matches volume
- Missing initialization: always call initialize(ham_int) first
- Resource not found: verify layout prefix names match Venus method
- Tip reuse: always eject and pick up fresh tips between different reagents
"""
