export const shortenAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const mockBlockchainTransaction = async (): Promise<boolean> => {
  const success = Math.random() > 0.1;
  return success;
};

export const calculateOutputAmount = (inputAmount: string): string => {
  const inputValue = parseFloat(inputAmount);
  return isNaN(inputValue) ? '0' : (inputValue * 2).toFixed(4);
};

export const calculateMinimumReceived = (outputAmount: string): string => {
  return (parseFloat(outputAmount) * 0.995).toFixed(4);
}; 