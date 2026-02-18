#!/usr/bin/env python3
"""Simple environment doctor for local execution."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT / ".venv" / "bin" / "python"
REQUIRED_MODULES = ["numpy", "pandas", "fastapi", "uvicorn"]


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True)


def check_python_binary(path: Path) -> tuple[bool, str]:
    if not path.exists():
        return False, f"{path} not found"
    if not os.access(path, os.X_OK):
        return False, f"{path} is not executable"
    version = run([str(path), "--version"])
    if version.returncode != 0:
        stderr = (version.stderr or "").strip()
        return False, f"{path} cannot execute ({stderr or 'unknown error'})"
    return True, (version.stdout or version.stderr).strip()


def check_imports(path: Path, modules: list[str]) -> tuple[bool, str]:
    code = (
        "import importlib.util,sys\n"
        f"mods={modules!r}\n"
        "missing=[m for m in mods if importlib.util.find_spec(m) is None]\n"
        "print(','.join(missing))\n"
        "sys.exit(1 if missing else 0)\n"
    )
    result = run([str(path), "-c", code])
    if result.returncode == 0:
        return True, "all required imports are available"
    missing = (result.stdout or "").strip()
    if missing:
        return False, f"missing modules: {missing}"
    stderr = (result.stderr or "").strip()
    return False, f"import check failed: {stderr or 'unknown error'}"


def main() -> int:
    print("== Environment doctor ==")
    print(f"Project root: {ROOT}")
    print(f"Expected venv python: {VENV_PYTHON}")

    binary_ok, binary_msg = check_python_binary(VENV_PYTHON)
    print(f"[{'OK' if binary_ok else 'ERR'}] venv python: {binary_msg}")
    if not binary_ok:
        print("\nSuggested recovery:")
        print("  1) make venv-recreate")
        print("  2) make install")
        print("  3) make doctor")
        return 1

    imports_ok, imports_msg = check_imports(VENV_PYTHON, REQUIRED_MODULES)
    print(f"[{'OK' if imports_ok else 'ERR'}] required imports: {imports_msg}")
    if not imports_ok:
        print("\nSuggested recovery:")
        print("  1) make install")
        print("  2) make doctor")
        return 1

    print("\nEnvironment looks healthy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
