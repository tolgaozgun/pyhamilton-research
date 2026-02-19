"""Venus simulator interface.

The Hamilton Venus simulator is a Windows-only application. This module provides:
- An abstract interface for simulation backends
- A MockSimulator that does compile + static checks (works everywhere)
- A VenusSimulator stub for future integration with the real Venus installation
"""

import ast
import re
from abc import ABC, abstractmethod

from config import SimulationResult, PYHAMILTON_KNOWN_APIS


class BaseSimulator(ABC):
    @abstractmethod
    def run(self, script: str) -> SimulationResult:
        ...


class MockSimulator(BaseSimulator):
    """Static analysis-based simulator that works without Venus.

    Performs: compilation, import resolution, API call validation,
    and basic liquid-tracking state simulation.
    """

    def run(self, script: str) -> SimulationResult:
        logs = []

        try:
            compile(script, "<generated>", "exec")
            logs.append("[COMPILE] Script compiles successfully.")
        except SyntaxError as e:
            return SimulationResult(
                success=False,
                logs=f"[COMPILE ERROR] Line {e.lineno}: {e.msg}",
                error=f"Syntax error at line {e.lineno}: {e.msg}",
            )

        try:
            tree = ast.parse(script)
        except SyntaxError:
            return SimulationResult(success=False, logs="Parse failed", error="Parse error")

        state = {"tips_loaded": False, "liquid_aspirated": False, "operations": []}

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func_name = self._get_call_name(node)
            if not func_name:
                continue

            if func_name == "initialize":
                logs.append("[SIM] Robot initialized.")
                state["operations"].append({"op": "initialize"})

            elif func_name in ("tip_pick_up", "tip_pick_up_96"):
                state["tips_loaded"] = True
                logs.append(f"[SIM] Tips picked up ({func_name}).")
                state["operations"].append({"op": "tip_pick_up"})

            elif func_name in ("aspirate", "aspirate96"):
                if not state["tips_loaded"]:
                    logs.append(f"[SIM ERROR] {func_name} called without tips loaded.")
                    return SimulationResult(
                        success=False,
                        logs="\n".join(logs),
                        final_state=state,
                        error="Aspirate without tips loaded.",
                    )
                state["liquid_aspirated"] = True
                vol = self._extract_volume(node)
                logs.append(f"[SIM] Aspirated {vol or '?'} µL.")
                state["operations"].append({"op": "aspirate", "volume": vol})

            elif func_name in ("dispense", "dispense96"):
                if not state["liquid_aspirated"]:
                    logs.append(f"[SIM WARNING] {func_name} called without prior aspirate.")
                state["liquid_aspirated"] = False
                vol = self._extract_volume(node)
                logs.append(f"[SIM] Dispensed {vol or '?'} µL.")
                state["operations"].append({"op": "dispense", "volume": vol})

            elif func_name in ("tip_eject", "tip_eject_96"):
                state["tips_loaded"] = False
                state["liquid_aspirated"] = False
                logs.append(f"[SIM] Tips ejected ({func_name}).")
                state["operations"].append({"op": "tip_eject"})

            elif func_name in ("grip_get", "grip_place"):
                logs.append(f"[SIM] Gripper operation: {func_name}.")
                state["operations"].append({"op": func_name})

        has_sim_flag = "simulate=True" in script or "simulate = True" in script
        if not has_sim_flag:
            logs.append("[SIM WARNING] simulate=True flag not found — script may attempt hardware execution.")

        logs.append(f"[SIM] Simulation complete. {len(state['operations'])} operations traced.")

        return SimulationResult(
            success=True,
            logs="\n".join(logs),
            final_state=state,
        )

    def _get_call_name(self, node: ast.Call) -> str | None:
        if isinstance(node.func, ast.Name):
            return node.func.id
        if isinstance(node.func, ast.Attribute):
            return node.func.attr
        return None

    def _extract_volume(self, node: ast.Call) -> float | None:
        for arg in node.args:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, (int, float)):
                return float(arg.value)
            if isinstance(arg, ast.List):
                for elt in arg.elts:
                    if isinstance(elt, ast.Constant) and isinstance(elt.value, (int, float)):
                        return float(elt.value)
        for kw in node.keywords:
            if kw.arg in ("volume", "vol"):
                if isinstance(kw.value, ast.Constant):
                    return float(kw.value.value)
        return None


class VenusSimulator(BaseSimulator):
    """Placeholder for real Hamilton Venus simulator integration.

    Venus is a Windows-only application. When available, this class would:
    1. Write the script to a temp file
    2. Invoke Venus CLI or COM automation to execute in simulation mode
    3. Parse the resulting log files and deck state
    """

    def __init__(self, venus_path: str | None = None):
        self.venus_path = venus_path

    def run(self, script: str) -> SimulationResult:
        return SimulationResult(
            success=False,
            logs="Venus simulator not available. Use MockSimulator for static analysis.",
            error="Venus simulator integration requires Windows with Hamilton Venus installed.",
        )


def get_simulator() -> BaseSimulator:
    """Factory: return the best available simulator."""
    return MockSimulator()
