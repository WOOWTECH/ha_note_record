"""Data storage for Ha Note Record integration."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
from typing import Any
import uuid

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)


@dataclass
class Category:
    """Represent a note category."""

    id: str
    name: str
    created_at: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Category:
        """Create a Category from a dictionary."""
        return cls(
            id=data["id"],
            name=data["name"],
            created_at=data["created_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at,
        }


@dataclass
class Note:
    """Represent a note."""

    id: str
    category_id: str
    title: str
    content: str
    pinned: bool
    created_at: str
    updated_at: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Note:
        """Create a Note from a dictionary."""
        return cls(
            id=data["id"],
            category_id=data["category_id"],
            title=data["title"],
            content=data["content"],
            pinned=data["pinned"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "category_id": self.category_id,
            "title": self.title,
            "content": self.content,
            "pinned": self.pinned,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class StoreData:
    """Store data structure."""

    categories: list[Category] = field(default_factory=list)
    notes: list[Note] = field(default_factory=list)


class HaNoteRecordStore:
    """Manage storage for Ha Note Record."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store."""
        self._hass = hass
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, STORAGE_KEY
        )
        self._data = StoreData()
        self._listeners: list[Callable[[], None]] = []

    @property
    def categories(self) -> list[Category]:
        """Return all categories."""
        return self._data.categories

    @property
    def notes(self) -> list[Note]:
        """Return all notes."""
        return self._data.notes

    def get_category(self, category_id: str) -> Category | None:
        """Get a category by ID."""
        for category in self._data.categories:
            if category.id == category_id:
                return category
        return None

    def get_note(self, note_id: str) -> Note | None:
        """Get a note by ID."""
        for note in self._data.notes:
            if note.id == note_id:
                return note
        return None

    def get_notes_by_category(self, category_id: str) -> list[Note]:
        """Get all notes in a category."""
        return [note for note in self._data.notes if note.category_id == category_id]

    async def async_load(self) -> None:
        """Load data from storage."""
        data = await self._store.async_load()
        if data is not None:
            self._data = StoreData(
                categories=[Category.from_dict(c) for c in data.get("categories", [])],
                notes=[Note.from_dict(n) for n in data.get("notes", [])],
            )
        _LOGGER.debug(
            "Loaded %d categories and %d notes",
            len(self._data.categories),
            len(self._data.notes),
        )

    async def async_save(self) -> None:
        """Save data to storage."""
        data = {
            "categories": [c.to_dict() for c in self._data.categories],
            "notes": [n.to_dict() for n in self._data.notes],
        }
        await self._store.async_save(data)
        self._notify_listeners()

    def _generate_id(self) -> str:
        """Generate a unique ID using full UUID for collision resistance."""
        return str(uuid.uuid4())

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        return datetime.now(timezone.utc).isoformat()

    async def async_create_category(self, name: str) -> Category:
        """Create a new category."""
        category = Category(
            id=self._generate_id(),
            name=name,
            created_at=self._get_timestamp(),
        )
        self._data.categories.append(category)
        await self.async_save()
        _LOGGER.debug("Created category: %s", category.name)
        return category

    async def async_delete_category(self, category_id: str) -> bool:
        """Delete a category. Returns False if category has notes."""
        notes = self.get_notes_by_category(category_id)
        if notes:
            _LOGGER.warning(
                "Cannot delete category %s: has %d notes", category_id, len(notes)
            )
            return False

        self._data.categories = [
            c for c in self._data.categories if c.id != category_id
        ]
        await self.async_save()
        _LOGGER.debug("Deleted category: %s", category_id)
        return True

    async def async_create_note(
        self,
        category_id: str,
        title: str,
        content: str = "",
        pinned: bool = False,
    ) -> Note | None:
        """Create a new note."""
        if not self.get_category(category_id):
            _LOGGER.error("Category not found: %s", category_id)
            return None

        timestamp = self._get_timestamp()
        note = Note(
            id=self._generate_id(),
            category_id=category_id,
            title=title,
            content=content,
            pinned=pinned,
            created_at=timestamp,
            updated_at=timestamp,
        )
        self._data.notes.append(note)
        await self.async_save()
        _LOGGER.debug("Created note: %s in category %s", note.title, category_id)
        return note

    async def async_update_note_content(self, note_id: str, content: str) -> bool:
        """Update note content."""
        note = self.get_note(note_id)
        if not note:
            _LOGGER.error("Note not found: %s", note_id)
            return False

        note.content = content
        note.updated_at = self._get_timestamp()
        await self.async_save()
        _LOGGER.debug("Updated note content: %s", note_id)
        return True

    async def async_update_note_pinned(self, note_id: str, pinned: bool) -> bool:
        """Update note pinned status."""
        note = self.get_note(note_id)
        if not note:
            _LOGGER.error("Note not found: %s", note_id)
            return False

        note.pinned = pinned
        note.updated_at = self._get_timestamp()
        await self.async_save()
        _LOGGER.debug("Updated note pinned: %s = %s", note_id, pinned)
        return True

    async def async_delete_note(self, note_id: str) -> bool:
        """Delete a note."""
        note = self.get_note(note_id)
        if not note:
            _LOGGER.error("Note not found: %s", note_id)
            return False

        self._data.notes = [n for n in self._data.notes if n.id != note_id]
        await self.async_save()
        _LOGGER.debug("Deleted note: %s", note_id)
        return True

    @callback
    def async_add_listener(
        self, update_callback: Callable[[], None]
    ) -> Callable[[], None]:
        """Add a listener for store updates."""
        self._listeners.append(update_callback)

        @callback
        def remove_listener() -> None:
            """Remove the listener."""
            if update_callback in self._listeners:
                self._listeners.remove(update_callback)

        return remove_listener

    def _notify_listeners(self) -> None:
        """Notify all listeners of a store update."""
        for listener in self._listeners:
            listener()
