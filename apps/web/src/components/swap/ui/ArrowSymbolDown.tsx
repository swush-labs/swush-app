//create a component that displays an arrow symbol pointing down

import React from 'react';
import { ChevronsDown } from 'lucide-react';
import { motion } from 'framer-motion';


export const ArrowSymbolDown = () => {
    return (
        <div className="flex justify-center -my-3 relative z-10">
            <motion.div
                className="p-2 rounded-lg bg-slate-700/90 backdrop-blur-sm border border-slate-600/50 shadow-lg hover:bg-slate-600/90 transition-all duration-200 cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.01 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                <ChevronsDown className="w-6 h-6 text-slate-300" />
            </motion.div>
        </div>
    );
};


