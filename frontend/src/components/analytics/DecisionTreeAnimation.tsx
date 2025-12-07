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
  status: "pending" | "thinking" | "decided";
}

export const DecisionTreeAnimation = ({ targetId, onComplete }: DecisionTreeAnimationProps) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
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
        // Get all siblings excluding self
        const siblings = parent.children.filter(id => id !== node.id);
        
        // Pick up to 2 random siblings
        const shuffledSiblings = [...siblings].sort(() => 0.5 - Math.random());
        const selectedSiblings = shuffledSiblings.slice(0, 2).map(id => iptcTree[id]);
        
        candidates = [...candidates, ...selectedSiblings];
      } else {
        // For root, try to find other roots or just show self
        // Since we don't have a list of roots easily, we'll just show self for level 0
        // Or we could try to find siblings if we had a "super-root"
      }

      // Shuffle candidates for display
      candidates = candidates.sort(() => 0.5 - Math.random());

      return {
        level: index,
        selectedNode: node,
        candidates,
        status: "pending"
      };
    });

    setSteps(newSteps);
    
    // Start animation sequence
    let level = 0;
    const animateNext = () => {
      if (level >= newSteps.length) {
        if (onComplete) onComplete();
        return;
      }

      setSteps(prev => prev.map((s, i) => 
        i === level ? { ...s, status: "thinking" } : s
      ));
      setCurrentLevel(level);

      // Scroll to bottom
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }

      // Thinking time
      setTimeout(() => {
        setSteps(prev => prev.map((s, i) => 
          i === level ? { ...s, status: "decided" } : s
        ));
        
        level++;
        setTimeout(animateNext, 800); // Delay before next level
      }, 1000); // Thinking duration
    };

    // Start after a brief delay
    setTimeout(animateNext, 500);

  }, [targetId]);

  return (
    <div className="flex flex-col gap-4 p-4 max-h-[60vh] overflow-y-auto" ref={scrollRef}>
      {steps.map((step, index) => (
        <div key={step.selectedNode.id} className={`transition-opacity duration-500 ${step.status === 'pending' ? 'opacity-0 hidden' : 'opacity-100'}`}>
          
          {/* Connector Line */}
          {index > 0 && (
            <div className="flex justify-center py-2">
              <div className="h-8 w-0.5 bg-muted-foreground/30"></div>
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Nível {index + 1}
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              {step.candidates.map((candidate) => {
                const isSelected = candidate.id === step.selectedNode.id;
                const isDecided = step.status === 'decided';
                const isThinking = step.status === 'thinking';

                return (
                  <div 
                    key={candidate.id}
                    className={`
                      relative flex items-center gap-2 p-2 rounded-xl border transition-all duration-500 w-full max-w-[200px]
                      ${isDecided && isSelected ? 'border-primary bg-primary/10 scale-105 shadow-md' : ''}
                      ${isDecided && !isSelected ? 'border-muted/50 bg-muted/10 opacity-50 grayscale scale-95' : ''}
                      ${isThinking ? 'border-muted bg-card' : ''}
                      ${!isDecided && !isThinking ? 'border-muted bg-card' : ''}
                    `}
                  >
                    <div className={`
                      h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500
                      ${isDecided && isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                    `}>
                      {isDecided && isSelected ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    </div>
                    <span className={`font-medium text-xs ${isDecided && !isSelected ? 'line-through decoration-muted-foreground/50' : ''}`}>
                      {candidate.name}
                    </span>
                    
                    {/* Only show thinking spinner on the correct node if we want to give it away, 
                        OR show on all? 
                        User wants "sensation of decision". 
                        Let's show a subtle pulse on ALL candidates during thinking to show "processing" 
                    */}
                    {isThinking && (
                      <div className="absolute inset-0 rounded-xl bg-primary/5 animate-pulse pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      
      {/* Final Success State */}
      {currentLevel === steps.length && steps.length > 0 && (
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
