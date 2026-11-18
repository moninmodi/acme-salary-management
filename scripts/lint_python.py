"""Run Pylint with the repository configuration and score threshold."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    """Run the configured Pylint command from the project root."""
    project_root = Path(__file__).resolve().parent.parent
    command = [
        sys.executable,
        "-m",
        "pylint",
        "--rcfile=.pylintrc",
        "--score=y",
        "backend",
        "tests",
        "scripts",
    ]
    return subprocess.run(command, cwd=project_root, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
