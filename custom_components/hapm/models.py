"""Data models for HAPM - Home Assistant Pocket Money."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from .const import (
    ASSIGNMENT_MODE_INDIVIDUAL,
    OCCURRENCE_STATUS_IN_PROGRESS,
    PAY_MODE_PER_OCCURRENCE,
    PAY_SPLIT_FULL,
    RECURRENCE_MANUAL,
)


def _new_id() -> str:
    return str(uuid.uuid4())


@dataclass
class Chore:
    """Represents a single chore definition."""

    name: str
    value: float
    assigned_to: list[str]

    id: str = field(default_factory=_new_id)
    description: Optional[str] = None
    category: str = "tidying"
    recurrence: str = RECURRENCE_MANUAL
    interval: int = 1
    enabled: bool = True
    paused_until: Optional[datetime] = None

    occurrences_required: int = 1
    occurrence_window_days: Optional[int] = None

    pay_mode: str = PAY_MODE_PER_OCCURRENCE
    assignment_mode: str = ASSIGNMENT_MODE_INDIVIDUAL
    pay_split_mode: str = PAY_SPLIT_FULL

    last_completed: Optional[datetime] = None
    next_due: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "value": self.value,
            "assigned_to": self.assigned_to,
            "recurrence": self.recurrence,
            "interval": self.interval,
            "enabled": self.enabled,
            "paused_until": self.paused_until.isoformat() if self.paused_until else None,
            "occurrences_required": self.occurrences_required,
            "occurrence_window_days": self.occurrence_window_days,
            "pay_mode": self.pay_mode,
            "assignment_mode": self.assignment_mode,
            "pay_split_mode": self.pay_split_mode,
            "last_completed": self.last_completed.isoformat() if self.last_completed else None,
            "next_due": self.next_due.isoformat() if self.next_due else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Chore":
        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description"),
            category=data.get("category", "tidying"),
            value=data["value"],
            assigned_to=data["assigned_to"],
            recurrence=data.get("recurrence", RECURRENCE_MANUAL),
            interval=data.get("interval", 1),
            enabled=data.get("enabled", True),
            paused_until=datetime.fromisoformat(data["paused_until"]) if data.get("paused_until") else None,
            occurrences_required=data.get("occurrences_required", 1),
            occurrence_window_days=data.get("occurrence_window_days"),
            pay_mode=data.get("pay_mode", PAY_MODE_PER_OCCURRENCE),
            assignment_mode=data.get("assignment_mode", ASSIGNMENT_MODE_INDIVIDUAL),
            pay_split_mode=data.get("pay_split_mode", PAY_SPLIT_FULL),
            last_completed=datetime.fromisoformat(data["last_completed"]) if data.get("last_completed") else None,
            next_due=datetime.fromisoformat(data["next_due"]) if data.get("next_due") else None,
        )


@dataclass
class LedgerEvent:
    """An immutable record of a balance-affecting event."""

    event_type: str
    child_entry_id: str
    amount: float

    id: str = field(default_factory=_new_id)
    chore_id: Optional[str] = None
    occurrence_number: Optional[int] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    note: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "event_type": self.event_type,
            "child_entry_id": self.child_entry_id,
            "amount": self.amount,
            "chore_id": self.chore_id,
            "occurrence_number": self.occurrence_number,
            "timestamp": self.timestamp.isoformat(),
            "note": self.note,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "LedgerEvent":
        return cls(
            id=data["id"],
            event_type=data["event_type"],
            child_entry_id=data["child_entry_id"],
            amount=data["amount"],
            chore_id=data.get("chore_id"),
            occurrence_number=data.get("occurrence_number"),
            timestamp=datetime.fromisoformat(data["timestamp"]),
            note=data.get("note"),
        )


@dataclass
class OccurrenceWindow:
    """Tracks progress of a multi-occurrence chore within its time window."""

    chore_id: str
    window_start: datetime
    window_end: datetime
    total_required: int

    id: str = field(default_factory=_new_id)
    completions: list[dict] = field(default_factory=list)
    status: str = OCCURRENCE_STATUS_IN_PROGRESS

    @property
    def total_completed(self) -> int:
        return len(self.completions)

    @property
    def is_complete(self) -> bool:
        return self.total_completed >= self.total_required

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "chore_id": self.chore_id,
            "window_start": self.window_start.isoformat(),
            "window_end": self.window_end.isoformat(),
            "total_required": self.total_required,
            "completions": self.completions,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "OccurrenceWindow":
        return cls(
            id=data["id"],
            chore_id=data["chore_id"],
            window_start=datetime.fromisoformat(data["window_start"]),
            window_end=datetime.fromisoformat(data["window_end"]),
            total_required=data["total_required"],
            completions=data.get("completions", []),
            status=data.get("status", OCCURRENCE_STATUS_IN_PROGRESS),
        )


@dataclass
class GlobalState:
    """Integration-level state, shared across all child entries."""

    holiday_mode: bool = False
    holiday_paused_until: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "holiday_mode": self.holiday_mode,
            "holiday_paused_until": self.holiday_paused_until.isoformat() if self.holiday_paused_until else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "GlobalState":
        return cls(
            holiday_mode=data.get("holiday_mode", False),
            holiday_paused_until=datetime.fromisoformat(data["holiday_paused_until"]) if data.get("holiday_paused_until") else None,
        )
