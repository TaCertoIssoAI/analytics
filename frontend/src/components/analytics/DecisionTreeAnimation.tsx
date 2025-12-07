import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion"; // We need to check if framer-motion is installed, if not we'll use CSS
import { Check, ChevronDown, Circle } from "lucide-react";
import iptcTreeData from "@/data/iptcTree.json";

// Type definition for the tree data
type TreeNode = {
  id: string;
  name: string;
  parent: string | null;
  children: string[];
};

const iptcTree = iptcTreeData as Record<string, TreeNode>;

interface DecisionTreeAnimationProps {
  targetId: string;
  onComplete?: () => void;
}

interface Step {
  level: number;
  selectedNode: TreeNode;
  candidates: TreeNode[]; // Selected + Random siblings
}

export const DecisionTreeAnimation = ({ targetId, onComplete }: DecisionTreeAnimationProps) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [phase, setPhase] = useState<"pending" | "thinking" | "decided">("pending"); // pending, thinking, decided
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build the path from root to target
  useEffect(() => {
    if (!targetId || !iptcTree[targetId]) return;

    const path: TreeNode[] = [];
    let current: TreeNode | null = iptcTree[targetId];

    while (current) {
      path.unshift(current);
      if (current.parent) {
        current = iptcTree[current.parent];
      } else {
        current = null;
      }
    }

    // Generate steps with random siblings
    const newSteps: Step[] = path.map((node, index) => {
      let candidates: TreeNode[] = [node];
      
      if (node.parent) {
        const parent = iptcTree[node.parent];
        const siblings = parent.children.filter(id => id !== node.id);
        const shuffledSiblings = [...siblings].sort(() => 0.5 - Math.random());
        const selectedSiblings = shuffledSiblings.slice(0, 2).map(id => iptcTree[id]);
        candidates = [...candidates, ...selectedSiblings];
      }

      // Filter out any undefined or invalid candidates
      candidates = candidates.filter(c => c && c.name && c.name.trim() !== "").sort(() => 0.5 - Math.random());

      return {
        level: index,
        selectedNode: node,
        candidates
      };
    });

    setSteps(newSteps);
    setCurrentLevel(0);
    setPhase("thinking"); // Start thinking immediately
    
    // Animation Loop
    let level = 0;
    let mounted = true;

    const runSequence = async () => {
      // Initial delay
      await new Promise(r => setTimeout(r, 500));

      while (level < newSteps.length && mounted) {
        // Start Thinking
        setCurrentLevel(level);
        setPhase("thinking");
        
        // Scroll to bottom
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        // Wait thinking time
        await new Promise(r => setTimeout(r, 1000));
        if (!mounted) break;

        // Decide
        setPhase("decided");

        // Wait before next level
        await new Promise(r => setTimeout(r, 800));
        if (!mounted) break;

        level++;
      }

      if (mounted && onComplete) {
        onComplete();
      }
    };

    runSequence();

    return () => {
      mounted = false;
    };
  }, [targetId]);

  return (
    <div className="flex flex-col gap-4 p-4 max-h-[60vh] overflow-y-auto" ref={scrollRef}>
      {steps.map((step, index) => {
        // Determine status based on global state
        let status: "pending" | "thinking" | "decided" = "pending";
        
        if (index < currentLevel) {
          status = "decided";
        } else if (index === currentLevel) {
          status = phase === "thinking" ? "thinking" : "decided";
        } else {
          status = "pending";
        }

        // If we are past the last level (finished), everything is decided
        if (currentLevel >= steps.length) {
          status = "decided";
        }

        return (
        <div key={step.selectedNode.id} className={`transition-opacity duration-500 ${status === 'pending' ? 'opacity-0 hidden' : 'opacity-100'}`}>
          
          {/* Connector Line */}
          {index > 0 && (
            <div className="flex justify-center py-2">
              <div className={`h-8 w-0.5 transition-colors duration-500 ${status === 'decided' ? 'bg-green-500' : 'bg-muted-foreground/30'}`}></div>
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Nível {index + 1}
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              {step.candidates.map((candidate) => {
                const isSelected = candidate.id === step.selectedNode.id;
                const isDecided = status === 'decided';
                const isThinking = status === 'thinking';
                const isHistory = index < currentLevel;

                // Styles for the selected node
                let selectedStyle = '';
                let iconStyle = '';
                
                if (isDecided && isSelected) {
                  // Always Green for decided path
                  selectedStyle = 'border-2 border-green-500 bg-green-500/10 shadow-sm';
                  iconStyle = 'bg-green-500 text-white';

                  if (!isHistory && currentLevel < steps.length) {
                    // Current Decision gets extra emphasis (scale)
                    selectedStyle += ' scale-105 shadow-md ring-2 ring-green-500/20';
                  } else {
                    // History just stays green
                    selectedStyle += ' scale-100';
                  }
                } else if (isDecided && !isSelected) {
                  // Rejected
                  selectedStyle = 'border-muted/50 bg-muted/10 opacity-50 grayscale scale-95';
                  iconStyle = 'bg-muted text-muted-foreground';
                } else if (isThinking) {
                  // Thinking
                  selectedStyle = 'border-muted bg-card';
                  iconStyle = 'bg-muted text-muted-foreground';
                } else {
                  // Pending
                  selectedStyle = 'border-muted bg-card';
                  iconStyle = 'bg-muted text-muted-foreground';
                }

                return (
                  <div 
                    key={candidate.id}
                    className={`
                      relative flex items-center gap-2 p-2 rounded-xl border transition-all duration-500 w-full max-w-[200px]
                      ${selectedStyle}
                    `}
                  >
                    <div className={`
                      h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500
                      ${iconStyle}
                    `}>
                      {isDecided && isSelected ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    </div>
                    <span className={`font-medium text-xs ${isDecided && !isSelected ? 'line-through decoration-muted-foreground/50' : ''}`}>
                      {candidate.name}
                    </span>
                    
                    {/* Pulse effect during thinking */}
                    {isThinking && (
                      <div className="absolute inset-0 rounded-xl bg-primary/5 animate-pulse pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )})}
      
      {/* Final Success State */}
      {currentLevel >= steps.length && steps.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-green-50">
            <Check className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-center">Classificação Concluída!</h3>
          <p className="text-muted-foreground text-center mt-1">
            A IA determinou que esta afirmação pertence à categoria <br/>
            <span className="font-semibold text-foreground">"{steps[steps.length - 1].selectedNode.name}"</span>
          </p>
        </div>
      )}
    </div>
  );
};
