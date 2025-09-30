import { ArrowRight } from 'lucide-react';
import { TokenButtonProps } from '../types';

export const TokenButton = ({ token, symbol, icon, network, onClick }: TokenButtonProps) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 rounded-xl hover:bg-midnight transition-all duration-200 w-full group"
  >
    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-600 group-hover:from-slate-600 group-hover:to-slate-500 transition-all duration-200">
      {icon}
    </div>
    <div className="flex flex-col items-start">
      <span className="text-sm text-white group-hover:text-slate-300 transition-colors duration-200">{network}</span>
    </div>
  </button>
); 