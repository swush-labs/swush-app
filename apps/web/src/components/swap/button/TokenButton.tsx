import { ArrowRight } from 'lucide-react';
import { TokenButtonProps } from '../types';

export const TokenButton = ({ token, symbol, icon, onClick }: TokenButtonProps) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all duration-200 w-full group"
  >
    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-600 group-hover:from-slate-600 group-hover:to-slate-500 transition-all duration-200">
      {icon}
    </div>
    <div className="flex flex-col items-start">
      <span className="font-semibold text-white group-hover:text-slate-200 transition-colors duration-200">{symbol}</span>
      <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors duration-200">{token}</span>
    </div>
    <ArrowRight className="w-5 h-5 text-slate-400 ml-auto group-hover:text-slate-300 transition-colors duration-200" />
  </button>
); 