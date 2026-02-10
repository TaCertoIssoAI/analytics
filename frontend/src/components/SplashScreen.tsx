import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSplash } from '@/context/SplashContext';
import { useTheme } from 'next-themes';

const SplashScreen: React.FC = () => {
  const { isVisible, progress } = useSplash();
  const { resolvedTheme } = useTheme();
  
  // Check for high contrast mode (synced with Header.tsx logic)
  // We read directly from localStorage to ensure it's available immediately
  const isHighContrast = typeof window !== 'undefined' ? localStorage.getItem("highContrast") === "true" : false;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden"
          exit={{ 
            y: "-100%",
            transition: { 
              duration: 0.8, 
              ease: [0.76, 0, 0.24, 1] // Custom bezier for smooth "slide up" feel
            } 
          }}
        >
          {/* Optional: Background decoration to make it feel more premium */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-b from-transparent to-background/10 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center relative z-10"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20,
                duration: 1.5 
              }}
              className="mb-8"
            >
              <motion.img
                src={resolvedTheme === 'light' && !isHighContrast ? "/tacertoissoai-logo-whitemode.svg" : "/tacertoissoai-logo.svg"}
                alt="Tá Certo Isso? Logo"
                className="w-56 h-56 md:w-80 md:h-80 drop-shadow-2xl"
                animate={{ 
                  y: [0, -10, 0],
                  filter: ["drop-shadow(0 10px 15px rgba(0,0,0,0.2))", "drop-shadow(0 20px 25px rgba(0,0,0,0.3))", "drop-shadow(0 10px 15px rgba(0,0,0,0.2))"]
                }}
                transition={{ 
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                  delay: 1 // Wait for entrance to finish
                }}
              />
            </motion.div>

            <motion.h1
              className="text-xl font-bold text-center text-foreground md:text-3xl tracking-tight mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
            >
              Verificar é tão fácil quanto encaminhar
            </motion.h1>

            {/* Loading Bar */}
            <motion.div 
              className="w-64 h-1.5 bg-muted rounded-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "linear" }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
