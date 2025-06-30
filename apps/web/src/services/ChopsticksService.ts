import { toast } from 'react-hot-toast';
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { entropyToMiniSecret, mnemonicToEntropy } from "@polkadot-labs/hdkd-helpers";
import { getPolkadotSigner } from "polkadot-api/signer";

class ChopsticksService {
  private static instance: ChopsticksService;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private healthCheckInterval: NodeJS.Timeout | null = null;

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

  /**
   * Initialize - check health and auto-start if needed
   */
  async initializeChopsticks(): Promise<boolean> {
    if (process.env.NEXT_PUBLIC_USE_CHOPSTICKS !== 'true') {
      return false;
    }

    console.log('🔍 Initializing chopsticks...');
    toast.loading('Checking demo environment...', { id: 'chopsticks-status' });

    const isHealthy = await this.checkHealth();
    
    if (isHealthy) {
      this.connectionStatus = 'connected';
      this.startHealthMonitoring();
      
      toast.success('Demo environment ready!', { 
        id: 'chopsticks-status',
        icon: '✅'
      });
      
      return true;
    } else {
      // Auto-start if down during initialization
      console.log('🔄 Chopsticks not running, auto-starting...');
      const restartSuccess = await this.doRestart();
      
      if (restartSuccess) {
        this.connectionStatus = 'connected';
        this.startHealthMonitoring();
        return true;
      } else {
        this.connectionStatus = 'error';
        toast.error('Demo environment failed to start', { 
          id: 'chopsticks-status',
          icon: '🔴'
        });
        return false;
      }
    }
  }

  /**
   * Check if chopsticks endpoints are healthy
   */
  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/chopsticks/health');
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.log('Health check failed:', error);
      return false;
    }
  }

  /**
   * Simple restart function
   */
  private async doRestart(): Promise<boolean> {
    console.log('🔄 Restarting chopsticks...');
    this.connectionStatus = 'connecting';
    toast.loading('Starting demo environment...', { id: 'chopsticks-status' });

    try {
      const response = await fetch('/api/chopsticks/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      
      if (result.success) {
        // Wait for chopsticks to start
        console.log('⏳ Waiting for chopsticks to start...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        const isHealthy = await this.checkHealth();
        
        if (isHealthy) {
          toast.success('Demo environment started!', { 
            id: 'chopsticks-status',
            icon: '✅'
          });
          return true;
        } else {
          // Try once more with extra wait
          await new Promise(resolve => setTimeout(resolve, 8000));
          const isHealthyRetry = await this.checkHealth();
          
          if (isHealthyRetry) {
            toast.success('Demo environment started!', { 
              id: 'chopsticks-status',
              icon: '✅'
            });
            return true;
          }
        }
      }
      
      throw new Error('Restart failed');
      
    } catch (error) {
      console.error('Restart failed:', error);
      toast.error('Failed to start demo environment', { 
        id: 'chopsticks-status',
        icon: '🔴'
      });
      return false;
    }
  }

  /**
   * Simple health monitoring with auto-restart
   */
  private startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Monitor every 10 seconds
    this.healthCheckInterval = setInterval(async () => {
      console.log('🔍 Health check...');
      const isHealthy = await this.checkHealth();
      
      if (!isHealthy && this.connectionStatus === 'connected') {
        console.log('⚠️ Chopsticks down, auto-restarting...');
        this.connectionStatus = 'error';
        
        toast.loading('Demo environment disconnected. Auto-restarting...', { 
          id: 'chopsticks-status',
          icon: '🔄'
        });
        
        const restartSuccess = await this.doRestart();
        if (restartSuccess) {
          this.connectionStatus = 'connected';
          console.log('✅ Auto-restart successful');
        } else {
          console.log('❌ Auto-restart failed');
        }
        
      } else if (isHealthy && this.connectionStatus === 'error') {
        console.log('✅ Chopsticks recovered');
        this.connectionStatus = 'connected';
        
        toast.success('Demo environment reconnected!', { 
          id: 'chopsticks-status',
          icon: '✅'
        });
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Get Alice account for demo transactions
   */
  getAliceAccount() {
    return this.ALICE_ACCOUNT;
  }

  /**
   * Create PAPI signer from Alice's seed phrase
   */
  createAliceSigner() {
    try {
      const entropy = mnemonicToEntropy(this.ALICE_ACCOUNT.mnemonic);
      const miniSecret = entropyToMiniSecret(entropy);
      const derive = sr25519CreateDerive(miniSecret);
      const aliceKeyPair = derive(this.ALICE_ACCOUNT.derivationPath);
      
      return getPolkadotSigner(aliceKeyPair.publicKey, "Sr25519", aliceKeyPair.sign);
    } catch (error) {
      console.error('Failed to create Alice signer:', error);
      throw new Error('Failed to create chopsticks signer');
    }
  }

  /**
   * Simple status getters
   */
  isChopsticksMode(): boolean {
    return process.env.NEXT_PUBLIC_USE_CHOPSTICKS === 'true';
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  isChopsticksRunning(): boolean {
    return this.connectionStatus === 'connected';
  }

  /**
   * Legacy method for compatibility
   */
  async startChopsticks(): Promise<boolean> {
    return await this.initializeChopsticks();
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export default ChopsticksService;