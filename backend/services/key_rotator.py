import os
import re
import threading
import time
from typing import Dict, List, Optional, Union

from backend.config import logger


def parse_api_keys(raw: Union[str, List[str], None]) -> List[str]:
    """
    Parses a string or list containing one or more API keys.
    Supports comma-separated, semicolon-separated, newline-separated, or space-separated keys.
    Deduplicates keys while preserving the original input order.
    """
    if not raw:
        return []

    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, str):
        # Support JSON-like array strings or comma/semicolon/newline-delimited strings
        clean_str = raw.strip()
        if clean_str.startswith('[') and clean_str.endswith(']'):
            clean_str = clean_str[1:-1]
        items = re.split(r'[,;\n\r\t]+', clean_str)
    else:
        items = [str(raw)]

    seen = set()
    cleaned_keys: List[str] = []
    for item in items:
        # Strip outer quotes, whitespace, and brackets
        k = str(item).strip().strip('\'"[]')
        if not k:
            continue
        if k not in seen:
            seen.add(k)
            cleaned_keys.append(k)

    return cleaned_keys


def mask_api_key(key: str) -> str:
    """Safely masks an API key for logs and UI status updates (e.g., AIzaSy...4f1A)."""
    if not key:
        return "none"
    if key.lower() == "mock":
        return "mock"
    if len(key) <= 8:
        return key[:2] + "***" + key[-2:]
    return f"{key[:6]}...{key[-4:]}"


class KeyUsageStats:
    """Tracks per-key request history, sliding-window RPM, and cooldown."""
    def __init__(self, key: str):
        self.key = key
        self.last_used: float = 0.0
        self.request_timestamps: List[float] = []
        self.total_calls: int = 0
        self.success_calls: int = 0
        self.failure_count: int = 0
        self.rate_limit_hits: int = 0
        self.cooldown_until: float = 0.0
        self.last_error: str = ""

    def prune_requests(self, window_seconds: float = 60.0, now: Optional[float] = None):
        if now is None:
            now = time.time()
        cutoff = now - window_seconds
        self.request_timestamps = [t for t in self.request_timestamps if t > cutoff]

    def rpm(self, now: Optional[float] = None) -> int:
        self.prune_requests(60.0, now)
        return len(self.request_timestamps)

    def is_cooling_down(self, now: Optional[float] = None) -> bool:
        if now is None:
            now = time.time()
        return self.cooldown_until > now

    def remaining_cooldown(self, now: Optional[float] = None) -> float:
        if now is None:
            now = time.time()
        return max(0.0, self.cooldown_until - now)


class GeminiKeyRotator:
    """
    Thread-safe manager for rolling and rotating Gemini API keys.
    Features:
    1. Proactive Rate-Limit Smoothing: Routes requests to keys with the lowest RPM (Requests Per Minute) in a 60s sliding window.
    2. Round-Robin & LRU (Least-Recently-Used) balancing across all ready keys to prevent hitting limits.
    3. Dynamic Cooldown with exponential backoff on 429 (rate limit), 503 (server overloaded), or 401/403 (invalid key).
    4. Seamless failover during active video analysis if a key is exhausted or overloaded.
    5. Comprehensive stats endpoint for real-time frontend monitoring.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._round_robin_counter = 0
        self._stats: Dict[str, KeyUsageStats] = {}

    def _get_or_create_stats(self, key: str) -> KeyUsageStats:
        if key not in self._stats:
            self._stats[key] = KeyUsageStats(key)
        return self._stats[key]

    def get_ordered_keys(self, provided_keys: Union[str, List[str], None] = None) -> List[str]:
        """
        Returns an ordered list of API keys to attempt.
        Prioritizes user-provided keys, falling back to GEMINI_API_KEYS or GEMINI_API_KEY environment variables.
        Applies smart anti-rate-limit load balancing (lowest RPM first, LRU secondary)
        and places cooling-down keys at the end.
        """
        parsed = parse_api_keys(provided_keys)
        if not parsed:
            env_raw = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
            parsed = parse_api_keys(env_raw)

        if not parsed:
            return []

        now = time.time()
        ready_keys: List[str] = []
        cooling_keys: List[str] = []

        with self._lock:
            for k in parsed:
                st = self._get_or_create_stats(k)
                st.prune_requests(60.0, now)
                if st.is_cooling_down(now):
                    cooling_keys.append(k)
                else:
                    ready_keys.append(k)

            # Sort ready keys to proactively prevent hitting RPM limits:
            # 1. Keys with lowest recent RPM (fewest requests in last 60s) come first.
            # 2. For keys with same RPM, keys used longest ago (oldest last_used) come first (LRU).
            if len(ready_keys) > 1:
                start_offset = self._round_robin_counter % len(ready_keys)
                self._round_robin_counter = (self._round_robin_counter + 1) % 1_000_000
                rotated = ready_keys[start_offset:] + ready_keys[:start_offset]
                ready_keys = sorted(
                    rotated,
                    key=lambda k: (self._stats[k].rpm(now), self._stats[k].last_used)
                )

            # Sort cooling keys by nearest expiry (earliest ready first)
            cooling_keys.sort(key=lambda k: self._stats[k].cooldown_until)

        # Return ready keys first, followed by cooling keys as last resort
        return ready_keys + cooling_keys

    def record_request(self, key: str):
        """Records a request dispatch on a key to track RPM rate limits in real-time."""
        if not key or key.lower() == "mock":
            return
        now = time.time()
        with self._lock:
            st = self._get_or_create_stats(key)
            st.last_used = now
            st.request_timestamps.append(now)
            st.prune_requests(60.0, now)
            st.total_calls += 1

    def mark_key_success(self, key: str):
        """Removes a key from cooldown and resets failure count on successful response."""
        if not key or key.lower() == "mock":
            return
        with self._lock:
            st = self._get_or_create_stats(key)
            st.cooldown_until = 0.0
            st.failure_count = 0
            st.success_calls += 1
            st.last_error = ""

    def mark_key_failed(
        self,
        key: str,
        reason: str = "rate_limit",
        cooldown_seconds: float = 60.0,
        error_message: str = ""
    ):
        """Marks a key as temporarily cooling down after hitting a rate limit, server busy, or error."""
        if not key or key.lower() == "mock":
            return
        now = time.time()
        with self._lock:
            st = self._get_or_create_stats(key)
            st.failure_count += 1
            st.last_error = error_message or reason

            # Adaptive cooldown based on failure reason and consecutive failures
            if any(x in reason.lower() for x in ("rate_limit", "429", "quota", "resource_exhausted")):
                st.rate_limit_hits += 1
                # Escalating cooldown: 60s -> 120s -> 180s (max 300s)
                effective_cooldown = max(cooldown_seconds, min(300.0, 60.0 * st.failure_count))
            elif any(x in reason.lower() for x in ("503", "busy", "overloaded")):
                effective_cooldown = min(cooldown_seconds, 5.0)
            elif any(x in reason.lower() for x in ("401", "403", "invalid")):
                effective_cooldown = 3600.0
            else:
                effective_cooldown = cooldown_seconds

            expiry = now + effective_cooldown
            st.cooldown_until = max(st.cooldown_until, expiry)

            active_cooling = sum(1 for s in self._stats.values() if s.is_cooling_down(now))
            logger.warning(
                f"Gemini Key [{mask_api_key(key)}] marked cooling down for {int(effective_cooldown)}s ({reason}). "
                f"Active cooled keys: {active_cooling}/{len(self._stats)}"
            )

    def get_status(self, provided_keys: Union[str, List[str], None] = None) -> dict:
        """Returns detailed diagnostics and usage statistics on configured Gemini API keys."""
        parsed = parse_api_keys(provided_keys)
        if not parsed:
            env_raw = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
            parsed = parse_api_keys(env_raw)

        now = time.time()
        with self._lock:
            details = []
            ready_count = 0
            cooling_count = 0

            for idx, k in enumerate(parsed):
                st = self._get_or_create_stats(k)
                st.prune_requests(60.0, now)
                is_cool = st.is_cooling_down(now)
                rem_cool = round(st.remaining_cooldown(now), 1)

                if is_cool:
                    cooling_count += 1
                    status = "cooling"
                else:
                    ready_count += 1
                    status = "ready"

                details.append({
                    "index": idx + 1,
                    "masked": mask_api_key(k),
                    "status": status,
                    "rpm": st.rpm(now),
                    "total_calls": st.total_calls,
                    "success_calls": st.success_calls,
                    "rate_limit_hits": st.rate_limit_hits,
                    "cooldown_remaining_sec": rem_cool,
                    "last_error": st.last_error[:100] if st.last_error else ""
                })

            return {
                "total_keys": len(parsed),
                "ready_keys": ready_count,
                "cooling_keys": cooling_count,
                "rolling_active": len(parsed) > 1,
                "keys": details
            }


# Global singleton instance
key_rotator = GeminiKeyRotator()
