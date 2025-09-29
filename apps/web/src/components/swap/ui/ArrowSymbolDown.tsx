//create a component that displays an arrow symbol pointing down

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';


export const ArrowSymbolDown = () => {
    return (
        <div className="flex justify-center -my-3 relative z-20">
            <motion.div
                className="relative group cursor-pointer"
            >
                <div className="relative w-9 h-9 bg-cadmiumOrange rounded-full flex items-center justify-center">
                    <Image
                        src="/icons/ArrowUpDown.svg"
                        alt="arrow-up-down"
                        width={14}
                        height={14}
                    />
                </div>
            </motion.div>
        </div>
    );
};


