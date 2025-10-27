/**
 * Simple in-memory cache for subgraph queries to prevent rate limiting
 * The Graph Studio free tier has strict rate limits (429 errors)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SubgraphCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 30000; // 30 seconds default

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    const maxAge = ttl ?? this.defaultTTL;

    if (age > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear a specific cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const subgraphCache = new SubgraphCache();

/**
 * Wrapper for subgraph requests with automatic caching and retry logic
 */
export async function cachedSubgraphRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number,
  retries = 3
): Promise<T> {
  // Check cache first
  const cached = subgraphCache.get<T>(key, ttl);
  if (cached !== null) {
    console.log(`[SubgraphCache] Cache hit for key: ${key}`);
    return cached;
  }

  console.log(`[SubgraphCache] Cache miss for key: ${key}, fetching...`);

  // Fetch with retry logic for rate limiting
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const data = await fetcher();
      subgraphCache.set(key, data);
      return data;
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (429)
      const isRateLimit =
        error?.response?.status === 429 ||
        error?.message?.includes("429") ||
        error?.toString()?.includes("429");

      if (isRateLimit && i < retries - 1) {
        // Exponential backoff: wait 2^i seconds
        const waitTime = Math.pow(2, i) * 1000;
        console.warn(
          `[SubgraphCache] Rate limited (429) for key: ${key}, retrying in ${waitTime}ms (attempt ${
            i + 1
          }/${retries})`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      // If not rate limit or last retry, throw
      if (i === retries - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}
