import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { WalletMenuProps } from '../types';
import { shortenAddress } from '../utils';

export const WalletMenu = ({
  address,
  onDisconnect,
  className = ''
}: WalletMenuProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleDisconnect = () => {
    onDisconnect();
    setShowMenu(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="outline"
        className={`flex items-center gap-2 ${className}`}
        onClick={() => setShowMenu(!showMenu)}
      >
        <Wallet className="w-4 h-4" />
        <span>{shortenAddress(address)}</span>
        <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} />
      </Button>

      {showMenu && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-800 border border-slate-700 shadow-lg z-50"
        >
          <button
            onClick={handleDisconnect}
            className="w-full px-4 py-2 text-left text-rose-400 hover:bg-slate-700/50 transition-colors rounded-xl"
          >
            Disconnect
          </button>
        </motion.div>
      )}
    </div>
  );
}; 