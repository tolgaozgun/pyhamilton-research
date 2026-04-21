from __future__ import annotations

import ast
import re
from abc import ABC, abstractmethod

from app.config import SimulationResult, VOLUME_BOUNDS


class BaseSimulator(ABC):
    @abstractmethod
    def simulate(self, code: str, goal: str) -> SimulationResult:
        ...


class MockSimulator(BaseSimulator):
    def simulate(self, code: str, goal: str) -> SimulationResult:
        result = SimulationResult(success=True)
        tip_state: dict[str, int] = {"picked": 0, "ejected": 0}
        volumes: dict[str, float] = {"aspirated": 0.0, "dispensed": 0.0}

        try:
            tree = ast.parse(code)
        except SyntaxError as exc:
            result.success = False
            result.errors.append(f"SyntaxError: {exc.msg} (line {exc.lineno})")
            return result

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue

            func_name = self._extract_func_name(node)
            if func_name is None:
                continue

            if func_name in ("tip_pick_up", "PICKUP", "PICKUP96", "tip_pick_up_96"):
                tip_state["picked"] += 1
                result.operations_log.append(f"TIP_PICKUP at line {getattr(node, 'lineno', '?')}")

            elif func_name in ("tip_eject", "EJECT", "EJECT96", "tip_eject_96"):
                tip_state["ejected"] += 1
                result.operations_log.append(f"TIP_EJECT at line {getattr(node, 'lineno', '?')}")

            elif func_name in ("aspirate", "ASPIRATE", "ASPIRATE96", "aspirate_96"):
                vol = self._extract_volume(node)
                volumes["aspirated"] += vol
                result.operations_log.append(
                    f"ASPIRATE {vol}µL at line {getattr(node, 'lineno', '?')}"
                )
                if vol > VOLUME_BOUNDS["max_aspirate_ul"]:
                    result.warnings.append(
                        f"Aspirate volume {vol}µL exceeds max {VOLUME_BOUNDS['max_aspirate_ul']}µL"
                    )

            elif func_name in ("dispense", "DISPENSE", "DISPENSE96", "dispense_96"):
                vol = self._extract_volume(node)
                volumes["dispensed"] += vol
                result.operations_log.append(
                    f"DISPENSE {vol}µL at line {getattr(node, 'lineno', '?')}"
                )

            elif func_name in ("grip_get", "grip_place", "grip_move", "GRIP_GET", "GRIP_PLACE"):
                result.operations_log.append(
                    f"GRIPPER_{func_name.upper()} at line {getattr(node, 'lineno', '?')}"
                )

        result.tip_usage = tip_state
        result.volumes_moved = volumes

        if tip_state["picked"] > 0 and tip_state["ejected"] == 0:
            result.warnings.append("Tips were picked up but never ejected")

        if tip_state["picked"] != tip_state["ejected"]:
            result.warnings.append(
                f"Tip mismatch: {tip_state['picked']} picked vs {tip_state['ejected']} ejected"
            )

        balance = abs(volumes["aspirated"] - volumes["dispensed"])
        if volumes["aspirated"] > 0 and balance > volumes["aspirated"] * 0.1:
            result.warnings.append(
                f"Volume imbalance: aspirated={volumes['aspirated']}µL, dispensed={volumes['dispensed']}µL"
            )

        return result

    @staticmethod
    def _extract_func_name(node: ast.Call) -> str | None:
        if isinstance(node.func, ast.Name):
            return node.func.id
        if isinstance(node.func, ast.Attribute):
            return node.func.attr
        return None

    @staticmethod
    def _extract_volume(node: ast.Call) -> float:
        for arg in node.args:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, (int, float)):
                return float(arg.value)
            if isinstance(arg, ast.List):
                total = 0.0
                for elt in arg.elts:
                    if isinstance(elt, ast.Constant) and isinstance(elt.value, (int, float)):
                        total += float(elt.value)
                if total > 0:
                    return total
        for kw in node.keywords:
            if kw.arg in ("volume", "vol"):
                if isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, (int, float)):
                    return float(kw.value.value)
        return 0.0


class VenusSimulator(BaseSimulator):
    """Stub for future Venus integration."""

    def simulate(self, code: str, goal: str) -> SimulationResult:
        raise NotImplementedError("Venus simulator not yet implemented")


def get_simulator(name: str = "mock") -> BaseSimulator:
    simulators = {
        "mock": MockSimulator,
        "venus": VenusSimulator,
    }
    cls = simulators.get(name, MockSimulator)
    return cls()
