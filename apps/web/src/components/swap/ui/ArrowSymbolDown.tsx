//create a component that displays an arrow symbol pointing down

import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { motion } from 'framer-motion';


export const ArrowSymbolDown = () => {
    return (
        <div className="flex justify-center -my-3 relative z-20">
            <motion.div
                className="relative group cursor-pointer"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                    opacity: 1, 
                    scale: 1,
                    rotate: [0, 3, -3, 0],
                }}
                transition={{ 
                    opacity: { duration: 0.4, ease: "easeOut" },
                    scale: { duration: 0.4, ease: "easeOut" },
                    rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                {/* Magical glow background */}
                <div className="absolute inset-0 bg-gradient-to-br from-flame-400 to-flame-500 rounded-full blur-md opacity-60 group-hover:opacity-80 animate-magical-glow"></div>
                
                {/* Main button */}
                <div className="relative w-12 h-12 bg-gradient-to-br from-flame-400 to-flame-500 rounded-full flex items-center justify-center border-2 border-forest-200/20 shadow-lg shadow-flame-500/30 group-hover:shadow-flame-500/50 transition-all duration-300 backdrop-blur-sm">
                    <ArrowUpDown className="w-5 h-5 text-white" />
                </div>
                
                {/* Floating sparkles */}
                <motion.div 
                    className="absolute -top-1 -right-1 w-2 h-2 bg-forest-300 rounded-full"
                    animate={{ 
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0] 
                    }}
                    transition={{ 
                        duration: 2, 
                        repeat: Infinity, 
                        delay: 0.5 
                    }}
                />
                <motion.div 
                    className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-flame-300 rounded-full"
                    animate={{ 
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0] 
                    }}
                    transition={{ 
                        duration: 2, 
                        repeat: Infinity, 
                        delay: 1 
                    }}
                />
                <motion.div 
                    className="absolute top-0 left-0 w-1 h-1 bg-forest-200 rounded-full"
                    animate={{ 
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0] 
                    }}
                    transition={{ 
                        duration: 2, 
                        repeat: Infinity, 
                        delay: 1.5 
                    }}
                />
            </motion.div>
        </div>
    );
};


