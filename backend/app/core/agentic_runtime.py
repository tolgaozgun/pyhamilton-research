from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from app.config import PYHAMILTON_KNOWN_APIS


def _build_pyhamilton_stub() -> str:
    lines = [
        'from __future__ import annotations',
        '',
        'class _NoOp:',
        '    def __init__(self, *args, **kwargs):',
        '        self.args = args',
        '        self.kwargs = kwargs',
        '',
        '    def __call__(self, *args, **kwargs):',
        '        return None',
        '',
        '    def __enter__(self):',
        '        return self',
        '',
        '    def __exit__(self, exc_type, exc, tb):',
        '        return False',
        '',
        '    def __getattr__(self, _name):',
        '        return _noop',
        '',
        'def _noop(*args, **kwargs):',
        '    return None',
        '',
    ]

    for api in sorted(PYHAMILTON_KNOWN_APIS):
        if api in {"HamiltonInterface", "LayoutManager"}:
            lines.append(f"{api} = _NoOp")
        elif api.isupper():
            lines.append(f"{api} = '{api}'")
        else:
            lines.append(f"def {api}(*args, **kwargs):")
            lines.append("    return None")
        lines.append("")

    lines.append("__all__ = [name for name in globals() if not name.startswith('_')]")
    return "\n".join(lines)


def _run_command(args: list[str], cwd: Path, env: dict[str, str], timeout: int = 30) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            args,
            cwd=str(cwd),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "passed": completed.returncode == 0,
            "exit_code": completed.returncode,
            "stdout": completed.stdout,
            "stderr": completed.stderr,
            "command": " ".join(args),
        }
    except subprocess.TimeoutExpired as exc:
        return {
            "passed": False,
            "exit_code": -1,
            "stdout": exc.stdout or "",
            "stderr": (exc.stderr or "") + "\nCommand timed out.",
            "command": " ".join(args),
        }


def _build_env(workdir: Path) -> dict[str, str]:
    env = os.environ.copy()
    pythonpath_parts = [str(workdir)]
    repo_root = str(Path(__file__).resolve().parents[3])
    if repo_root not in pythonpath_parts:
        pythonpath_parts.append(repo_root)
    existing = env.get("PYTHONPATH")
    if existing:
        pythonpath_parts.append(existing)
    env["PYTHONPATH"] = os.pathsep.join(pythonpath_parts)
    return env


def run_python_interpreter(code: str) -> dict[str, Any]:
    """Execute code in a temp workspace with PyHamilton stubs."""
    with tempfile.TemporaryDirectory(prefix="agentic-runtime-") as temp_dir:
        workdir = Path(temp_dir)
        (workdir / "pyhamilton.py").write_text(_build_pyhamilton_stub(), encoding="utf-8")
        (workdir / "hamilton.py").write_text("from pyhamilton import *\n", encoding="utf-8")
        script_path = workdir / "generated_script.py"
        script_path.write_text(code, encoding="utf-8")

        env = _build_env(workdir)
        return _run_command([sys.executable, str(script_path)], workdir, env)


def run_pytest_suite(test_code: str) -> dict[str, Any]:
    """Run a generated pytest file in an isolated temp workspace."""
    with tempfile.TemporaryDirectory(prefix="agentic-tests-") as temp_dir:
        workdir = Path(temp_dir)
        (workdir / "pyhamilton.py").write_text(_build_pyhamilton_stub(), encoding="utf-8")
        (workdir / "hamilton.py").write_text("from pyhamilton import *\n", encoding="utf-8")
        test_path = workdir / "test_generated.py"
        test_path.write_text(test_code, encoding="utf-8")

        env = _build_env(workdir)
        return _run_command([sys.executable, "-m", "pytest", "-q", str(test_path)], workdir, env)
