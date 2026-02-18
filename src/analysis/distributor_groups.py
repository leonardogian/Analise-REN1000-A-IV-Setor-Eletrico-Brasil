"""Utilities to resolve distributor and economic group identifiers."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
import unicodedata
from typing import Mapping

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_OVERRIDES_PATH = ROOT / "data" / "config" / "distributor_groups_overrides.json"


@dataclass(frozen=True)
class DistributorGroup:
    group_id: str
    group_label: str
    distributor_ids: list[str]
    distributor_names: list[str]
    selector_enabled: bool


def normalize_group_key(value: object) -> str:
    """Normalize text to uppercase ASCII key with collapsed spaces."""
    if value is None or pd.isna(value):
        return ""
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text).strip().upper()
    return text


def slugify(value: object, *, fallback: str = "desconhecido") -> str:
    """Create a stable lowercase slug identifier."""
    normalized = normalize_group_key(value).lower()
    slug = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")
    return slug or fallback


def build_distributor_id(sigagente: object, nomagente: object | None = None) -> str:
    """Build deterministic distributor id from sigagente (fallback nomagente)."""
    base = normalize_group_key(sigagente) or normalize_group_key(nomagente)
    return slugify(base, fallback="distribuidora_desconhecida")


def infer_group_id(distributor_name: object) -> str:
    """Infer group id using deterministic heuristics."""
    name = normalize_group_key(distributor_name)
    if "NEOENERGIA" in name:
        return "neoenergia"
    if "EQUATORIAL" in name:
        return "equatorial"
    if name.startswith("CPFL "):
        return "cpfl"
    if name.startswith("ENEL "):
        return "enel"
    if name.startswith("ENERGISA "):
        return "energisa"

    tokens = name.split()
    if not tokens:
        return "outros"
    return slugify(tokens[0], fallback="outros")


def default_group_label(group_id: str) -> str:
    words = group_id.replace("_", " ").split()
    return "Grupo " + " ".join(word.upper() if len(word) <= 4 else word.title() for word in words)


def load_group_overrides(
    path: Path = DEFAULT_OVERRIDES_PATH,
) -> tuple[dict[str, str], dict[str, str]]:
    """Load manual group assignment and custom labels from JSON file."""
    if not path.exists():
        return {}, {}

    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Invalid overrides payload: {path}")

    raw_map = payload.get("distributor_to_group", {})
    raw_labels = payload.get("group_labels", {})
    if not isinstance(raw_map, dict) or not isinstance(raw_labels, dict):
        raise ValueError(
            "distributor_groups_overrides.json must contain objects "
            "'distributor_to_group' and 'group_labels'."
        )

    distributor_to_group = {
        slugify(distributor_id): slugify(group_id, fallback="outros")
        for distributor_id, group_id in raw_map.items()
        if str(distributor_id).strip() and str(group_id).strip()
    }
    group_labels = {
        slugify(group_id, fallback="outros"): str(label).strip()
        for group_id, label in raw_labels.items()
        if str(group_id).strip() and str(label).strip()
    }
    return distributor_to_group, group_labels


def resolve_group_id(
    distributor_name: object,
    distributor_id: str,
    distributor_to_group: Mapping[str, str] | None = None,
) -> str:
    """Resolve group id with precedence: override -> heuristics -> fallback token."""
    overrides = distributor_to_group or {}
    if distributor_id in overrides:
        return overrides[distributor_id]
    return infer_group_id(distributor_name)


def annotate_distributor_group(
    frame: pd.DataFrame,
    *,
    sig_col: str = "sigagente",
    name_col: str = "nomagente",
    distributor_to_group: Mapping[str, str] | None = None,
    group_labels: Mapping[str, str] | None = None,
) -> pd.DataFrame:
    """Append distributor_id/group_id/group_label columns to a dataframe."""
    if sig_col not in frame.columns:
        raise KeyError(f"Missing required column: {sig_col}")

    out = frame.copy()
    name_series = (
        out[name_col].astype("string")
        if name_col in out.columns
        else pd.Series([""] * len(out), index=out.index, dtype="string")
    )

    out[sig_col] = out[sig_col].astype("string").str.strip()
    name_series = name_series.astype("string").str.strip()
    out[name_col] = name_series if name_col in out.columns else name_series

    out["distributor_id"] = [
        build_distributor_id(sig, name)
        for sig, name in zip(out[sig_col].tolist(), name_series.tolist())
    ]
    def _first_non_empty_name(name: object, sig: object) -> object:
        if pd.notna(name):
            text = str(name).strip()
            if text:
                return text
        return sig

    out["group_id"] = [
        resolve_group_id(_first_non_empty_name(name, sig), dist_id, distributor_to_group)
        for name, sig, dist_id in zip(name_series.tolist(), out[sig_col].tolist(), out["distributor_id"].tolist())
    ]

    labels = group_labels or {}
    out["group_label"] = out["group_id"].map(lambda gid: labels.get(gid, default_group_label(gid)))
    out["distributor_label"] = name_series.where(name_series.notna() & (name_series != ""), out[sig_col])

    return out


def build_group_dimension(
    frame: pd.DataFrame,
    *,
    sig_col: str = "sigagente",
    name_col: str = "nomagente",
) -> pd.DataFrame:
    """Build governance dimension for economic groups."""
    required = {"group_id", "distributor_id", sig_col}
    missing = required - set(frame.columns)
    if missing:
        raise KeyError(f"Missing required columns to build group dimension: {sorted(missing)}")

    cols = ["group_id", "distributor_id", sig_col]
    if "group_label" in frame.columns:
        cols.append("group_label")
    if name_col in frame.columns:
        cols.append(name_col)

    dim = frame[cols].drop_duplicates(subset=["group_id", "distributor_id"]).copy()
    if "group_label" not in dim.columns:
        dim["group_label"] = dim["group_id"].map(default_group_label)
    if name_col not in dim.columns:
        dim[name_col] = dim[sig_col]
    dim[name_col] = dim[name_col].astype("string").fillna(dim[sig_col].astype("string"))

    counts = dim.groupby("group_id")["distributor_id"].nunique().rename("distributor_count")
    dim = dim.merge(counts, on="group_id", how="left")
    dim["selector_enabled"] = dim["distributor_count"] >= 2

    return dim[
        [
            "group_id",
            "group_label",
            "distributor_id",
            sig_col,
            name_col,
            "distributor_count",
            "selector_enabled",
        ]
    ].sort_values(["group_id", name_col]).reset_index(drop=True)


def to_group_objects(dim_group: pd.DataFrame) -> list[DistributorGroup]:
    """Convert dimension rows into grouped metadata objects."""
    objects: list[DistributorGroup] = []
    for _, block in dim_group.groupby(["group_id", "group_label", "selector_enabled"], dropna=False):
        first = block.iloc[0]
        objects.append(
            DistributorGroup(
                group_id=str(first["group_id"]),
                group_label=str(first["group_label"]),
                distributor_ids=sorted(block["distributor_id"].astype(str).unique().tolist()),
                distributor_names=sorted(block["nomagente"].astype(str).unique().tolist()),
                selector_enabled=bool(first["selector_enabled"]),
            )
        )
    return sorted(objects, key=lambda g: g.group_id)
