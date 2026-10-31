import { createHash } from 'node:crypto';

/**
 * Returns a stable version for a published store policy.
 * MongoDB documents may contain Date objects or ISO timestamp strings after
 * data import. When the timestamp is absent, the content hash keeps legacy
 * published policies usable while still detecting text changes.
 */
export function getStorePolicyVersion(content: string, updatedAt?: unknown): string {
  const normalizedContent = content.trim();
  if (!normalizedContent) return '';

  let date: Date | null = null;
  if (updatedAt instanceof Date) {
    date = updatedAt;
  } else if (typeof updatedAt === 'string' || typeof updatedAt === 'number') {
    const candidate = new Date(updatedAt);
    if (Number.isFinite(candidate.getTime())) date = candidate;
  }

  if (date && Number.isFinite(date.getTime())) {
    return date.toISOString();
  }

  return 'content:' + createHash('sha256').update(normalizedContent, 'utf8').digest('hex');
}
