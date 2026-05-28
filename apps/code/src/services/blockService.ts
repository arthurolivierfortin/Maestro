import { apiFetch, API_URL } from './apiClient';

export interface BlockDto {
  id: string;
  name: string;
  blockType: string;
  description: string;
  designation?: string;
  category?: string;
  isAtomic: boolean;
  tags: string[];
  version?: string;
  capabilities?: string[];
  author?: string;
  contract?: string;
  isSystem?: boolean;
}

export interface GetBlocksParams {
  type?: string;
  search?: string;
}

export async function getBlocks(params?: GetBlocksParams): Promise<BlockDto[]> {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  const path = qs ? `/api/blocks?${qs}` : '/api/blocks';
  const res = await apiFetch(path);
  return res.json();
}

export async function getBlock(id: string): Promise<BlockDto> {
  const res = await apiFetch(`/api/blocks/${id}`);
  return res.json();
}

/**
 * Fetches the raw text of a file inside a block's directory.
 * Returns null when the file does not exist (404) so callers can render
 * content sections gracefully. Throws on other error statuses.
 *
 * Uses raw fetch (not apiFetch) because the endpoint returns text/plain and
 * we need to distinguish 404 from other failures, which apiFetch collapses.
 */
export async function getBlockContent(id: string, filePath: string): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/blocks/${id}/content/${filePath}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return res.text();
}
