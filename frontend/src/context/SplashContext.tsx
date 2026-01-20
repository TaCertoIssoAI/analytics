import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SplashContextType {
  isVisible: boolean;
  addTask: (id: string) => void;
  removeTask: (id: string) => void;
  progress: number;
}

const SplashContext = createContext<SplashContextType | undefined>(undefined);

export const useSplash = () => {
  const context = useContext(SplashContext);
  if (!context) {
    throw new Error('useSplash must be used within a SplashProvider');
  }
  return context;
};

interface SplashProviderProps {
  children: ReactNode;
  minDuration?: number; // Minimum duration in ms
}

export const SplashProvider: React.FC<SplashProviderProps> = ({ children, minDuration = 2000 }) => {
  const [tasks, setTasks] = useState<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Handle minimum duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration]);

  // Handle progress simulation
  useEffect(() => {
    if (!isVisible) {
        setProgress(100);
        return;
    }

    let animationFrame: number;
    
    const animate = () => {
      setProgress(prev => {
        const target = tasks.size === 0 ? 100 : 99; // Aim for 99% if waiting
        
        if (prev >= target) return prev;

        let step = 0;
        const remaining = target - prev;

        if (tasks.size === 0) {
            // Fast finish
            step = Math.max(0.5, remaining * 0.1);
        } else {
            // Waiting mode
            if (prev < 80) {
                // Fast initial load
                step = Math.max(0.5, remaining * 0.05);
            } else if (prev < 90) {
                // Slow down
                step = Math.max(0.1, remaining * 0.02);
            } else {
                // Very slow creep (the "travadinha" effect but still moving)
                step = 0.05; 
            }
        }
        
        return Math.min(prev + step, target);
      });
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [tasks.size, isVisible]);

  // Check if we should hide the splash screen
  useEffect(() => {
    if (minTimeElapsed && tasks.size === 0) {
        // Small delay to ensure progress hits 100% visually before hiding
        const timeout = setTimeout(() => {
            setIsVisible(false);
        }, 500);
        return () => clearTimeout(timeout);
    }
  }, [minTimeElapsed, tasks.size]);

  const addTask = useCallback((id: string) => {
    setTasks(prev => {
      const newTasks = new Set(prev);
      newTasks.add(id);
      return newTasks;
    });
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => {
      const newTasks = new Set(prev);
      newTasks.delete(id);
      return newTasks;
    });
  }, []);

  return (
    <SplashContext.Provider value={{ isVisible, addTask, removeTask, progress }}>
      {children}
    </SplashContext.Provider>
  );
};
