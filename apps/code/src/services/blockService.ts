import { apiFetch } from './apiClient';

export interface BlockDto {
  id: string;
  name: string;
  blockType: string;
  description: string;
  designation?: string;
  category?: string;
  isAtomic: boolean;
  tags: string[];
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
