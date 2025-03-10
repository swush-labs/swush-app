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
  getWalletBySource,
} from '@talismn/connect-wallets';
import { toast } from 'react-hot-toast';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';
import { WalletButtonProps } from './types';

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

// New component for signing messages
export const SignMessageButton = () => {
  const [isSigning, setIsSigning] = useState(false);
  const [signedMessage, setSignedMessage] = useState<string | null>(null);

  // Sign a message using the connected wallet
  const signMessage = async () => {
    try {
      setIsSigning(true);
      
      // Get the wallet source and address from localStorage
      const walletSource = localStorage.getItem('walletSource');
      const walletAddress = localStorage.getItem('walletAddress');
      
      if (!walletSource || !walletAddress) {
        throw new Error('Wallet not connected');
      }
      
      // Get the wallet by source
      const wallet = getWalletBySource(walletSource);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Enable the wallet if not already enabled
      if (!wallet.extension) {
        await wallet.enable('Swush');
      }
      
      // Get the signer from the wallet
      const signer = wallet.signer;
      
      if (!signer) {
        throw new Error('Signer not available');
      }
      
      // The message to sign
      const message = 'Hello from Swush!';
      
      // Sign the message
      const signRaw = signer.signRaw;
      
      if (!signRaw) {
        throw new Error('signRaw not available on signer');
      }
      
      const { signature } = await signRaw({
        address: walletAddress,
        data: message,
        type: 'bytes'
      });
      
      console.log('Message signed successfully:', signature);
      setSignedMessage(signature);
      toast.success('Message signed successfully!');
      
    } catch (error) {
      console.error('Error signing message:', error);
      toast.error(`Error signing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={signMessage}
        variant="outline"
        disabled={isSigning}
      >
        {isSigning ? 'Signing...' : 'Sign Message'}
      </Button>
      
      {signedMessage && (
        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-hidden">
          <p className="font-semibold">Signature:</p>
          <p className="break-all">{signedMessage}</p>
        </div>
      )}
    </div>
  );
};

export const WalletButton = ({ 
  isConnected, 
  setIsConnected, 
  setWalletAddress, 
  variant = 'default',
  className = '' 
}: WalletButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

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

  const handleAccountSelected = (account: WalletAccount) => {
    console.log('Selected account:', account);
    
    if (!account || !account.address) {
      console.error('Invalid account selected');
      return;
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

    // Update state
    setIsConnected(true);
    setWalletAddress(assetHubAddress); // Use the Asset Hub formatted address
    setIsOpen(false);
    //add success toast
    toast.success('Wallet connected successfully!', {
      icon: '✅',
      style: {
        borderLeft: '4px solid #4caf50',
      },
    });

    // If you need to use the PAPI signer, you can access it through account.wallet
    if (account.wallet && account.signer) {
      console.log('Wallet and signer available for PAPI integration');
      
      // Here you could integrate with PAPI using the account.wallet and account.signer
      // For example, you might want to create a PolkadotSigner instance
      // This would depend on your specific requirements
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('walletName');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletSource');
    localStorage.removeItem('walletNetwork');
    localStorage.removeItem('assetHubAddress');
    
    setIsConnected(false);
    setWalletAddress('');
  };

  return (
    <>
      {isConnected ? (
        <Button 
          onClick={handleDisconnect}
          variant={variant}
          className={className}
        >
          Disconnect
        </Button>
      ) : (
        <Button 
          onClick={() => setIsOpen(true)}
          variant={variant}
          className={className}
        >
          Connect Wallet
        </Button>
      )}

      <WalletSelect
        dappName="Swush"
        open={isOpen}
        onWalletConnectOpen={() => setIsOpen(true)}
        onWalletConnectClose={() => setIsOpen(false)}
        onAccountSelected={handleAccountSelected}
        showAccountsList={true}
        walletList={[
          new TalismanWallet(),
          new NovaWallet(),
          new SubWallet(),
          new MantaWallet(),
          new PolkaGate(),
          new FearlessWallet(),
          new EnkryptWallet(),
          new PolkadotjsWallet(),
          new AlephZeroWallet(),
        ]}
      />
    </>
  );
}; 