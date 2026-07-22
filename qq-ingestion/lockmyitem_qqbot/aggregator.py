import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable


@dataclass
class IncomingMessage:
    message_id: str
    group_id: str
    group_name: str
    sender_id: str
    text: str = ""
    image_urls: list[str] = field(default_factory=list)
    sent_at: str = ""


class MessageAggregator:
    """Groups one sender's consecutive messages after an inactivity window."""

    def __init__(
        self,
        window_seconds: float,
        on_flush: Callable[[list[IncomingMessage]], Awaitable[None]],
        seen_ttl_seconds: float = 24 * 60 * 60,
        max_seen_ids: int = 20_000,
    ):
        self.window_seconds = window_seconds
        self.on_flush = on_flush
        self.seen_ttl_seconds = max(1.0, float(seen_ttl_seconds))
        self.max_seen_ids = max(100, int(max_seen_ids))
        self._batches: dict[tuple[str, str], list[IncomingMessage]] = {}
        self._timers: dict[tuple[str, str], asyncio.Task] = {}
        self._seen_ids: dict[str, float] = {}
        self._lock = asyncio.Lock()

    def _prune_seen_ids(self, current_time: float) -> None:
        expired_before = current_time - self.seen_ttl_seconds
        expired = [message_id for message_id, seen_at in self._seen_ids.items() if seen_at <= expired_before]
        for message_id in expired:
            self._seen_ids.pop(message_id, None)
        while len(self._seen_ids) >= self.max_seen_ids:
            self._seen_ids.pop(next(iter(self._seen_ids)))

    async def add(self, message: IncomingMessage) -> bool:
        async with self._lock:
            current_time = asyncio.get_running_loop().time()
            self._prune_seen_ids(current_time)
            if not message.message_id or message.message_id in self._seen_ids:
                return False
            self._seen_ids[message.message_id] = current_time
            key = (message.group_id, message.sender_id)
            self._batches.setdefault(key, []).append(message)
            previous = self._timers.pop(key, None)
            if previous:
                previous.cancel()
            self._timers[key] = asyncio.create_task(self._flush_after_window(key))
            return True

    async def _flush_after_window(self, key: tuple[str, str]) -> None:
        try:
            await asyncio.sleep(self.window_seconds)
            async with self._lock:
                batch = self._batches.pop(key, [])
                self._timers.pop(key, None)
            if batch:
                await self.on_flush(batch)
        except asyncio.CancelledError:
            return

    async def flush_all(self) -> None:
        async with self._lock:
            batches = list(self._batches.values())
            self._batches.clear()
            timers = list(self._timers.values())
            self._timers.clear()
        for timer in timers:
            timer.cancel()
        for batch in batches:
            if batch:
                await self.on_flush(batch)
