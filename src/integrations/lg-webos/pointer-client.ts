import { ITransportConnection } from '../../transport/transport';
import { BrowserWebSocketTransport } from '../../transport/browser-websocket';
import { RemoteKey, CommandResult } from '../tv/types';

export class PointerClient {
  private transport: ITransportConnection | null = null;
  private isSocketOpen = false;

  constructor(private transportFactory: () => ITransportConnection = () => new BrowserWebSocketTransport()) {}

  public async connect(socketUrl: string): Promise<void> {
    this.transport = this.transportFactory();
    this.transport.onClose(() => {
      this.isSocketOpen = false;
    });
    this.transport.onError((_err) => {
      this.isSocketOpen = false;
    });

    await this.transport.connect(socketUrl, { timeoutMs: 5000 });
    this.isSocketOpen = true;
  }

  public isConnected(): boolean {
    return this.isSocketOpen && (this.transport?.isConnected() ?? false);
  }

  public async sendButton(key: RemoteKey): Promise<CommandResult> {
    if (!this.isConnected() || !this.transport) {
      return {
        success: false,
        error: {
          code: 'POINTER_SOCKET_NOT_CONNECTED',
          message: 'Pointer socket is not connected to the TV.',
        },
      };
    }

    const buttonName = this.mapRemoteKeyToButtonName(key);
    if (!buttonName) {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_KEY',
          message: `Key "${key}" is not supported by the pointer input socket.`,
        },
      };
    }

    try {
      const payload = `type:button\nname:${buttonName}\n\n`;
      await this.transport.send(payload);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'SEND_POINTER_FAILED',
          message: err instanceof Error ? err.message : 'Failed to send pointer command',
          details: err,
        },
      };
    }
  }

  public async sendClick(): Promise<CommandResult> {
    if (!this.isConnected() || !this.transport) {
      return {
        success: false,
        error: {
          code: 'POINTER_SOCKET_NOT_CONNECTED',
          message: 'Pointer socket is not connected.',
        },
      };
    }
    try {
      await this.transport.send('type:click\n\n');
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'CLICK_FAILED',
          message: err instanceof Error ? err.message : 'Failed to send click',
        },
      };
    }
  }

  public async sendMove(dx: number, dy: number, drag: boolean = false): Promise<CommandResult> {
    if (!this.isConnected() || !this.transport) {
      return {
        success: false,
        error: {
          code: 'POINTER_SOCKET_NOT_CONNECTED',
          message: 'Pointer socket is not connected.',
        },
      };
    }
    try {
      const payload = `type:move\ndx:${dx}\ndy:${dy}\ndown:${drag ? 1 : 0}\n\n`;
      await this.transport.send(payload);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'MOVE_FAILED',
          message: err instanceof Error ? err.message : 'Failed to send move',
        },
      };
    }
  }

  public async disconnect(): Promise<void> {
    this.isSocketOpen = false;
    if (this.transport) {
      try {
        await this.transport.disconnect();
      } catch {
        // ignore
      }
      this.transport = null;
    }
  }

  private mapRemoteKeyToButtonName(key: RemoteKey): string | null {
    switch (key) {
      case 'UP':
        return 'UP';
      case 'DOWN':
        return 'DOWN';
      case 'LEFT':
        return 'LEFT';
      case 'RIGHT':
        return 'RIGHT';
      case 'ENTER':
        return 'ENTER';
      case 'BACK':
        return 'BACK';
      case 'HOME':
        return 'HOME';
      case 'RED':
        return 'RED';
      case 'GREEN':
        return 'GREEN';
      case 'YELLOW':
        return 'YELLOW';
      case 'BLUE':
        return 'BLUE';
      case 'VOLUME_UP':
        return 'VOLUMEUP';
      case 'VOLUME_DOWN':
        return 'VOLUMEDOWN';
      case 'MUTE':
        return 'MUTE';
      case 'PLAY':
        return 'PLAY';
      case 'PAUSE':
        return 'PAUSE';
      case 'STOP':
        return 'STOP';
      case 'REWIND':
        return 'REWIND';
      case 'FAST_FORWARD':
        return 'FASTFORWARD';
      default:
        return null;
    }
  }
}

