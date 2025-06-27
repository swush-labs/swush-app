import { toast } from 'react-hot-toast';

class ChopsticksService {
  private static instance: ChopsticksService;
  private isRunning = false;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  // Alice account from test-wallet-setup.md
  private readonly ALICE_ACCOUNT = {
    address: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
    mnemonic: 'bottom drive obey lake curtain smoke basket hold race lonely fit walk',
    derivationPath: '//Alice',
    name: 'Alice (Test)',
    source: 'chopsticks'
  };

  static getInstance(): ChopsticksService {
    if (!ChopsticksService.instance) {
      ChopsticksService.instance = new ChopsticksService();
    }
    return ChopsticksService.instance;
  }

  async startChopsticks(): Promise<boolean> {
    if (process.env.NEXT_PUBLIC_USE_CHOPSTICKS !== 'true') {
      return false;
    }

    this.connectionStatus = 'connecting';
    toast.loading('Starting Chopsticks...', { id: 'chopsticks-status' });

    try {
      // Chopsticks should be started externally (via pnpm script)
      // Here we just verify it's running by checking the endpoints
      await this.verifyChopsticksConnection();
      
      this.isRunning = true;
      this.connectionStatus = 'connected';
      toast.success('Chopsticks Connected', { id: 'chopsticks-status' });
      
      return true;
    } catch (error) {
      this.connectionStatus = 'error';
      console.error('Chopsticks connection failed:', error);
      toast.error('Chopsticks connection failed', { id: 'chopsticks-status' });
      return false;
    }
  }

  private async verifyChopsticksConnection(): Promise<void> {
    // Test connection to chopsticks endpoints from constants.ts
    const testEndpoints = [
      'ws://localhost:3421', // Asset Hub
      'ws://localhost:3422'  // Hydration
    ];

    for (const endpoint of testEndpoints) {
      try {
        const ws = new WebSocket(endpoint);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
          };
          ws.onerror = () => {
            clearTimeout(timeout);
            reject(new Error(`Failed to connect to ${endpoint}`));
          };
        });
      } catch (error) {
        throw new Error(`Chopsticks not running on ${endpoint}`);
      }
    }
  }

  getAliceAccount() {
    return this.ALICE_ACCOUNT;
  }

  isChopsticksMode(): boolean {
    return process.env.NEXT_PUBLIC_USE_CHOPSTICKS === 'true';
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  isChopsticksRunning(): boolean {
    return this.isRunning;
  }
}

export default ChopsticksService; 