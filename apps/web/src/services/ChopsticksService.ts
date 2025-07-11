import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { entropyToMiniSecret, mnemonicToEntropy } from "@polkadot-labs/hdkd-helpers";
import { getPolkadotSigner } from "polkadot-api/signer";
import { SwapToasts, TOAST_IDS } from '../components/swap/utils/toastUtils';
import { toast } from "react-hot-toast";

// Configuration constants - Docker-optimized settings
const CONFIG = {
  STARTUP_TIMEOUT: 30000,    // 30 seconds - Docker containers need more time
  RETRY_TIMEOUT: 15000,      // 15 seconds  
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds - Less aggressive for Docker
  MAX_RETRIES: 3             // Allow more retries for Docker startup
} as const;

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
   * Main initialization - simplified flow
   */
  async initializeChopsticks(): Promise<boolean> {
    if (process.env.NEXT_PUBLIC_USE_CHOPSTICKS !== 'true') {
      return false;
    }

    console.log('🔍 Initializing chopsticks...');

    const result = await this.ensureChopsticksRunning();
    
    if (result.success) {
      this.connectionStatus = 'connected';
      this.startHealthMonitoring();
      
      // Only show success toast if we actually restarted (not if already running)
      if (result.wasRestarted) {
        SwapToasts.chopsticksStarted();
      }
    } else {
      this.connectionStatus = 'error';
      SwapToasts.chopsticksFailed();
    }

    return result.success;
  }

  /**
   * Unified method to ensure chopsticks is running
   */
  private async ensureChopsticksRunning(): Promise<{success: boolean, wasRestarted: boolean}> {
    // First check if already healthy
    if (await this.checkHealth()) {
      return { success: true, wasRestarted: false };
    }

    // Try to restart and wait for it to be healthy
    const restartSuccess = await this.restartAndWaitForHealth();
    return { success: restartSuccess, wasRestarted: restartSuccess };
  }

  /**
   * Simplified restart with unified retry logic
   */
  private async restartAndWaitForHealth(): Promise<boolean> {
    console.log('🔄 Restarting chopsticks...');
    this.connectionStatus = 'connecting';
    SwapToasts.chopsticksStarting();

    try {
      // Trigger restart
      const response = await fetch('/api/chopsticks/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error('Restart command failed');
      }

      // Wait and check health with retries
      console.log('⏳ Waiting for chopsticks to start...');
      
      for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        const waitTime = attempt === 1 ? CONFIG.STARTUP_TIMEOUT : CONFIG.RETRY_TIMEOUT;
        
        await this.wait(waitTime);
        
        if (await this.checkHealth()) {
          SwapToasts.chopsticksStarted();
          return true;
        }
        
        console.log(`❌ Health check failed (attempt ${attempt}/${CONFIG.MAX_RETRIES})`);
      }

      throw new Error('Health checks failed after restart');
      
    } catch (error) {
      console.error('Restart failed:', error);
      SwapToasts.chopsticksFailed();
      return false;
    }
  }

  /**
   * Simple health check
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
   * Simplified health monitoring
   */
  private startHealthMonitoring() {
    this.stopHealthMonitoring(); // Clean up any existing interval

    this.healthCheckInterval = setInterval(async () => {
      console.log('🔍 Health check...');
      const isHealthy = await this.checkHealth();
      
      await this.handleHealthStatus(isHealthy);
    }, CONFIG.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Handle health status changes
   */
  private async handleHealthStatus(isHealthy: boolean) {
    const wasConnected = this.connectionStatus === 'connected';
    const wasError = this.connectionStatus === 'error';

    if (!isHealthy && wasConnected) {
      console.log('⚠️ Chopsticks down, auto-restarting...');
      this.connectionStatus = 'error';
      SwapToasts.chopsticksStarting();
      
      const restartSuccess = await this.restartAndWaitForHealth();
      this.connectionStatus = restartSuccess ? 'connected' : 'error';
      
      console.log(restartSuccess ? '✅ Auto-restart successful' : '❌ Auto-restart failed');
      
    } else if (isHealthy && wasError) {
      console.log('✅ Chopsticks recovered');
      this.connectionStatus = 'connected';
      SwapToasts.chopsticksStarted();
    }
  }

  /**
   * Utility method for consistent waiting
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean health monitoring shutdown
   */
  private stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
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
    this.stopHealthMonitoring();
  }
}

export default ChopsticksService;