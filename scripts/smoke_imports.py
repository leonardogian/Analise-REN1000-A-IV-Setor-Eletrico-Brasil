import importlib
import sys
from pathlib import Path

MODULES = [
    "src.etl.extract_aneel",
    "src.etl.transform_aneel",
    "src.analysis.build_analysis_tables",
    "src.analysis.build_report",
]


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(root))

    for module_name in MODULES:
        importlib.import_module(module_name)
    print("Imports OK.")


if __name__ == "__main__":
    main()
