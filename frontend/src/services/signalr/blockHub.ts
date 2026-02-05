import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useBlockStore } from '../../store/blockStore';
import { BlockTypeRegistry } from '../../registry';
import type { Block, BlockType, BlockConfig } from '../../types/block.types';

let connection: HubConnection | null = null;

/**
 * Transform backend block DTO to frontend Block format
 * Matches the transformation in useBlocksInitialization.ts
 */
function transformBackendBlock(dto: any): Block {
  const blockType = dto.blockType as BlockType;
  const typeInfo = BlockTypeRegistry.get(blockType);
  const isAtomic = typeInfo?.isAtomic ?? dto.isAtomic ?? true;

  return {
    id: dto.id,
    name: dto.name,
    blockType,
    isAtomic,
    capabilities: dto.capabilities || [],
    config: (dto.config || {}) as unknown as BlockConfig,
    metadata: {
      description: dto.description || undefined,
      tags: dto.tags || [],
      createdAt: dto.createdAt || new Date().toISOString(),
      updatedAt: dto.updatedAt || new Date().toISOString(),
      status: dto.metadata?.status || 'active',
      version: dto.version,
      createdBy: dto.metadata?.createdBy || 'system',
    },
    inputs: dto.inputs || [],
    outputs: dto.outputs || [],
    position: dto.position || { x: 0, y: 0 },
    children: dto.children || [],
    connections: dto.connections || [],
  };
}

export async function initBlockHub(baseUrl: string) {
  if (connection) return connection;

  connection = new HubConnectionBuilder()
    .withUrl(`${baseUrl.replace(/\/$/, '')}/hubs/blocks`)
    .configureLogging(LogLevel.Information)
    .withAutomaticReconnect()
    .build();

  const add = (payload: any) => {
    try {
      const block = transformBackendBlock(payload);
      useBlockStore.getState().setBlocks(new Map([[block.id, block]]), null);
    } catch (e) {
      console.error('blockHub add error', e);
    }
  };

  const update = (payload: any) => {
    try {
      const block = transformBackendBlock(payload);
      useBlockStore.getState().updateBlock(block.id, block);
    } catch (e) {
      console.error('blockHub update error', e);
    }
  };

  const del = (id: string) => {
    try {
      useBlockStore.getState().removeBlock(id);
    } catch (e) {
      console.error('blockHub delete error', e);
    }
  };

  connection.on('BlockAdded', add);
  connection.on('BlockUpdated', update);
  connection.on('BlockDeleted', del);

  try {
    await connection.start();
    console.info('Connected to block hub');
  } catch (e) {
    console.warn('Failed to connect to block hub', e);
  }

  return connection;
}

export function stopBlockHub() {
  if (!connection) return;
  connection.stop();
  connection = null;
}
