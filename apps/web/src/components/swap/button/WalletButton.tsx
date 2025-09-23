import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { WalletSelect } from '@talismn/connect-components';
import {
  AlephZeroWallet,
  EnkryptWallet,
  FearlessWallet,
  MantaWallet,
  NovaWallet,
  PolkadotjsWallet,
  PolkaGate,
  SubWallet,
  TalismanWallet,
  WalletAccount,
} from '@talismn/connect-wallets';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';
import { WalletButtonProps } from '../types';
import { FrontendConnectionManager } from '@/services/FrontendConnectionManager';
import { UserService } from '@/services/userService';
import { NETWORKS_SUPPORTED } from '@/services/constants';
import ChopsticksService from '@/services/ChopsticksService';
import { SwapToasts, TOAST_IDS } from '../utils/toastUtils';
// Network configuration for address formatting
const NETWORK_CONFIG = {
  POLKADOT: {
    name: 'Polkadot',
    prefix: 0, // Polkadot SS58 prefix
    assetHubPrefix: 0 // Asset Hub Polkadot uses the same prefix
  },
  KUSAMA: {
    name: 'Kusama',
    prefix: 2, // Kusama SS58 prefix
    assetHubPrefix: 2 // Asset Hub Kusama uses the same prefix
  }
};

export const WalletButton = ({ 
  isConnected, 
  setIsConnected, 
  setWalletAddress, 
  variant = 'default',
  className = '',
  onWalletModalClose
}: WalletButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Determine network based on address and source
  const determineNetwork = (address: string, source: string) => {
    try {

      // If the address starts with a '1', it's likely Polkadot
      if (address.startsWith('1')) {
        return NETWORK_CONFIG.POLKADOT;
      }
      
      // If the source contains 'kusama' or the address format matches Kusama
      if (source.toLowerCase().includes('kusama') || address.startsWith('C') || address.startsWith('D') || address.startsWith('F') || address.startsWith('G')) {
        return NETWORK_CONFIG.KUSAMA;
      }
      
      // Default to Polkadot
      return NETWORK_CONFIG.POLKADOT;
    } catch (error) {
      console.error('Error determining network:', error);
      return NETWORK_CONFIG.POLKADOT; // Default to Polkadot on error
    }
  };

  // Format address for Asset Hub based on network
  const formatAddressForAssetHub = (address: string, network: typeof NETWORK_CONFIG.POLKADOT | typeof NETWORK_CONFIG.KUSAMA) => {
    try {
      // Decode the address to get the public key
      const publicKey = decodeAddress(address);
      
      // Encode with the Asset Hub prefix for the specific network
      return encodeAddress(publicKey, network.assetHubPrefix);
    } catch (error) {
      console.error('Error formatting address for Asset Hub:', error);
      return address; // Return original address on error
    }
  };

  // Initialize the RPC connection
  const initializeRpcConnection = async (networkName: string) => {
    try {
      setIsInitializing(true);
      // toast.loading('Initializing network connection...', { id: 'connection-toast' });
      
      // Map the network name to the connection id expected by the service
      const networkMapping: Record<string, string> = {
        'Polkadot': NETWORKS_SUPPORTED.ASSET_HUB,
      };
      
      const networkId = networkMapping[networkName];
      
      // Get the connection manager instance
      const connectionManager = FrontendConnectionManager.getInstance();
      
      // Initialize connection
      const connection = await connectionManager.getConnection(networkId);
      
      console.log(`RPC connection initialized for ${networkName} (${networkId})`);
      
      // Store the connection info in localStorage for reuse
      localStorage.setItem('activeConnection', networkId);
      
      return connection;
    } catch (error) {
      console.error('Error initializing RPC connection:', error);
      console.error('Network connection failed:', error); // Silent failure for background initialization
      throw error;
    } finally {
      setIsInitializing(false);
    }
  };

  // Handle chopsticks Alice auto-connect
  const handleChopsticksConnect = async () => {
    try {
      setIsInitializing(true);
      
      // Only show toast when user actively clicks connect
      SwapToasts.walletConnecting('Connecting Alice account...', '🧪');
      
      const chopsticksService = ChopsticksService.getInstance();
      const aliceAccount = chopsticksService.getAliceAccount();
      
      // Mock WalletAccount structure for Alice
      const mockAccount: WalletAccount = {
        address: aliceAccount.address,
        name: aliceAccount.name,
        source: aliceAccount.source,
        signer: undefined // Not needed for chopsticks
      };
      
      await handleAccountSelected(mockAccount, true); // Show toast since user clicked connect
    } catch (error) {
      console.error('Error connecting to chopsticks:', error);
      SwapToasts.walletConnectionFailed('Failed to connect Alice account');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAccountSelected = async (account: WalletAccount, showLoadingToast: boolean = true) => {
    console.log('Selected account:', account);
    
    if (!account || !account.address) {
      console.error('Invalid account selected');
      return;
    }

    try {
      // Only set loading if not already set (for chopsticks flow)
      if (!isInitializing) {
        setIsInitializing(true);
        
        // Show loading toast only if requested (user-initiated)
        if (showLoadingToast) {
          SwapToasts.walletConnecting('Connecting wallet...', '🔑');
        }
    }

    // Determine the network based on the address and source
    const network = determineNetwork(account.address, account.source);
    
    // Format the address for Asset Hub
    const assetHubAddress = formatAddressForAssetHub(account.address, network);
    
    console.log(`Network detected: ${network.name}`);
    console.log(`Original address: ${account.address}`);
    console.log(`Asset Hub address: ${assetHubAddress}`);

    // Store wallet information in localStorage
    localStorage.setItem('walletName', account.name || 'Unknown');
    localStorage.setItem('walletAddress', account.address);
    localStorage.setItem('walletSource', account.source);
    localStorage.setItem('walletNetwork', network.name);
    localStorage.setItem('assetHubAddress', assetHubAddress);

      // Initialize RPC connection after wallet is connected
      await initializeRpcConnection(network.name);
      
      // Create or update user in Supabase
      await UserService.createOrUpdateUser(assetHubAddress);
      
      // Update state
      setIsConnected(true);
      setWalletAddress(assetHubAddress);
      setIsOpen(false);
      
      // Always show success toast when wallet connects (user wants to see final result)
      const successMessage = account.source === 'chopsticks' 
        ? 'Connected as Alice (Test Mode)'
        : 'Wallet connected successfully!';
      const icon = account.source === 'chopsticks' ? '🧪' : '✅';
        
      SwapToasts.walletConnected(successMessage, icon);
    } catch (error) {
      console.error('Error during wallet connection:', error);
      // Only show error toast if user initiated the connection
      if (showLoadingToast) {
        SwapToasts.walletConnectionFailed(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      // Only reset loading if we set it in this function
      if (account.source !== 'chopsticks') {
        setIsInitializing(false);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      // Disconnect RPC connection when wallet is disconnected
      const connectionManager = FrontendConnectionManager.getInstance();
      const networkName = localStorage.getItem('walletNetwork') || 'Polkadot';
      const networkMapping: Record<string, string> = {
        'Polkadot': NETWORKS_SUPPORTED.ASSET_HUB,
      };
      const networkId = networkMapping[networkName];
      
      await connectionManager.disconnect(networkId);
      
      // Clear local storage
      localStorage.removeItem('walletName');
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('walletSource');
      localStorage.removeItem('walletNetwork');
      localStorage.removeItem('assetHubAddress');
      
      setIsConnected(false);
      setWalletAddress('');
      
      SwapToasts.walletDisconnected();
    } catch (error) {
      console.error('Error disconnecting:', error);
      SwapToasts.error(`Disconnect error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Check if chopsticks mode and handle accordingly
  const chopsticksService = ChopsticksService.getInstance();
  const isChopsticksMode = chopsticksService.isChopsticksMode();

  const handleConnectClick = () => {
    // This section is just for Demo
    setIsConnected(true);
    return;
    // above section is for demo
    if (isChopsticksMode) {
      handleChopsticksConnect();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      {isConnected ? (
        <Button 
          onClick={handleDisconnect}
          variant={variant}
          className={className}
          disabled={isInitializing}
        >
          Disconnect
        </Button>
      ) : (
        <Button 
          onClick={handleConnectClick}
          variant={variant}
          className={className}
          disabled={isInitializing}
        >
          {isInitializing ? 'Connecting...' : 
           isChopsticksMode ? 'Connect Alice (Test)' : 'Connect Wallet'}
        </Button>
      )}

      <WalletSelect
        dappName="Swush"
        open={isOpen}
        onWalletConnectOpen={() => setIsOpen(true)}
        onWalletConnectClose={() => {
          setIsOpen(false);
          if (onWalletModalClose) {
            onWalletModalClose();
          }
        }}
        onAccountSelected={handleAccountSelected}
        showAccountsList={true}
        walletList={[
          new PolkadotjsWallet(),
          new TalismanWallet(),
          new NovaWallet(),
          new SubWallet(),
          new MantaWallet(),
          new PolkaGate(),
          new FearlessWallet(),
          new EnkryptWallet(),
          new AlephZeroWallet(),
        ]}
      />
    </>
  );
}; 