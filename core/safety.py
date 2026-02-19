"""Static safety analysis for generated PyHamilton scripts.

Used in Developer and Agentic modes for syntax checking (pipeline step 5).
"""

import ast
import re
from dataclasses import dataclass, field
from enum import Enum

from config import PYHAMILTON_KNOWN_APIS


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class SafetyIssue:
    message: str
    severity: Severity
    line: int | None = None


@dataclass
class SafetyReport:
    issues: list[SafetyIssue] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not any(i.severity == Severity.ERROR for i in self.issues)

    @property
    def has_warnings(self) -> bool:
        return any(i.severity == Severity.WARNING for i in self.issues)

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.ERROR)

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.WARNING)


def check_syntax(script: str) -> SafetyReport:
    """Check whether the script is valid Python."""
    report = SafetyReport()
    try:
        ast.parse(script)
    except SyntaxError as e:
        report.issues.append(SafetyIssue(
            message=f"Syntax error: {e.msg}",
            severity=Severity.ERROR,
            line=e.lineno,
        ))
    return report


def check_api_hallucinations(script: str) -> SafetyReport:
    """Flag calls that look like PyHamilton API but aren't in the known set."""
    report = SafetyReport()
    call_pattern = re.compile(
        r'\b((?:ham_int|pyhamilton)\.\w+|\b(?:aspirate|dispense|tip_pick_up|tip_eject|initialize|grip_get|grip_place|move_sequence)\w*)\s*\('
    )
    for i, line in enumerate(script.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        for match in call_pattern.finditer(stripped):
            func_name = match.group(1).split(".")[-1]
            if func_name and func_name not in PYHAMILTON_KNOWN_APIS and not func_name.startswith("_"):
                report.issues.append(SafetyIssue(
                    message=f"Possible API hallucination: '{func_name}' not in known PyHamilton API",
                    severity=Severity.WARNING,
                    line=i,
                ))
    return report


def run_syntax_check(script: str) -> SafetyReport:
    """Full syntax + hallucination check for pipeline step 5."""
    combined = SafetyReport()

    syntax = check_syntax(script)
    combined.issues.extend(syntax.issues)
    if not syntax.passed:
        return combined

    combined.issues.extend(check_api_hallucinations(script).issues)
    return combined
