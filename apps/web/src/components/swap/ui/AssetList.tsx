import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { TokenButton } from '../button/TokenButton';
import { AssetListProps, TokenInfo } from '../types';

export const AssetList = ({ assets, onSelect, currentAsset, onClose }: AssetListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredAssets = assets.filter((asset: TokenInfo) => 
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (asset: any) => {
    onSelect(asset);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-slate-800 border-slate-700 text-white"
        />
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2">
        {filteredAssets.map((token) => (
          <TokenButton
            key={token.name}
            symbol={token.symbol}
            token={token.name}
            icon={
              <div className={`w-full h-full ${
                token.name === currentAsset.name ? 'bg-blue-500' : 'bg-slate-600'
              } rounded-full flex items-center justify-center`}>
                <span className="text-white text-lg font-bold">{token.icon}</span>
              </div>
            }
            onClick={() => handleSelect(token)}
          />
        ))}
      </div>
    </div>
  );
}; 