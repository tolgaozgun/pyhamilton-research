from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

BUILTIN_REFERENCE: list[dict[str, str]] = [
    {
        "topic": "Initialization",
        "content": (
            "from pyhamilton import HamiltonInterface, LayoutManager, INITIALIZE\n"
            "ham = HamiltonInterface()\n"
            "ham.start()\n"
            "ham.wait_on_response(ham.send_command(INITIALIZE))\n\n"
            "Always call INITIALIZE before any other commands. "
            "The HamiltonInterface manages communication with the Hamilton STAR robot. "
            "LayoutManager handles deck layout (.lay) files."
        ),
    },
    {
        "topic": "Resource Setup",
        "content": (
            "lmgr = LayoutManager('deck_layout.lay')\n"
            "tips_300 = lmgr.assign_unused_tip_rack(300)\n"
            "plate_source = lmgr.assign_unused_plate('source_plate')\n"
            "plate_dest = lmgr.assign_unused_plate('dest_plate')\n\n"
            "Use LayoutManager to assign labware defined in the .lay file. "
            "Tip racks are assigned by volume capacity (50, 300, 1000 µL). "
            "Plates and reservoirs are assigned by their layout name."
        ),
    },
    {
        "topic": "Single-Channel Operations",
        "content": (
            "from pyhamilton import PICKUP, EJECT, ASPIRATE, DISPENSE\n\n"
            "ham.wait_on_response(ham.send_command(PICKUP, tips))\n"
            "ham.wait_on_response(ham.send_command(ASPIRATE, plate_source, [100.0]*8))\n"
            "ham.wait_on_response(ham.send_command(DISPENSE, plate_dest, [100.0]*8))\n"
            "ham.wait_on_response(ham.send_command(EJECT))\n\n"
            "Single-channel pipetting uses 1-8 channels. Volumes are passed as lists. "
            "Always pick up tips before aspirating. Always eject tips after dispensing. "
            "Volume range: 0.5 – 1000 µL depending on tip type."
        ),
    },
    {
        "topic": "96-Head Operations",
        "content": (
            "from pyhamilton import PICKUP96, EJECT96, ASPIRATE96, DISPENSE96\n\n"
            "ham.wait_on_response(ham.send_command(PICKUP96, tip_rack_96))\n"
            "ham.wait_on_response(ham.send_command(ASPIRATE96, source_plate, 50.0))\n"
            "ham.wait_on_response(ham.send_command(DISPENSE96, dest_plate, 50.0))\n"
            "ham.wait_on_response(ham.send_command(EJECT96))\n\n"
            "The 96-head picks up/ejects all 96 tips at once. "
            "Volume is a single float applied to all channels. "
            "Useful for plate-to-plate transfers."
        ),
    },
    {
        "topic": "Gripper Operations",
        "content": (
            "from pyhamilton import GRIP_GET, GRIP_PLACE\n\n"
            "ham.wait_on_response(ham.send_command(GRIP_GET, plate, grip_mode=0))\n"
            "ham.wait_on_response(ham.send_command(GRIP_PLACE, target_pos, grip_mode=0))\n\n"
            "The iSWAP gripper moves plates between deck positions. "
            "grip_mode: 0=narrow side, 1=wide side. "
            "Always ensure the target position is empty before placing."
        ),
    },
    {
        "topic": "Serial Dilution Pattern",
        "content": (
            "# Serial dilution: transfer decreasing volumes across columns\n"
            "for col in range(num_dilutions):\n"
            "    ham.wait_on_response(ham.send_command(PICKUP, tips))\n"
            "    vol = start_volume / (dilution_factor ** col)\n"
            "    ham.wait_on_response(ham.send_command(ASPIRATE, source, [vol]*8))\n"
            "    ham.wait_on_response(ham.send_command(DISPENSE, plate, [vol]*8))\n"
            "    ham.wait_on_response(ham.send_command(EJECT))\n\n"
            "Typically uses fresh tips per dilution step to prevent carryover. "
            "Common dilution factors: 2x, 3x, 10x. "
            "Ensure diluent is pre-dispensed in destination wells."
        ),
    },
    {
        "topic": "Plate Replication Pattern",
        "content": (
            "# Full plate copy using 96-head\n"
            "ham.wait_on_response(ham.send_command(PICKUP96, tip_rack))\n"
            "ham.wait_on_response(ham.send_command(ASPIRATE96, source_plate, volume))\n"
            "ham.wait_on_response(ham.send_command(DISPENSE96, dest_plate, volume))\n"
            "ham.wait_on_response(ham.send_command(EJECT96))\n\n"
            "Fastest method for 1:1 plate copies. "
            "For multiple copies, repeat with fresh tips per destination."
        ),
    },
    {
        "topic": "Cherry Picking Pattern",
        "content": (
            "# Selective well-to-well transfer\n"
            "for src_well, dst_well, vol in pick_list:\n"
            "    ham.wait_on_response(ham.send_command(PICKUP, tips))\n"
            "    ham.wait_on_response(ham.send_command(ASPIRATE, src_well, [vol]))\n"
            "    ham.wait_on_response(ham.send_command(DISPENSE, dst_well, [vol]))\n"
            "    ham.wait_on_response(ham.send_command(EJECT))\n\n"
            "Uses single channel for arbitrary well-to-well transfers. "
            "pick_list is typically loaded from a CSV file. "
            "Always use fresh tips to prevent cross-contamination."
        ),
    },
    {
        "topic": "Volume Constraints",
        "content": (
            "Tip volumes and constraints:\n"
            "- 50µL tips: 0.5 – 50 µL\n"
            "- 300µL tips: 1.0 – 300 µL\n"
            "- 1000µL tips: 5.0 – 1000 µL\n\n"
            "Aspirate/dispense volumes must be within tip capacity. "
            "For volumes exceeding tip capacity, split into multiple transfers. "
            "Minimum reliable volume depends on liquid class and tip type."
        ),
    },
    {
        "topic": "Common Deck Positions",
        "content": (
            "Standard Hamilton STAR deck layout:\n"
            "- Positions 1-5: Tip racks (T1-T5)\n"
            "- Positions 6-15: Sample plates, reservoirs, tube racks\n"
            "- Position 16+: Waste, wash stations\n\n"
            "The iSWAP gripper can reach most positions. "
            "Verify reachability in your specific deck configuration."
        ),
    },
    {
        "topic": "Common Errors and Fixes",
        "content": (
            "1. 'No tips available' -> Assign more tip racks or add tip reload logic\n"
            "2. 'Volume out of range' -> Check tip type vs requested volume\n"
            "3. 'Position occupied' -> Eject/move existing labware before placing\n"
            "4. 'Communication timeout' -> Check USB connection, restart Hamilton Run Control\n"
            "5. 'Liquid not detected' -> Verify liquid level detection settings\n"
            "6. 'Sequence end reached' -> Reset sequence position or assign new labware\n\n"
            "Always wrap commands in try/except and call ham.stop() in finally block."
        ),
    },
]

_chroma_collection = None


def _init_chroma() -> bool:
    global _chroma_collection
    if _chroma_collection is not None:
        return True
    try:
        import chromadb
        client = chromadb.Client()
        _chroma_collection = client.get_or_create_collection("pyhamilton_docs")
        if _chroma_collection.count() == 0:
            for i, entry in enumerate(BUILTIN_REFERENCE):
                _chroma_collection.add(
                    documents=[entry["content"]],
                    metadatas=[{"topic": entry["topic"]}],
                    ids=[f"builtin_{i}"],
                )
        return True
    except ImportError:
        logger.info("chromadb not installed, using keyword fallback")
        return False
    except Exception:
        logger.warning("Failed to initialize chromadb, using keyword fallback", exc_info=True)
        return False


def _keyword_retrieve(query: str, top_k: int = 5) -> list[dict[str, str]]:
    query_lower = query.lower()
    scored: list[tuple[float, dict[str, str]]] = []
    for entry in BUILTIN_REFERENCE:
        score = 0.0
        text = (entry["topic"] + " " + entry["content"]).lower()
        for word in query_lower.split():
            if word in text:
                score += 1.0
            if word in entry["topic"].lower():
                score += 2.0
        if score > 0:
            scored.append((score, entry))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [entry for _, entry in scored[:top_k]]


def retrieve(query: str, top_k: int = 5) -> list[dict[str, str]]:
    if _init_chroma() and _chroma_collection is not None:
        results = _chroma_collection.query(query_texts=[query], n_results=top_k)
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        return [
            {"topic": m.get("topic", ""), "content": d}
            for d, m in zip(docs, metas)
        ]
    return _keyword_retrieve(query, top_k)


def format_rag_context(query: str, top_k: int = 5) -> str:
    entries = retrieve(query, top_k)
    if not entries:
        return ""
    parts = ["## PyHamilton API Reference\n"]
    for entry in entries:
        parts.append(f"### {entry['topic']}\n{entry['content']}\n")
    return "\n".join(parts)


async def search_vector_store_context(
    db,
    user,
    vector_store_id: str,
    query: str,
    max_results: int = 5,
) -> str:
    """
    Search a user's OpenAI vector store and return results formatted as a
    prompt context block.  Returns an empty string on any failure so callers
    can treat it as a soft dependency.
    """
    import os
    try:
        import openai
    except ImportError:
        logger.warning("openai package not installed; skipping vector store search")
        return ""

    from sqlalchemy import select
    from app.models import UserSettings

    # Resolve API key: DB first, then env
    api_key: str | None = None
    try:
        result = await db.execute(
            select(UserSettings).where(
                UserSettings.user_id == user.id,
                UserSettings.provider == "openai",
            )
        )
        settings = result.scalar_one_or_none()
        if settings and settings.api_key:
            api_key = settings.api_key
    except Exception as e:
        logger.warning(f"DB lookup for OpenAI key failed: {e}")

    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        logger.warning("No OpenAI API key available; skipping vector store search")
        return ""

    try:
        client = openai.AsyncOpenAI(api_key=api_key)
        results = await client.vector_stores.search(
            vector_store_id=vector_store_id,
            query=query,
            max_num_results=max_results,
        )
        if not results.data:
            return ""

        parts = ["## Knowledge Base Context\n"]
        for item in results.data:
            for chunk in item.content:
                if hasattr(chunk, "text") and chunk.text:
                    text_value = chunk.text.value if hasattr(chunk.text, "value") else str(chunk.text)
                    parts.append(f"{text_value.strip()}\n")
        return "\n".join(parts)
    except Exception as e:
        logger.warning(f"Vector store search failed (id={vector_store_id}): {e}")
        return ""
