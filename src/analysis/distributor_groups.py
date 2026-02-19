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
DEFAULT_NAMES_OVERRIDES_PATH = ROOT / "data" / "config" / "distributor_names_overrides.json"


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
    if re.match(r"^CPFL(\s|-|$)", name):
        return "cpfl"
    if re.match(r"^ENEL(\s|-|$)", name):
        return "enel"
    if re.match(r"^ENERGISA(\s|-|$)", name):
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


def load_distributor_name_overrides(
    path: Path = DEFAULT_NAMES_OVERRIDES_PATH,
) -> dict[str, dict[str, str]]:
    """Load manual name normalization and aliases by distributor_id."""
    if not path.exists():
        return {}

    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Invalid names overrides payload: {path}")

    raw_map = payload.get("distributor_name_overrides", {})
    raw_aliases = payload.get("distributor_aliases", {})
    if not isinstance(raw_map, dict):
        raise ValueError("distributor_names_overrides.json must contain object 'distributor_name_overrides'.")
    if not isinstance(raw_aliases, dict):
        raise ValueError("distributor_names_overrides.json must contain object 'distributor_aliases'.")

    normalized: dict[str, dict[str, str]] = {}
    canonical_map: dict[str, str] = {}
    for distributor_id, item in raw_map.items():
        if not str(distributor_id).strip() or not isinstance(item, dict):
            continue
        dist_id = slugify(distributor_id)
        sig_name = str(item.get("sigagente", "")).strip()
        legal_name = str(item.get("nomagente", "")).strip()
        if not sig_name and not legal_name:
            continue
        normalized[dist_id] = {
            "sigagente": sig_name,
            "nomagente": legal_name,
            "canonical_id": dist_id,
        }
        canonical_map[dist_id] = dist_id

    for alias_id, canonical_id in raw_aliases.items():
        if not str(alias_id).strip() or not str(canonical_id).strip():
            continue
        alias_slug = slugify(alias_id)
        canonical_slug = slugify(canonical_id)
        canonical_map[alias_slug] = canonical_slug

    for alias_id, canonical_id in canonical_map.items():
        target = normalized.get(canonical_id, {})
        normalized[alias_id] = {
            "sigagente": str(target.get("sigagente", "")).strip(),
            "nomagente": str(target.get("nomagente", "")).strip(),
            "canonical_id": canonical_id,
        }
    return normalized


def resolve_group_id(
    distributor_name: object,
    distributor_id: str,
    distributor_to_group: Mapping[str, str] | None = None,
) -> str:
    """Resolve group id with precedence: override -> heuristics -> fallback token."""
    overrides = distributor_to_group or {}
    if distributor_id in overrides:
        return overrides[distributor_id]
    if distributor_id.startswith("neoenergia_"):
        return "neoenergia"
    if distributor_id.startswith("cpfl_"):
        return "cpfl"
    if distributor_id.startswith("equatorial_"):
        return "equatorial"
    if distributor_id.startswith("enel_"):
        return "enel"
    if distributor_id.startswith("energisa_"):
        return "energisa"
    return infer_group_id(distributor_name)


def annotate_distributor_group(
    frame: pd.DataFrame,
    *,
    sig_col: str = "sigagente",
    name_col: str = "nomagente",
    distributor_to_group: Mapping[str, str] | None = None,
    group_labels: Mapping[str, str] | None = None,
    distributor_name_overrides: Mapping[str, dict[str, str]] | None = None,
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

    sig_series = out[sig_col].astype("string").str.strip()
    name_series = name_series.astype("string").str.strip()
    out[sig_col] = sig_series
    out[name_col] = name_series if name_col in out.columns else name_series

    raw_distributor_ids = [
        build_distributor_id(sig, name)
        for sig, name in zip(sig_series.tolist(), name_series.tolist())
    ]

    name_overrides = distributor_name_overrides or {}
    name_sig_values: list[str] = []
    name_legal_values: list[str] = []

    def _text(value: object) -> str:
        if value is None or pd.isna(value):
            return ""
        return str(value).strip()

    canonical_ids: list[str] = []
    for sig, legal, dist_id in zip(sig_series.tolist(), name_series.tolist(), raw_distributor_ids):
        mapped = name_overrides.get(dist_id, {})
        canonical_id = slugify(mapped.get("canonical_id", dist_id), fallback=dist_id)
        canonical_ids.append(canonical_id)
        sig_name = str(mapped.get("sigagente", "")).strip() or _text(sig)
        legal_name = str(mapped.get("nomagente", "")).strip() or _text(legal)
        if not legal_name:
            legal_name = sig_name
        name_sig_values.append(sig_name)
        name_legal_values.append(legal_name)

    out["distributor_id"] = pd.Series(canonical_ids, index=out.index, dtype="string")

    out["distributor_name_sig"] = pd.Series(name_sig_values, index=out.index, dtype="string")
    out["distributor_name_legal"] = pd.Series(name_legal_values, index=out.index, dtype="string")
    out[sig_col] = out["distributor_name_sig"]
    out[name_col] = out["distributor_name_legal"]

    out["group_id"] = [
        resolve_group_id(sig, dist_id, distributor_to_group)
        for sig, dist_id in zip(out["distributor_name_sig"].tolist(), out["distributor_id"].tolist())
    ]

    labels = group_labels or {}
    out["group_label"] = out["group_id"].map(lambda gid: labels.get(gid, default_group_label(gid)))
    out["distributor_label"] = [
        sig if not legal or sig == legal else f"{sig} — {legal}"
        for sig, legal in zip(out["distributor_name_sig"].tolist(), out["distributor_name_legal"].tolist())
    ]

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
    if "distributor_name_sig" in frame.columns:
        cols.append("distributor_name_sig")
    if "distributor_name_legal" in frame.columns:
        cols.append("distributor_name_legal")
    if "distributor_label" in frame.columns:
        cols.append("distributor_label")

    dim = frame[cols].drop_duplicates(subset=["group_id", "distributor_id"]).copy()
    if "group_label" not in dim.columns:
        dim["group_label"] = dim["group_id"].map(default_group_label)
    if name_col not in dim.columns:
        dim[name_col] = dim[sig_col]
    dim[name_col] = dim[name_col].astype("string").fillna(dim[sig_col].astype("string"))
    if "distributor_name_sig" not in dim.columns:
        dim["distributor_name_sig"] = dim[sig_col].astype("string")
    if "distributor_name_legal" not in dim.columns:
        dim["distributor_name_legal"] = dim[name_col].astype("string")
    if "distributor_label" not in dim.columns:
        dim["distributor_label"] = [
            sig if sig == legal or not legal else f"{sig} — {legal}"
            for sig, legal in zip(dim["distributor_name_sig"].astype(str), dim["distributor_name_legal"].astype(str))
        ]

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
            "distributor_name_sig",
            "distributor_name_legal",
            "distributor_label",
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
                distributor_names=sorted(block["distributor_label"].astype(str).unique().tolist()),
                selector_enabled=bool(first["selector_enabled"]),
            )
        )
    return sorted(objects, key=lambda g: g.group_id)
