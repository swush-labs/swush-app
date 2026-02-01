import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { TokenButton } from '../button/TokenButton';
import { AssetListProps, TokenInfo, AssetGroup } from '../types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { usePriceAggregator } from '@/services/prices';

export const AssetList = ({ assetGroups, onSelect, currentAsset, onClose }: AssetListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  // Extract unique symbols from asset groups for price fetching
  const symbols = useMemo(() => {
    return Array.from(new Set(assetGroups.map(group => group.symbol)));
  }, [assetGroups]);

  // Fetch prices for all symbols
  const { getPrice } = usePriceAggregator(symbols);

  const filteredGroups = assetGroups.filter((group: AssetGroup) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      group.symbol.toLowerCase().includes(q) ||
      group.name.toLowerCase().includes(q) ||
      group.network ||
      group.tokens.some(t => (t.network || '').toLowerCase().includes(q))
    );
  });

  const handleSelect = (asset: TokenInfo) => {
    onSelect(asset);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-davyGray w-5 h-5" />
        <Input
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 bg-woodsmoke text-white text-opacity-30 border-0 h-12 text-sm"
        />
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3 no-scrollbar">
        {filteredGroups?.length > 0 ? filteredGroups.map((group) => (
          <div key={group.symbol} className={cn("rounded-lg",
            expandedSymbol === group.symbol && "bg-midnight"
          )}>
            <button
              className="w-full flex items-center justify-between px-4 py-3"
              onClick={() => setExpandedSymbol(prev => prev === group.symbol ? null : group.symbol)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-midnight flex items-center justify-center overflow-hidden ring-1 ring-white/10">
                  {typeof group.icon === 'string' && group.icon.startsWith('/') ? (
                    <Image src={group.icon} alt={group.symbol} width={36} height={36} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-base font-bold">{group.icon}</span>
                  )}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-white text-md font-semibold">{group.symbol}</span>
                  <span className="text-forest-400 text-xs">{group.tokens.length} Networks</span>
                </div>
              </div>
              <span className="text-forest-400 text-sm">
                {getPrice(group.symbol) 
                  ? `$${getPrice(group.symbol)!.toFixed(2)}` 
                  : '—'}
              </span>
            </button>

            {expandedSymbol === group.symbol && (
              <div className="flex items-start px-9 gap-x-3" >
                <Image src="/icons/curve-arrow-down-right.svg" alt="arrow-icon" width={7} height={30} className="w-[7px] h-[30px]" />
                <div className="pb-3 space-y-3">
                  {group.tokens.map((token) => (
                    <TokenButton
                      key={`${group.symbol}-${token.id}-${token.network || 'default'}`}
                      symbol={group.symbol}
                      token={token.network || token.name}
                      network={token.network || ''}
                      icon={
                        <div className={`w-full h-full ${
                          token.name === currentAsset?.name ? 'bg-blue-500' : 'bg-slate-600'
                        } rounded-full flex items-center justify-center overflow-hidden`}>
                          {typeof group.icon === 'string' && group.icon.startsWith('/') ? (
                            <Image src={group.icon} alt={group.symbol} width={40} height={40} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-sm font-bold">{group.icon}</span>
                          )}
                        </div>
                      }
                      onClick={() => handleSelect(token)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )) : (
          <div className="flex flex-col items-center mt-10" >
            <Image src="/images/nothing-found.png" alt="nothing-found" width={160} height={160} />
            <p className="text-white text-base font-medium mt-6 mb-1" >Token not found</p>
            <p className="text-greyBlue text-sm" >Try changing your search query</p>
          </div>
        )}
      </div>
    </div>
  );
}; 