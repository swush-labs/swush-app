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
} from '@talismn/connect-wallets';
import { toast } from 'react-hot-toast';
import { WalletButtonProps } from './types';

export const WalletButton = ({ 
  isConnected, 
  setIsConnected, 
  setWalletAddress, 
  variant = 'default',
  className = '' 
}: WalletButtonProps) => {
  const handleAccountSelected = (account: any) => {
    setIsConnected(true);
    setWalletAddress(account.address);
    toast.success('Wallet connected successfully', {
      icon: '👋',
      style: {
        borderLeft: '4px solid #22c55e',
      },
    });
  };

  return (
    <WalletSelect
      dappName="Swush"
      showAccountsList
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
      triggerComponent={
        <Button 
          variant={variant}
          className={className}
        >
          Connect Wallet
        </Button>
      }
      onAccountSelected={handleAccountSelected}
    />
  );
}; 