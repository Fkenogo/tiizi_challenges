#!/usr/bin/env python3
"""Reconcile S6 consultant batches against Tiizi identity and measurement authority.

Run from repository root with three consultant JSON paths. The utility writes a
candidate, provenance map, and fail-closed validation report. It never writes to
PostgreSQL or changes publication/eligibility state.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "docs/programme/working/s6-content/activity-master-inventory.json"
BASELINE = ROOT / "docs/governance/knowledge/working-baselines/TIIZI-V2-INITIAL-CANONICAL-ACTIVITY-BASELINE-FOUNDER-WORKING-BASELINE.md"
TEMPLATE = ROOT / "docs/programme/working/s6-content/activity-content-template.json"
OUTPUT = ROOT / "docs/programme/working/s6-content"
METRICS = ("completion", "repetitions", "duration", "distance", "weight", "quantity")
UNITS_BY_METRIC = {
    "completion": ["completion"],
    "repetitions": ["reps"],
    "duration": ["seconds", "minutes", "hours"],
    "distance": ["metres", "kilometres"],
    "weight": ["grams", "kilograms"],
    "quantity": ["steps", "millilitres", "litres", "servings", "pages", "acts", "flights"],
}
UNIT_METRIC = {u: m for m, units in UNITS_BY_METRIC.items() for u in units}
LOAD_BASES = {"TOTAL_LOADED_IMPLEMENT", "PER_IMPLEMENT", "SINGLE_IMPLEMENT", "PER_SIDE", "MACHINE_DISPLAYED_LOAD"}
CONTENT_FIELDS = (
    "description", "measurementGuidance", "unitSemantics", "setup", "execution",
    "techniqueReference", "formCues", "commonMistakes", "equipment", "environment",
    "adaptation", "protocolSteps", "sessionFraming", "completionMeaning",
    "avoidanceCondition", "semanticDefinition", "safetyNotes",
)
SYSTEM_FIELDS = {
    "knowledgeId", "knowledge_id", "uuid", "id", "status", "publicationStatus",
    "publicationReady", "challengeEligible", "composerSelectable", "version",
    "versionId", "createdAt", "updatedAt", "publishedAt", "provenance", "authority",
}
REVIEW_CODE = "WEL-NUT-009"
WEIGHT_REVIEW_CODES = {"FIT-STR-019", "FIT-STR-023", "FIT-STR-025", "FIT-STR-036"}
SERVING_REVIEW_CODES = {"WEL-NUT-002", "WEL-NUT-003"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_measurements() -> dict[str, dict[str, list[str]]]:
    """Read Activity-local compatible Metrics/Units from the governed baseline tables."""
    lines = BASELINE.read_text(encoding="utf-8").splitlines()
    result: dict[str, dict[str, list[str]]] = {}
    id_re = re.compile(r"\b((?:FIT|WEL)-[A-Z]{3}-\d{3})\b")
    unit_words = [u for metric in METRICS for u in UNITS_BY_METRIC[metric]]
    for i, line in enumerate(lines):
        match = id_re.search(line)
        if not match:
            continue
        code = match.group(1)
        block = [line]
        for next_line in lines[i + 1 :]:
            if not next_line.strip() or id_re.search(next_line):
                break
            block.append(next_line)
        text = " ".join(block)
        allowed_metrics = [m for m in METRICS if re.search(rf"\b{m}\b", text, re.I)]
        allowed_units = [u for u in unit_words if re.search(rf"\b{re.escape(u)}\b", text, re.I)]
        if code in result:
            continue
        result[code] = {"metrics": allowed_metrics, "units": allowed_units}
    return result


def nonempty(value: Any) -> bool:
    return value is not None and value != "" and value != []


def content_of(record: dict[str, Any]) -> dict[str, Any]:
    return record.get("content") if isinstance(record.get("content"), dict) else {}


def safe_text(value: str, field: str = "") -> str:
    value = re.sub(r"\s+", " ", value).strip()
    # Normalize anatomical uses of "target"; challenge targets and schedules
    # do not belong in canonical Activity content.
    value = re.sub(r"\btarget (muscle groups?|joints?|regions?)\b", r"selected \1", value, flags=re.I)
    value = re.sub(r"\btarget depth\b", "comfortable depth", value, flags=re.I)
    value = re.sub(r"\btarget height\b", "comfortable height", value, flags=re.I)
    value = re.sub(r"\btarget position\b", "comfortable position", value, flags=re.I)
    value = re.sub(r"\btarget major muscle groups\b", "major muscle groups", value, flags=re.I)
    value = re.sub(r"\bplanned duration\b", "duration being recorded", value, flags=re.I)
    value = re.sub(r"\bplanned time\b", "practice time being recorded", value, flags=re.I)
    value = re.sub(r"\bplanned bedtime\b", "bedtime occurrence being recorded", value, flags=re.I)
    value = re.sub(r"\bplanned wake time\b", "wake-time occurrence being recorded", value, flags=re.I)
    value = re.sub(r"\bplanned (?:[A-Za-z-]+\s+){0,2}(session|practice|entry|meal|snack|episode|interaction|task|break|period|block)\b", r"\1 being recorded", value, flags=re.I)
    value = re.sub(r"\bpage target\b", "page count being recorded", value, flags=re.I)
    value = re.sub(r"\bvisual target\b", "stable point", value, flags=re.I)
    value = re.sub(r"\btarget to reach toward\b", "marker to reach toward", value, flags=re.I)
    value = re.sub(r"\btracking period(?:\s*\([^)]*\))?", "occasion being recorded", value, flags=re.I)
    value = re.sub(r"\btarget timeframe\b|\bdesignated target day\b|\btarget period\b", "occasion being recorded", value, flags=re.I)
    value = re.sub(r"\btarget time\b|\btarget duration\b|\bintended bedtime\b|\btarget wake time\b", "the time being recorded", value, flags=re.I)
    value = re.sub(r"\b(?:daily|nightly) (practice|routine|nutrition|setting|recovery practice)\b", r"repeatable \1", value, flags=re.I)
    value = re.sub(r"\bconsistent sleep scheduling supports circadian rhythm health\b", "", value, flags=re.I)
    value = re.sub(r"\bplanned number of\b", "actual number of", value, flags=re.I)
    value = re.sub(r"\bplanned (?:volume|servings?|avoidance|cutoff|cut-off)\b", "applicable", value, flags=re.I)
    # Remove unsupported outcome claims and medical/diagnostic instructions.
    forbidden = re.compile(
        r"\b(cures?|treats?|prevents?\s+(?:disease|illness)|detox(?:ifies|ification)|"
        r"guarantees?\s+(?:health|wellness|weight)|diagnos(?:e|is|tic)|prescrib(?:e|es|ed)|"
        r"rehabilitat(?:e|ion)|therapeutic(?:ally)?|clinically proven|medical(?:ly)? safe|"
        r"heart-rate zone|blood pressure threshold|diabetes|pregnan(?:t|cy)|eating disorder|"
        r"concussion symptoms|disease-specific)\b", re.I)
    unsupported_benefit = re.compile(r"\b(?:supports?|improves?|enhances?|boosts?|promotes?)\s+(?:positive affect|emotional regulation|circadian|cognitive function|dietary quality|micronutrient intake|blood glucose|cardiovascular health|overall health|mental health|sleep quality|recovery)\b", re.I)
    # Drop a whole sentence when it carries a forbidden claim; retain adjacent useful guidance.
    sentences = re.split(r"(?<=[.!?])\s+", value)
    schedule_or_target = re.compile(
        r"\b(?:daily|nightly|per day|each day|weekly|per week|monthly|per month|across the week|target (?:time|duration|servings?|volume|period|day)|"
        r"planned daily|planned weekly|fixed target time|intended bedtime|target wake time|consistent bedtime|"
        r"planned period|planned number|planned [a-z-]+ target|target timeframe|designated target|cutoff time|cut-off time)\b|"
        r"\b\d+[- ](?:minute|hour|day|week)\b|\b\d{1,2}:\d{2}\b", re.I)
    if field in set(CONTENT_FIELDS):
        sentences = [s for s in sentences if not schedule_or_target.search(s)]
    kept = [s for s in sentences if not forbidden.search(s) and not unsupported_benefit.search(s)]
    return " ".join(kept).strip()


def rank_text(field: str, value: str) -> tuple[int, int, int]:
    words = re.findall(r"[A-Za-z0-9]+", value)
    # Prefer concise, informative instructions over long boilerplate.
    cap = {"description": 55, "measurementGuidance": 45, "setup": 35, "execution": 55,
           "unitSemantics": 40, "adaptation": 40, "environment": 24, "equipment": 20,
           "sessionFraming": 35, "completionMeaning": 35, "avoidanceCondition": 30,
           "semanticDefinition": 35, "techniqueReference": 25}.get(field, 40)
    action = len(re.findall(r"\b(start|place|keep|lower|raise|press|report|count|record|choose|use|stop|repeat|follow|sit|stand|walk|breathe|read|write|mark|complete)\b", value, re.I))
    specifics = len(re.findall(r"\b(per|each|one|when|until|through|between|toward|across|total|continuous)\b", value, re.I))
    return min(len(words), cap), action, specifics


def merge_scalar(field: str, sources: list[tuple[str, Any]]) -> tuple[Any, list[str]]:
    choices: list[tuple[tuple[int, int, int], str, str]] = []
    for source, raw in sources:
        if not isinstance(raw, str) or not raw.strip():
            continue
        value = safe_text(raw, field)
        if value:
            choices.append((rank_text(field, value), source, value))
    if not choices:
        return None, []
    choices.sort(key=lambda x: (x[0], -int(x[1][-1])), reverse=True)
    # Consensus identical content is preferred when quality is effectively tied.
    best_score = choices[0][0]
    tied = [x for x in choices if x[0] == best_score]
    if tied:
        frequencies = Counter(x[2].casefold() for x in choices)
        chosen = max(tied, key=lambda x: frequencies[x[2].casefold()])
    else:
        chosen = choices[0]
    return chosen[2], [chosen[1]]


def merge_array(field: str, records: list[tuple[str, Any]], limit: int = 5) -> tuple[list[Any], list[str]]:
    if field == "protocolSteps":
        sequences: list[tuple[tuple[int, int], str, list[Any]]] = []
        for source, raw in records:
            if not isinstance(raw, list):
                continue
            cleaned: list[Any] = []
            for step in raw:
                if isinstance(step, str):
                    text = safe_text(step, field)
                    if text:
                        cleaned.append(text)
                elif isinstance(step, dict) and isinstance(step.get("text"), str):
                    text = safe_text(step["text"], field)
                    if text:
                        item = {"text": text}
                        if isinstance(step.get("title"), str) and step["title"].strip():
                            item["title"] = step["title"].strip()
                        cleaned.append(item)
            if cleaned:
                score = (len(cleaned), sum(len(re.findall(r"[A-Za-z0-9]+", str(x))) for x in cleaned))
                sequences.append((score, source, cleaned))
        if not sequences:
            return [], []
        sequences.sort(key=lambda x: (x[0], -int(x[1][-1])), reverse=True)
        chosen = sequences[0]
        return chosen[2], [chosen[1]]
    collected: list[tuple[tuple[int, int, int], str, Any]] = []
    for source, raw in records:
        if not isinstance(raw, list):
            continue
        for item in raw:
            if isinstance(item, str):
                item = safe_text(item, field)
                if not item:
                    continue
                score = rank_text(field, item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                item = {k: safe_text(v, field) if isinstance(v, str) else v for k, v in item.items()}
                if not item.get("text"):
                    continue
                score = rank_text(field, item.get("text", ""))
            else:
                continue
            collected.append((score, source, item))
    collected.sort(key=lambda x: (x[0], -int(x[1][-1])), reverse=True)
    output: list[Any] = []
    used: set[str] = set()
    provenance: list[str] = []
    for _, source, item in collected:
        key = json.dumps(item, sort_keys=True, ensure_ascii=False).casefold()
        if key in used:
            continue
        used.add(key)
        output.append(item)
        if source not in provenance:
            provenance.append(source)
        if len(output) >= limit:
            break
    return output, provenance


def resolve_contract(code: str, source_records: list[dict[str, Any]], allowed: dict[str, list[str]]) -> tuple[dict[str, Any], dict[str, Any]]:
    placements: Counter[str] = Counter()
    primary_votes: Counter[str] = Counter()
    secondary_votes: Counter[str] = Counter()
    base_votes: Counter[str] = Counter()
    component_votes: Counter[str] = Counter()
    for record in source_records:
        contract = record.get("measurementContract", {})
        primary = contract.get("primaryMetrics", []) if isinstance(contract, dict) else []
        secondary = contract.get("secondaryMetrics", []) if isinstance(contract, dict) else []
        for metric in set(primary + secondary):
            placements[metric] += 1
        primary_votes.update(set(primary))
        secondary_votes.update(set(secondary))
        base_votes.update(set(contract.get("loadReportingBases", []) if isinstance(contract, dict) else []))
        for component in contract.get("components", []) if isinstance(contract, dict) else []:
            if isinstance(component, dict):
                component_votes[json.dumps(component, sort_keys=True)] += 1

    # The governed candidate baseline defines the complete compatible metric and
    # unit set. Consultant voting is captured below for provenance, never used to
    # add or remove those Product Truth relationships. The settled metric model
    # treats Weight as contextual/secondary by default; the remaining baseline
    # measurements are primary reporting modes. Completion is included only
    # where the baseline explicitly permits it, never inferred from Streak use.
    selected = list(allowed["metrics"])
    primary = [m for m in selected if m != "weight"]
    secondary = [m for m in selected if m == "weight"]
    units = list(allowed["units"])
    # `repetitions` is an accepted alias; `reps` is the canonical display spelling.
    if "reps" in units and "repetitions" in units:
        units.remove("repetitions")
    if code == "WEL-NUT-009":
        units = ["hours"]
    bases = sorted([b for b in base_votes if b in LOAD_BASES and base_votes[b] >= 2]) if "weight" in selected else []
    components = [json.loads(s) for s, n in component_votes.items() if n >= 2]
    contract = {
        "primaryMetrics": primary,
        "secondaryMetrics": secondary,
        "compatibleUnits": units,
        "loadReportingBases": bases,
        "components": components,
    }
    evidence = {
        "contractAuthority": "118-Activity governed baseline; consultant contracts recorded as proposals only",
        "consultantMetricPlacements": {m: placements[m] for m in allowed["metrics"]},
        "primaryVotes": {m: primary_votes[m] for m in allowed["metrics"]},
        "secondaryVotes": {m: secondary_votes[m] for m in allowed["metrics"]},
        "loadBasisVotes": {b: base_votes[b] for b in sorted(base_votes)},
        "sourceComponentConsensus": len(components),
    }
    return contract, evidence


def build_candidate(paths: list[Path]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    manifest = load_json(INVENTORY)["activities"]
    source_data = [load_json(p) for p in paths]
    source_maps: list[dict[str, dict[str, Any]]] = []
    for data in source_data:
        if data.get("schemaVersion") != "1.0.0" or not isinstance(data.get("records"), list):
            raise ValueError("Consultant input does not match S6 batch v1 schema")
        mapping: dict[str, dict[str, Any]] = {}
        for row in data["records"]:
            code = row.get("activityCode")
            if not isinstance(code, str) or code in mapping:
                raise ValueError(f"Missing/duplicate Activity Code in consultant batch: {code!r}")
            mapping[code] = row
        source_maps.append(mapping)
    expected = {r["activityCode"]: r for r in manifest}
    if len(expected) != 118 or len({r.get("candidateId") for r in manifest}) != 118:
        raise ValueError("Canonical identity manifest must contain 118 unique Activity Codes and candidate identities")
    for index, mapping in enumerate(source_maps, start=1):
        missing_codes = sorted(set(expected) - set(mapping))
        unexpected_codes = sorted(set(mapping) - set(expected))
        if missing_codes or unexpected_codes or len(mapping) != len(expected):
            raise ValueError(f"Consultant {index} batch does not reconcile exactly: missing={missing_codes}, unexpected={unexpected_codes}")
    allowed = canonical_measurements()
    provenance: dict[str, Any] = {}
    records: list[dict[str, Any]] = []
    contract_disagreements: list[dict[str, Any]] = []
    for identity in manifest:
        code = identity["activityCode"]
        rows = [m[code] for m in source_maps if code in m]
        if len(rows) != 3:
            raise ValueError(f"Expected all three consultant records for {code}; got {len(rows)}")
        for row in rows:
            for key in ("activityCode", "candidateId", "name", "domain", "category", "classification", "family"):
                if row.get(key) != identity.get(key):
                    raise ValueError(f"Consultant identity drift for {code}.{key}: {row.get(key)!r}")
        if code not in allowed or not allowed[code]["metrics"] or not allowed[code]["units"]:
            raise ValueError(f"No governed measurement tuple found for {code}")

        content_sources = [(f"consultant-{i+1}", content_of(row)) for i, row in enumerate(rows)]
        content: dict[str, Any] = {}
        field_sources: dict[str, list[str]] = {}
        for field in CONTENT_FIELDS:
            candidates = [(source, values.get(field)) for source, values in content_sources]
            if field in {"formCues", "commonMistakes", "protocolSteps", "safetyNotes"}:
                merged, used = merge_array(field, candidates)
                if merged:
                    content[field] = merged
                    field_sources[field] = used
            else:
                value, used = merge_scalar(field, candidates)
                if value:
                    content[field] = value
                    field_sources[field] = used

        # Canonical PF-01 exemplars are Product Truth for these two existing records.
        if code == "FIT-STR-001":
            exemplar = {
                "description": "A foundational bodyweight pushing movement performed from a plank position, lowering the chest toward the floor and pressing back up.",
                "measurementGuidance": "Count one repetition for each full controlled lowering and press back to the starting plank. Report total repetitions per session.",
                "unitSemantics": "One rep equals one complete down-and-up cycle counted when the chest lowers with control and the arms fully extend without resting on the floor.",
                "setup": "Start in a high plank with hands under shoulders, body in a straight line from head to heels, core braced.",
                "execution": "Lower the chest toward the floor by bending the elbows close to the body, then press through the palms to full arm extension while keeping the body straight.",
                "formCues": ["Keep your body in a straight line", "Brace your core throughout", "Lower with control; do not drop"],
                "commonMistakes": ["Hips sagging or piking", "Flaring the elbows wide", "Partial range of motion"],
                "equipment": "None required",
                "environment": "Flat stable floor surface with enough space to lie prone",
                "adaptation": "Beginners may perform incline push-ups against a raised surface or from the knees while keeping the trunk straight.",
                "safetyNotes": ["Stop if you feel sharp pain in shoulders, wrists or lower back", "Keep wrists stacked under shoulders to avoid strain"],
            }
            content.update(exemplar)
            field_sources.update({k: ["Tiizi PF-01 exemplar"] for k in exemplar})
        if code == "WEL-MND-003":
            exemplar = {
                "description": "A guided slow-breathing session practiced seated or lying down, following a simple inhale-hold-exhale rhythm.",
                "measurementGuidance": "Report session length in whole minutes, or mark the session complete when the guided protocol is finished, whichever the challenge tracks.",
                "unitSemantics": "One minute equals sixty seconds of guided practice; completion means the full protocol below was followed to its end.",
                "protocolSteps": [
                    "Sit or lie down in a comfortable position with the back supported.",
                    "Breathe in slowly through the nose for a count of four.",
                    "Hold gently for a count of four.",
                    "Breathe out slowly through the mouth for a count of six.",
                    "Repeat the cycle for the chosen session length, then breathe normally.",
                ],
                "sessionFraming": "A quiet seated or lying session of slow guided breathing, practiced at rest.",
                "completionMeaning": "A session counts as complete when every protocol step above has been followed through to the final normal breath.",
                "safetyNotes": ["Practice seated or lying down in a safe place", "Stop and breathe normally if you feel dizzy or uncomfortable"],
            }
            content.update(exemplar)
            field_sources.update({k: ["Tiizi PF-01 exemplar"] for k in exemplar})
            content["measurementGuidance"] = "Report the session duration in whole minutes when Duration is the measure, or mark completion after following the full protocol when Completion is the measure."
            content["execution"] = "Follow the guided inhale-hold-exhale pattern at a comfortable pace. Do not force the breath; stop and breathe normally if uncomfortable."
            field_sources.update({k: ["PF-01 exemplar reconciled to Activity/Challenge boundary"] for k in ("measurementGuidance", "execution")})
        if code == REVIEW_CODE:
            fasting_content = {
                "description": "A time-bounded eating pattern in which the participant goes without food for a defined period. This Activity records the actual elapsed fasting duration and does not prescribe a protocol or personal target.",
                "measurementGuidance": "Report the actual elapsed fasting time in hours. Keep the reported value in hours; do not convert it to days.",
                "unitSemantics": "One hour is sixty minutes of elapsed time within the fasting period. Record the actual duration in hours without converting to days.",
                "setup": "Identify the beginning and end of the fasting period being recorded. This guide does not set its duration, frequency, or intake rules.",
                "execution": "Follow the fasting period being recorded, then enter the total elapsed time in hours. Tiizi does not verify the fasting period independently.",
                "protocolSteps": [
                    "Identify which fasting period is being recorded and when it begins.",
                    "At the end of that period, determine the actual elapsed time.",
                    "Record that duration in hours without converting it to days.",
                ],
                "sessionFraming": "The report represents one continuous fasting period. No particular duration, schedule, frequency, or intake protocol is prescribed by this Activity.",
                "safetyNotes": ["Fasting may not be suitable for everyone. This guide is general Activity information, not medical advice; if you are unsure whether fasting is suitable for you, seek guidance from a qualified health professional."],
            }
            for key in ("formCues", "commonMistakes", "equipment", "environment", "adaptation", "completionMeaning"):
                content.pop(key, None)
                field_sources.pop(key, None)
            content.update(fasting_content)
            field_sources.update({k: ["Founder Fasting direction + governed baseline"] for k in fasting_content})
        if code == "WEL-SLP-002":
            content["execution"] = "Wind down with a low-stimulation activity, then go to bed as part of the bedtime practice being recorded."
            content["unitSemantics"] = "One completion records one bedtime occurrence. The Activity does not define a clock-time target."
            content["completionMeaning"] = "Completion means the participant went to bed for the sleep period being recorded."
            field_sources.update({k: ["bounded Activity/Challenge truth normalization"] for k in ("execution", "unitSemantics", "completionMeaning")})
        if code == "WEL-SLP-003":
            content["execution"] = "Rise from bed and begin the morning activity being recorded."
            content["unitSemantics"] = "One completion records one wake-time occurrence; the Activity does not define a clock-time target."
            content["completionMeaning"] = "Completion means the participant rose from bed for the sleep period being recorded."
            field_sources.update({k: ["bounded Activity/Challenge truth normalization"] for k in ("execution", "unitSemantics", "completionMeaning")})
        if code == "WEL-SLP-004":
            content["setup"] = "Choose a quiet, comfortable place to rest, if applicable."
            content["execution"] = "Lie down or recline and rest, then record the nap occurrence."
            content["measurementGuidance"] = "Report the actual rest duration in minutes when Duration is used, or mark Completion for the nap occurrence being recorded."
            content.pop("formCues", None)
            content.pop("commonMistakes", None)
            content.pop("adaptation", None)
            content["sessionFraming"] = "One nap or rest occurrence, recorded by its actual duration or completion."
            for k in ("setup", "execution", "measurementGuidance", "sessionFraming"):
                field_sources[k] = ["bounded Activity truth normalization"]
            for k in ("formCues", "commonMistakes", "adaptation"):
                field_sources.pop(k, None)
        if code == "WEL-NUT-001":
            content["completionMeaning"] = "Completion records a water-intake occasion. Quantity reports the actual volume consumed."
            content["measurementGuidance"] = "Report the actual volume of water consumed in millilitres or litres."
            content["execution"] = "Drink water and record the actual volume consumed for the occasion being recorded."
            field_sources["completionMeaning"] = ["bounded Activity/Challenge truth normalization"]
            field_sources["measurementGuidance"] = ["bounded measurement normalization"]
            field_sources["execution"] = ["bounded Activity truth normalization"]
        if code == "WEL-MND-008":
            content["measurementGuidance"] = "Report the actual continuous reflection duration, or mark Completion after the reflection occurrence being recorded."
            content["unitSemantics"] = "Duration records continuous time spent reflecting; Completion records that one reflection occurrence took place."
            content["setup"] = "Choose a quiet place where you can reflect with minimal interruption."
            content["completionMeaning"] = "Completion means one reflection occurrence was carried out."
            field_sources.update({k: ["bounded Activity/Challenge truth normalization"] for k in ("measurementGuidance", "unitSemantics", "setup", "completionMeaning")})
        if code == "WEL-SLP-002":
            content["protocolSteps"] = ["Prepare for the sleep period using a wind-down activity if helpful.", "Go to bed for the sleep period being recorded.", "Record the bedtime occurrence."]
            field_sources["protocolSteps"] = ["bounded Activity truth normalization"]
        if code == "WEL-SLP-003":
            content["protocolSteps"] = ["Rise from bed for the sleep period being recorded.", "Begin the morning activity being recorded.", "Record the wake-time occurrence."]
            field_sources["protocolSteps"] = ["bounded Activity truth normalization"]
        if code in {"WEL-NUT-002", "WEL-NUT-003"}:
            item = "fruit" if code.endswith("002") else "vegetables"
            content["description"] = f"A nutrition practice in which the participant consumes {item} and reports the amount using the governed serving unit."
            content["measurementGuidance"] = f"Report the number of {item} servings consumed for the occurrence being recorded."
            content["unitSemantics"] = ("One serving is approximately one medium whole fruit or one cup of berries." if item == "fruit" else "One serving is approximately one cup of raw leafy vegetables or one-half cup cooked vegetables.")
            content["completionMeaning"] = f"Completion records an occasion when the participant consumed {item}; quantity reports servings under the applicable serving guidance."
            content["protocolSteps"] = [f"Choose the {item} to be consumed.", f"Consume the {item} as part of the eating occasion being recorded.", f"Report the number of {item} servings using the approved serving definition."]
            field_sources.update({"description": ["bounded Activity truth normalization"], "measurementGuidance": ["bounded measurement normalization"], "unitSemantics": ["consultant consensus; authoritative serving definition requires review"], "completionMeaning": ["bounded Activity/Challenge truth normalization"], "protocolSteps": ["bounded Activity truth normalization"]})
        if code in {"WEL-NUT-007", "WEL-NUT-008"}:
            added_sugar = code.endswith("007")
            label = "added-sugar" if added_sugar else "sugary-drink"
            behavior = "foods to which sugar has been added during processing or preparation" if added_sugar else "beverages sweetened with sugar, including sodas and pre-sweetened teas or coffees"
            content["description"] = f"An avoidance practice focused on {behavior}. The Activity records the participant's actual report and does not set a schedule or health outcome."
            content["measurementGuidance"] = f"Mark Completion when the {label} avoidance condition was met for the occurrence being recorded."
            content["unitSemantics"] = f"Completion records whether the participant followed the defined {label} avoidance behavior for the occurrence being recorded."
            content["setup"] = "Identify the foods or beverages covered by the avoidance behavior; check ingredient labels where useful."
            content["execution"] = f"Avoid {behavior} during the occurrence being recorded."
            content["protocolSteps"] = ["Identify foods or beverages covered by the avoidance behavior.", "Check labels where needed.", "Report whether the avoidance condition was met for the occurrence being recorded."]
            field_sources.update({k: ["bounded Activity/Challenge truth normalization"] for k in ("description", "measurementGuidance", "unitSemantics", "setup", "execution", "protocolSteps")})
        if code == "WEL-GRO-001":
            content["measurementGuidance"] = "Report the actual continuous reading duration or the number of pages read. Mark Completion after the reading session being recorded has ended."
            content["unitSemantics"] = "Duration is continuous time spent reading; Quantity counts pages; Completion records that the reading session being recorded has ended."
            content["execution"] = "Read attentively for the duration or page count being recorded; minimise multitasking."
            content["completionMeaning"] = "Completion means the participant ended the reading session being recorded."
            field_sources.update({k: ["bounded Activity/Challenge truth normalization"] for k in ("measurementGuidance", "unitSemantics", "execution", "completionMeaning")})
        if code == "WEL-DLY-004":
            content["description"] = "An avoidance practice focused on not eating snacks during a late-evening occurrence being recorded."
            content["measurementGuidance"] = "Mark Completion when the late-night snacking avoidance condition was met for the occurrence being recorded."
            content["unitSemantics"] = "Completion records whether the participant avoided late-night snacks for the occurrence being recorded."
            content["setup"] = "Identify the late-evening occurrence being recorded."
            content["execution"] = "Avoid snacks during the late-evening occurrence being recorded; this Activity does not set a clock cutoff."
            content["completionMeaning"] = "Completion means the participant reports that the late-night snacking avoidance condition was met for the occurrence being recorded."
            content["avoidanceCondition"] = "The avoidance condition is met when no snacks are consumed during the late-evening occurrence being recorded."
            content["protocolSteps"] = ["Identify the late-evening occurrence being recorded.", "Avoid snacks during that occurrence.", "Report whether the avoidance condition was met."]
            field_sources.update({k: ["bounded Activity/Challenge truth normalization"] for k in ("description", "measurementGuidance", "unitSemantics", "setup", "execution", "completionMeaning", "avoidanceCondition", "protocolSteps")})
        if code == "FIT-BAL-001":
            content["protocolSteps"] = ["Choose the balance task or tasks being recorded.", "Perform each task with control, using support if needed.", "Report the actual repetitions or duration, as applicable."]
            field_sources["protocolSteps"] = ["bounded Activity truth normalization"]
        if code == "FIT-BAL-004":
            content["execution"] = "Reach the free leg or an arm in a comfortable direction while maintaining balance on the standing leg, then return with control."
            field_sources["execution"] = ["bounded Activity truth normalization"]
        if code == "FIT-PSA-010":
            content["execution"] = "Shuffle laterally while keeping the torso facing forward; change direction with control as needed."
            field_sources["execution"] = ["bounded Activity truth normalization"]
        if code == "WEL-SOC-003":
            content["completionMeaning"] = "Completion means one intentional act of kindness was carried out; report the actual number of acts when Quantity is used."
            content["unitSemantics"] = "One act is a discrete intentional action performed to benefit another person; report the actual number of acts carried out."
            content["formCues"] = [x for x in content.get("formCues", []) if "planned" not in x.casefold()]
            content["safetyNotes"] = [x for x in content.get("safetyNotes", []) if "enhances both giver" not in x.casefold()]
            field_sources.update({"completionMeaning": ["bounded Activity truth normalization"], "unitSemantics": ["bounded Activity truth normalization"], "formCues": ["consultant content, filtered for planning behavior"], "safetyNotes": ["content normalization"]})
        if code == "WEL-SOC-004":
            content["measurementGuidance"] = "Report actual continuous participation duration or mark Completion for one community participation occurrence."
            content["unitSemantics"] = "Duration is actual continuous participation time; Completion records one participation occurrence."
            content["completionMeaning"] = "Completion means the participant took part in the community activity being recorded."
            field_sources.update({k: ["bounded Activity truth normalization"] for k in ("measurementGuidance", "unitSemantics", "completionMeaning")})
        if code == "WEL-DLY-004":
            content["commonMistakes"] = [x for x in content.get("commonMistakes", []) if "cut-off" not in x.casefold() and "cutoff" not in x.casefold()]
            content["safetyNotes"] = ["Follow any clinician-directed eating guidance that applies to you."]
            field_sources.update({"commonMistakes": ["consultant content, clock-cutoff rule removed"], "safetyNotes": ["bounded safety normalization"]})
        if code == "WEL-SLP-003":
            content["formCues"] = ["Rise from bed when ready to begin the day", "Allow natural light exposure if available"]
            content["commonMistakes"] = [x for x in content.get("commonMistakes", []) if not re.search(r"\d+\s*\+?\s*minutes?|consistent wake time|weekends", x, re.I)]
            content["safetyNotes"] = ["Avoid abrupt changes to your sleep routine if they leave you feeling unwell."]
            field_sources.update({k: ["bounded Activity truth normalization"] for k in ("formCues", "commonMistakes", "safetyNotes")})
        if code == "WEL-MND-001":
            content["adaptation"] = "Use a guided recording or try a comfortable seated or walking practice if remaining still is difficult."
            content["sessionFraming"] = "A meditation occurrence is a structured contemplative practice with a chosen focus, distinct from general relaxation."
            content["safetyNotes"] = ["Stop or change the practice if it causes distress. Meditation is not a substitute for professional mental-health care."]
            field_sources.update({k: ["bounded Activity truth normalization"] for k in ("adaptation", "sessionFraming", "safetyNotes")})
        if code == "WEL-NUT-005":
            content["formCues"] = [x for x in content.get("formCues", []) if not re.search(r"\b\d+\s*[-–]\s*\d+\s*days?\b", x, re.I)]
            content["safetyNotes"] = ["Consider household food-safety and storage constraints when planning."]
            field_sources.update({"formCues": ["consultant content, unsupported numeric horizon removed"], "safetyNotes": ["content normalization"]})
        if code == "WEL-NUT-006":
            content["commonMistakes"] = [x for x in content.get("commonMistakes", []) if not re.search(r"\bunder\s+\d+\s+minutes?\b", x, re.I)]
            content["safetyNotes"] = ["This practice is not a treatment for eating disorders; seek qualified support for health concerns."]
            field_sources.update({"commonMistakes": ["consultant content, arbitrary duration removed"], "safetyNotes": ["bounded safety normalization"]})
        if code == "WEL-NUT-007":
            content["avoidanceCondition"] = "Avoid foods to which sugar has been added during processing or preparation; naturally occurring sugars in whole fruit or plain dairy are not added sugar for this definition."
            content["completionMeaning"] = "Completion means the participant reports that the added-sugar avoidance condition was met for the occurrence being recorded."
            field_sources.update({k: ["bounded Activity/Challenge truth normalization"] for k in ("avoidanceCondition", "completionMeaning")})
        if code == "WEL-NUT-008":
            content["avoidanceCondition"] = "Avoid beverages sweetened with sugar, including sodas and pre-sweetened teas or coffees; unsweetened beverages are outside this avoidance definition."
            content["completionMeaning"] = "Completion means the participant reports that the sugary-drink avoidance condition was met for the occurrence being recorded."
            field_sources.update({k: ["bounded Activity/Challenge truth normalization"] for k in ("avoidanceCondition", "completionMeaning")})

        contract, contract_evidence = resolve_contract(code, rows, allowed[code])
        if "completion" not in contract["primaryMetrics"] + contract["secondaryMetrics"]:
            content.pop("completionMeaning", None)
            field_sources.pop("completionMeaning", None)
        if "completion" in contract["primaryMetrics"] + contract["secondaryMetrics"] and not content.get("completionMeaning"):
            content["completionMeaning"] = f"Mark complete after completing one {identity['name']} practice or occurrence as described above."
            field_sources["completionMeaning"] = ["bounded Activity-level completion assembly"]
        if "quantity" in contract["primaryMetrics"] + contract["secondaryMetrics"] and not content.get("unitSemantics"):
            unit = next(u for u in contract["compatibleUnits"] if UNIT_METRIC[u] == "quantity")
            content["unitSemantics"] = f"Report the {unit} associated with the defined {identity['name']} Activity."
            field_sources["unitSemantics"] = ["bounded measurement assembly"]
        if "weight" in contract["primaryMetrics"] + contract["secondaryMetrics"] and contract["loadReportingBases"]:
            basis_explanations = {
                "TOTAL_LOADED_IMPLEMENT": "total load on one loaded implement",
                "PER_IMPLEMENT": "load of one matching implement; do not add paired implements",
                "SINGLE_IMPLEMENT": "load of the single external implement being used",
                "PER_SIDE": "load for one side or hand; do not sum across sides",
                "MACHINE_DISPLAYED_LOAD": "the resistance displayed by the machine, without claiming equivalence across machines",
            }
            load_meaning = "Weight is reported as " + "; or ".join(basis_explanations[b] for b in contract["loadReportingBases"]) + "."
            existing_semantics = content.get("unitSemantics", "")
            content["unitSemantics"] = (existing_semantics.rstrip(".") + ". " if existing_semantics else "") + load_meaning
            field_sources["unitSemantics"] = list(dict.fromkeys(field_sources.get("unitSemantics", []) + ["PF-02 load reporting convention"]))
        if "weight" in contract["primaryMetrics"] + contract["secondaryMetrics"] and not contract["loadReportingBases"]:
            contract_disagreements.append({"activityCode": code, "issue": "Weight is baseline-compatible but consultant evidence does not establish a load basis; weight Challenge configuration remains unavailable pending Tiizi declaration."})

        record: dict[str, Any] = {k: identity.get(k) for k in ("activityCode", "candidateId", "name", "domain", "category", "classification", "family")}
        record["content"] = content
        record["measurementContract"] = contract
        record["editorialNotes"] = []
        record["sourceNotes"] = []
        if code == REVIEW_CODE:
            record["editorialNotes"].append("NEEDS_TIIZI_REVIEW: retain as a Draft candidate; review proportionate safety/caution wording and Challenge-use constraints before publication or eligibility. Do not add protocol durations, frequencies, intake rules, or clinical restrictions here.")
        if code in WEIGHT_REVIEW_CODES:
            record["editorialNotes"].append("NEEDS_TIIZI_REVIEW: Weight is baseline-compatible, but consultant evidence does not resolve an authorized PF-02 load reporting basis. Keep Weight configurations unavailable until Tiizi declares the basis; other governed metrics remain available.")
        if code in SERVING_REVIEW_CODES:
            record["editorialNotes"].append("NEEDS_TIIZI_REVIEW: the governed baseline requires authoritative serving guidance before publication. The supplied portion examples remain draft content and must be checked against an approved serving definition.")
        records.append(record)
        provenance[code] = {"fields": field_sources, "measurementContract": contract_evidence}

    return {"schemaVersion": "1.0.0", "records": records}, provenance, {
        "sourceRecords": source_maps, "contractDisagreements": contract_disagreements,
        "expected": expected, "allowed": allowed,
    }


def validate(candidate: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    records = candidate.get("records", [])
    expected: dict[str, dict[str, Any]] = extra["expected"]
    allowed: dict[str, dict[str, list[str]]] = extra["allowed"]
    by_code: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        by_code.setdefault(record.get("activityCode"), []).append(record)
    missing = sorted(set(expected) - set(by_code))
    unexpected = sorted(set(by_code) - set(expected))
    duplicates = sorted(code for code, rows in by_code.items() if len(rows) != 1)
    identity_drift: list[dict[str, Any]] = []
    malformed: list[dict[str, Any]] = []
    invalid_metrics: list[dict[str, Any]] = []
    invalid_units: list[dict[str, Any]] = []
    invalid_pairs: list[dict[str, Any]] = []
    missing_content: list[dict[str, Any]] = []
    conditional_missing: list[dict[str, Any]] = []
    prohibited_fields: list[dict[str, Any]] = []
    completion_inference: list[str] = []
    fasting_errors: list[str] = []
    schema_errors: list[dict[str, Any]] = []
    for code, rows in by_code.items():
        if code not in expected or len(rows) != 1:
            continue
        row = rows[0]
        identity = expected[code]
        for key in ("activityCode", "candidateId", "name", "domain", "category", "classification", "family"):
            if row.get(key) != identity.get(key):
                identity_drift.append({"activityCode": code, "field": key, "expected": identity.get(key), "received": row.get(key)})
        for key in row:
            if key in SYSTEM_FIELDS:
                prohibited_fields.append({"activityCode": code, "field": key})
        if set(row) - {"activityCode", "candidateId", "name", "domain", "category", "classification", "family", "content", "measurementContract", "editorialNotes", "sourceNotes"}:
            malformed.append({"activityCode": code, "reason": "unexpected record fields", "fields": sorted(set(row) - {"activityCode", "candidateId", "name", "domain", "category", "classification", "family", "content", "measurementContract", "editorialNotes", "sourceNotes"})})
        content = row.get("content") if isinstance(row.get("content"), dict) else {}
        contract = row.get("measurementContract") if isinstance(row.get("measurementContract"), dict) else {}
        allowed_content_fields = set(CONTENT_FIELDS)
        if set(content) - allowed_content_fields:
            schema_errors.append({"activityCode": code, "field": "content", "unexpected": sorted(set(content) - allowed_content_fields)})
        string_fields = set(CONTENT_FIELDS) - {"formCues", "commonMistakes", "protocolSteps", "safetyNotes"}
        array_fields = {"formCues", "commonMistakes", "protocolSteps", "safetyNotes"}
        for field in string_fields:
            if field in content and (not isinstance(content[field], str) or len(content[field]) > 5000):
                schema_errors.append({"activityCode": code, "field": f"content.{field}", "reason": "must be a bounded string"})
        for field in array_fields:
            if field in content and not isinstance(content[field], list):
                schema_errors.append({"activityCode": code, "field": f"content.{field}", "reason": "must be an array"})
        for field in ("formCues", "commonMistakes", "safetyNotes"):
            if isinstance(content.get(field), list) and any(not isinstance(x, str) or not x.strip() for x in content[field]):
                schema_errors.append({"activityCode": code, "field": f"content.{field}", "reason": "entries must be non-empty strings"})
        if isinstance(content.get("protocolSteps"), list):
            for index, step in enumerate(content["protocolSteps"]):
                if not (isinstance(step, str) and step.strip()) and not (isinstance(step, dict) and isinstance(step.get("text"), str) and step["text"].strip() and set(step) <= {"title", "text"}):
                    schema_errors.append({"activityCode": code, "field": f"content.protocolSteps[{index}]", "reason": "must be a non-empty string or {title?, text} object"})
        if set(contract) != {"primaryMetrics", "secondaryMetrics", "compatibleUnits", "loadReportingBases", "components"}:
            schema_errors.append({"activityCode": code, "field": "measurementContract", "reason": "unexpected/missing contract keys", "keys": sorted(contract)})
        for key in ("description", "measurementGuidance"):
            if not isinstance(content.get(key), str) or not content[key].strip():
                missing_content.append({"activityCode": code, "field": f"content.{key}", "requirement": "required for all"})
        primary = contract.get("primaryMetrics", [])
        secondary = contract.get("secondaryMetrics", [])
        units = contract.get("compatibleUnits", [])
        if not isinstance(primary, list) or not primary or not isinstance(secondary, list) or not isinstance(units, list) or not units:
            malformed.append({"activityCode": code, "reason": "measurement contract needs primary metric and compatible units"})
        for metric in (primary if isinstance(primary, list) else []) + (secondary if isinstance(secondary, list) else []):
            if metric not in METRICS:
                invalid_metrics.append({"activityCode": code, "metric": metric})
            elif metric not in allowed[code]["metrics"]:
                invalid_metrics.append({"activityCode": code, "metric": metric, "reason": "not allowed by 118-Activity baseline"})
        received_metrics = set(primary + secondary) if isinstance(primary, list) and isinstance(secondary, list) else set()
        if received_metrics != set(allowed[code]["metrics"]):
            invalid_metrics.append({"activityCode": code, "expectedActivityMetrics": allowed[code]["metrics"], "receivedActivityMetrics": sorted(received_metrics), "reason": "measurement contract does not preserve the complete governed compatible metric set"})
        for unit in units if isinstance(units, list) else []:
            if unit not in UNIT_METRIC:
                invalid_units.append({"activityCode": code, "unit": unit})
            elif unit not in allowed[code]["units"]:
                invalid_units.append({"activityCode": code, "unit": unit, "reason": "not compatible with Activity in baseline"})
            elif UNIT_METRIC[unit] not in primary + secondary:
                invalid_pairs.append({"activityCode": code, "metric": UNIT_METRIC[unit], "unit": unit})
        expected_units = [u for u in allowed[code]["units"] if UNIT_METRIC[u] in allowed[code]["metrics"]]
        if "reps" in expected_units and "repetitions" in expected_units:
            expected_units.remove("repetitions")
        if code == REVIEW_CODE:
            expected_units = ["hours"]
        if set(units) != set(expected_units):
            invalid_units.append({"activityCode": code, "expectedActivityUnits": expected_units, "receivedActivityUnits": units, "reason": "measurement contract does not preserve the governed Activity unit set"})
        bases = contract.get("loadReportingBases", [])
        if not isinstance(bases, list) or any(b not in LOAD_BASES for b in bases):
            invalid_pairs.append({"activityCode": code, "reason": "invalid load reporting basis"})
        for index, component in enumerate(contract.get("components", []) if isinstance(contract.get("components"), list) else []):
            if not isinstance(component, dict) or set(component) != {"componentId", "displayName", "relationship"} or component.get("relationship") != "ALL_REQUIRED":
                schema_errors.append({"activityCode": code, "field": f"measurementContract.components[{index}]", "reason": "invalid PF-02 component shape/relationship"})
        if "weight" in primary + secondary:
            if not bases and code not in WEIGHT_REVIEW_CODES:
                conditional_missing.append({"activityCode": code, "field": "measurementContract.loadReportingBases", "requirement": "PF-02 Weight configuration requires an explicit basis"})
            if not any(isinstance(x, str) and re.search(r"(load|weight|implement|hand|bar|dumbbell|kettlebell|machine)", x, re.I) for x in [content.get("measurementGuidance", ""), content.get("unitSemantics", "")]):
                if code not in WEIGHT_REVIEW_CODES:
                    conditional_missing.append({"activityCode": code, "field": "content.measurementGuidance/unitSemantics", "requirement": "Weight reporting meaning must be explicit"})
        if "completion" in primary + secondary and not content.get("completionMeaning"):
            conditional_missing.append({"activityCode": code, "field": "content.completionMeaning", "requirement": "required when Completion is supported"})
        if row.get("domain") == "Fitness":
            for key in ("setup", "execution"):
                if not isinstance(content.get(key), str) or not content[key].strip():
                    conditional_missing.append({"activityCode": code, "field": f"content.{key}", "requirement": "Fitness technique/practice guidance"})
            if not content.get("formCues") and not content.get("commonMistakes") and not content.get("techniqueReference"):
                conditional_missing.append({"activityCode": code, "field": "content.formCues/commonMistakes/techniqueReference", "requirement": "at least one useful technique guidance module"})
            if not content.get("safetyNotes"):
                conditional_missing.append({"activityCode": code, "field": "content.safetyNotes", "requirement": "Fitness safety class under authoring contract"})
        if row.get("domain") == "Wellness" and not any(content.get(k) for k in ("setup", "execution", "protocolSteps", "sessionFraming", "completionMeaning", "semanticDefinition", "avoidanceCondition")):
            conditional_missing.append({"activityCode": code, "field": "content practice guidance", "requirement": "at least one applicable Wellness practice module"})
        if code == REVIEW_CODE:
            if contract.get("primaryMetrics") != ["duration"] or contract.get("compatibleUnits") != ["hours"]:
                fasting_errors.append("Fasting must be Duration + hours only")
            if re.search(r"\b(?:\d+\s*hours?\s*(?:=|equals?|->|converted? to)\s*\d+\s*days?|(?:24|72)\s*hours?\s*(?:=|equals?|->)\s*(?:1|3)\s*days?)", json.dumps(row, ensure_ascii=False), re.I):
                fasting_errors.append("Fasting value must not be translated to days")
        if re.search(r"\b(completion)\b", json.dumps(content, ensure_ascii=False), re.I) and "completion" in primary + secondary and code not in {"WEL-MND-003"}:
            # Streak mechanics must never leak into canonical content. This flag is review-only if actual field text says Streak.
            if re.search(r"streak|target met|target achieved|challenge target", json.dumps(content, ensure_ascii=False), re.I):
                completion_inference.append(code)

    fitness = sum(1 for r in records if r.get("domain") == "Fitness")
    wellness = sum(1 for r in records if r.get("domain") == "Wellness")
    needs_review = [
        {"activityCode": REVIEW_CODE, "field": "content.safetyNotes / Challenge-use constraints", "reason": "Existing Fasting Product Truth keeps the Activity Draft and not Challenge Eligible pending review."},
        *[{"activityCode": code, "field": "measurementContract.loadReportingBases", "reason": "PF-02 basis not safely resolvable from available evidence; Weight configuration must fail closed while non-Weight configurations remain possible."} for code in sorted(WEIGHT_REVIEW_CODES)],
        *[{"activityCode": code, "field": "measurementContract Quantity/servings unit semantics", "reason": "The governed baseline requires authoritative serving guidance before publication."} for code in sorted(SERVING_REVIEW_CODES)],
    ]
    ready = not any((missing, unexpected, duplicates, identity_drift, malformed, schema_errors, invalid_metrics, invalid_units, invalid_pairs, missing_content, conditional_missing, prohibited_fields, completion_inference, fasting_errors))
    return {
        "validationVersion": "1.0.0",
        "baselineCommit": "4b252e2e0026c4e7798201a30c65cac0b3beadf9",
        "preparationCommit": "63fad90bfd5f73359aaa5e338018ca2b11a61fbe",
        "expectedActivities": 118,
        "receivedActivities": len(records),
        "fitness": fitness,
        "wellness": wellness,
        "uniqueActivityCodes": len(by_code),
        "missingActivities": missing,
        "unexpectedActivities": unexpected,
        "duplicateActivityCodes": duplicates,
        "identityClassificationDrift": identity_drift,
        "malformedRecords": malformed,
        "schemaErrors": schema_errors,
        "invalidMetrics": invalid_metrics,
        "invalidUnits": invalid_units,
        "invalidMetricUnitPairs": invalid_pairs,
        "requiredContentMissing": missing_content,
        "conditionalContentMissing": conditional_missing,
        "consultantSuppliedSystemFields": prohibited_fields,
        "challengeDerivedCompletionLeak": completion_inference,
        "fastingRules": {"errors": fasting_errors, "requiredContract": {"metric": "duration", "unit": "hours"}},
        "needsTiiziReview": needs_review,
        "readyForIngestion": ready and not needs_review,
        "result": ("PASS_WITH_REVIEW" if needs_review else "PASS") if ready else "FAIL",
        "candidateIsDraftOnly": True,
        "databaseWrites": 0,
        "publicationEffects": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("consultant_json", nargs=3, type=Path, help="consultant 1, 2, and 3 authored JSON files")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    paths = [p.resolve() for p in args.consultant_json]
    hashes = [{"consultant": f"consultant-{i+1}", "filename": p.name, "sha256": sha256(p)} for i, p in enumerate(paths)]
    candidate, provenance, extra = build_candidate(paths)
    validation = validate(candidate, extra)
    validation["consultantInputs"] = hashes
    validation["weightBasisConsensusGaps"] = extra["contractDisagreements"]
    if not args.validate_only:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        (OUTPUT / "tiizi-118-activity-reconciled-content.json").write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (OUTPUT / "tiizi-118-activity-reconciliation-provenance.json").write_text(json.dumps({"provenanceVersion": "1.0.0", "consultantInputs": hashes, "records": provenance}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (OUTPUT / "tiizi-118-activity-reconciliation-validation.json").write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(validation, ensure_ascii=False, indent=2))
    return 1 if validation["result"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
