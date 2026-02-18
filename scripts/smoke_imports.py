import importlib
import sys
from pathlib import Path

MODULES = [
    "src.etl.extract_aneel",
    "src.etl.transform_aneel",
    "src.etl.schema_contracts",
    "src.analysis.build_analysis_tables",
    "src.analysis.build_report",
    "src.analysis.neoenergia_diagnostico",
    "src.analysis.build_dashboard_data",
    "src.backend.main",
]

OPTIONAL_DEPENDENCIES = {
    "src.backend.main": {"fastapi", "starlette"},
}


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(root))

    skipped = []
    for module_name in MODULES:
        try:
            importlib.import_module(module_name)
        except ModuleNotFoundError as exc:
            optional = OPTIONAL_DEPENDENCIES.get(module_name, set())
            if exc.name in optional:
                skipped.append((module_name, exc.name))
                continue
            raise

    print("Imports OK.")
    for module_name, dep in skipped:
        print(f"Import skipped for optional dependency: {module_name} (missing {dep})")


if __name__ == "__main__":
    main()
