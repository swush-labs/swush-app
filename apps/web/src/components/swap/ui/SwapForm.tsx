import { TokenInfo } from '@/components/swap/types';
import { SwapField } from '@/components/swap';
import { ArrowSymbolDown } from '@/components/swap';
import { SwapDetails } from '@/components/swap';
import { SubmitButtonAction } from '@/components/swap';
import { calculateMinimumReceived } from '@/components/swap';

interface SwapFormProps {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
  inputBalance: string;
  outputBalance: string;
  routeDex: string;
  routeState: {
    isLoading: boolean;
    error: string | null;
  };
  insufficientBalance: boolean;
  isConnected: boolean;
  isBalanceLoading: boolean;
  
  // Handlers
  onInputTokenSelect: (token: TokenInfo) => void;
  onOutputTokenSelect: (token: TokenInfo) => void;
  handleInputChange: (value: string) => void;
  handlePercentageSelect: (percentage: number) => void;
  handleSwapExecution: (isConnected: boolean) => void;
  
  // UI state
  openInputDialog: boolean;
  setOpenInputDialog: (value: boolean) => void;
  openOutputDialog: boolean;
  setOpenOutputDialog: (value: boolean) => void;
  isSwapping: boolean;
  setIsConnected: (value: boolean) => void;
  setWalletAddress: (value: string) => void;
  
  // Data
  tokens: TokenInfo[];
  percentageOptions: { label: string; value: number }[];
}

export const SwapForm = ({
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  inputBalance,
  outputBalance,
  routeDex,
  routeState,
  insufficientBalance,
  isConnected,
  isBalanceLoading,
  onInputTokenSelect,
  onOutputTokenSelect,
  handleInputChange,
  handlePercentageSelect,
  handleSwapExecution,
  openInputDialog,
  setOpenInputDialog,
  openOutputDialog,
  setOpenOutputDialog,
  isSwapping,
  setIsConnected,
  setWalletAddress,
  tokens,
  percentageOptions
}: SwapFormProps) => {
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <SwapField
          type="input"
          token={inputToken}
          amount={inputAmount}
          balance={inputBalance}
          onTokenSelect={onInputTokenSelect}
          onAmountChange={handleInputChange}
          openDialog={openInputDialog}
          setOpenDialog={setOpenInputDialog}
          availableTokens={tokens}
          percentageOptions={percentageOptions}
          onPercentageSelect={handlePercentageSelect}
          isLoading={isConnected && isBalanceLoading}
        />

        <ArrowSymbolDown />

        <SwapField
          type="output"
          token={outputToken}
          amount={outputAmount}
          balance={outputBalance}
          onTokenSelect={onOutputTokenSelect}
          openDialog={openOutputDialog}
          setOpenDialog={setOpenOutputDialog}
          availableTokens={tokens}
          isLoading={routeState.isLoading || (isConnected && isBalanceLoading)}
          error={routeState.error}
        />
      </div>

      <SwapDetails
        minimumReceived={calculateMinimumReceived(outputAmount)}
        outputToken={outputToken}
        inputToken={inputToken}
        maxTransactionFee="0.004005"
        route={routeDex}
      />

      <SubmitButtonAction
        isConnected={isConnected}
        setIsConnected={setIsConnected}
        setWalletAddress={setWalletAddress}
        onSwap={() => handleSwapExecution(isConnected)}
        isSwapping={isSwapping}
        insufficientBalance={insufficientBalance}
        disabled={!inputAmount || parseFloat(inputAmount) <= 0 || insufficientBalance}
      />
    </div>
  );
}; 