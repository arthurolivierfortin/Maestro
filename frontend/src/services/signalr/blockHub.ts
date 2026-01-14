import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useBlockStore } from '../../store/blockStore';

let connection: HubConnection | null = null;

export async function initBlockHub(baseUrl: string) {
  if (connection) return connection;

  connection = new HubConnectionBuilder()
    .withUrl(`${baseUrl.replace(/\/$/, '')}/hubs/blocks`)
    .configureLogging(LogLevel.Information)
    .withAutomaticReconnect()
    .build();

  const add = (payload: any) => {
    try {
      const block = payload as any;
      useBlockStore.getState().setBlocks(new Map([[block.id, block]]), null);
    } catch (e) {
      console.error('blockHub add error', e);
    }
  };

  const update = (payload: any) => {
    try {
      const block = payload as any;
      useBlockStore.getState().updateBlock(block.id, block as any);
    } catch (e) {
      console.error('blockHub update error', e);
    }
  };

  const del = (id: string) => {
    try {
      useBlockStore.getState().deleteBlock(id);
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
