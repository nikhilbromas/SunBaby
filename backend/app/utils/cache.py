"""
In-memory caching utility with TTL support.
Provides caching for templates, presets, and query results.
"""
import time
import hashlib
import json
from typing import Any, Optional, Dict
from threading import Lock
from app.config import settings


class TTLCache:
    """Thread-safe TTL cache implementation."""
    
    def __init__(self, default_ttl: int = 300):
        """
        Initialize cache.
        
        Args:
            default_ttl: Default time-to-live in seconds
        """
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._lock = Lock()
        self._default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache if not expired.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found or expired
        """
        with self._lock:
            if key not in self._cache:
                return None
            
            value, expiry = self._cache[key]
            if time.time() > expiry:
                # Expired, remove it
                del self._cache[key]
                return None
            
            return value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set value in cache with TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if None)
        """
        ttl = ttl or self._default_ttl
        expiry = time.time() + ttl
        
        with self._lock:
            self._cache[key] = (value, expiry)
    
    def delete(self, key: str) -> None:
        """
        Delete key from cache.
        
        Args:
            key: Cache key
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
    
    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
    
    def cleanup_expired(self) -> None:
        """Remove expired entries from cache."""
        current_time = time.time()
        with self._lock:
            expired_keys = [
                key for key, (_, expiry) in self._cache.items()
                if current_time > expiry
            ]
            for key in expired_keys:
                del self._cache[key]
    
    def size(self) -> int:
        """Get current cache size."""
        with self._lock:
            return len(self._cache)


def make_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    Create a cache key from prefix and arguments.
    
    Args:
        prefix: Key prefix
        *args: Positional arguments
        **kwargs: Keyword arguments
        
    Returns:
        Cache key string
    """
    # Serialize arguments to create consistent key
    key_parts = [prefix]
    
    if args:
        key_parts.append(json.dumps(args, sort_keys=True))
    
    if kwargs:
        key_parts.append(json.dumps(kwargs, sort_keys=True))
    
    key_string = ":".join(key_parts)
    # Use hash for long keys to keep them manageable
    if len(key_string) > 200:
        key_string = hashlib.md5(key_string.encode()).hexdigest()
    
    return key_string


# Global cache instances with configurable TTL
template_cache = TTLCache(default_ttl=settings.CACHE_TTL_TEMPLATE)
preset_cache = TTLCache(default_ttl=settings.CACHE_TTL_PRESET)
query_cache = TTLCache(default_ttl=settings.CACHE_TTL_QUERY)

