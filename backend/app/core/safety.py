from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field

from app.config import PYHAMILTON_KNOWN_APIS


@dataclass
class SafetyIssue:
    severity: str  # "error" | "warning"
    message: str
    line: int | None = None


@dataclass
class SafetyReport:
    passed: bool = True
    issues: list[SafetyIssue] = field(default_factory=list)

    def add(self, issue: SafetyIssue) -> None:
        self.issues.append(issue)
        if issue.severity == "error":
            self.passed = False


def check_syntax(code: str) -> list[SafetyIssue]:
    issues: list[SafetyIssue] = []
    try:
        ast.parse(code)
    except SyntaxError as exc:
        issues.append(SafetyIssue(
            severity="error",
            message=f"SyntaxError: {exc.msg}",
            line=exc.lineno,
        ))
    return issues


def check_api_hallucinations(code: str) -> list[SafetyIssue]:
    issues: list[SafetyIssue] = []
    call_pattern = re.compile(r"\b(\w+)\s*\(")
    hamilton_import_pattern = re.compile(
        r"(?:from\s+pyhamilton|from\s+hamilton|import\s+pyhamilton|import\s+hamilton)"
    )

    if not hamilton_import_pattern.search(code):
        return issues

    for i, line in enumerate(code.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith("import") or stripped.startswith("from"):
            continue
        for match in call_pattern.finditer(line):
            func_name = match.group(1)
            if func_name in {"print", "range", "len", "int", "str", "float", "list",
                             "dict", "set", "tuple", "type", "isinstance", "enumerate",
                             "zip", "map", "filter", "sorted", "reversed", "open",
                             "super", "property", "staticmethod", "classmethod",
                             "hasattr", "getattr", "setattr", "delattr", "callable",
                             "any", "all", "min", "max", "sum", "abs", "round",
                             "input", "format", "repr", "id", "hash", "iter", "next",
                             "bool", "bytes", "bytearray", "memoryview", "complex",
                             "frozenset", "chr", "ord", "hex", "oct", "bin", "pow",
                             "divmod", "vars", "dir", "globals", "locals", "exec", "eval",
                             "compile", "breakpoint", "object", "slice", "Exception",
                             "ValueError", "TypeError", "KeyError", "IndexError",
                             "RuntimeError", "AttributeError", "ImportError",
                             "FileNotFoundError", "OSError", "StopIteration",
                             "NotImplementedError", "AssertionError"}:
                continue
            if func_name[0].isupper() and func_name not in PYHAMILTON_KNOWN_APIS:
                continue
            if func_name.startswith("_"):
                continue
            if func_name in PYHAMILTON_KNOWN_APIS:
                continue
            # Heuristic: flag function calls that look like they could be Hamilton API
            # but aren't in the known set, only if they follow hamilton-style naming
            if re.match(r"^(tip_|aspirate|dispense|grip_|move_|assign_|edit_|get_|set_|load_)", func_name):
                issues.append(SafetyIssue(
                    severity="warning",
                    message=f"Possible hallucinated API: '{func_name}' not in known PyHamilton APIs",
                    line=i,
                ))
    return issues


def run_syntax_check(code: str) -> SafetyReport:
    report = SafetyReport()
    for issue in check_syntax(code):
        report.add(issue)
    for issue in check_api_hallucinations(code):
        report.add(issue)
    return report
