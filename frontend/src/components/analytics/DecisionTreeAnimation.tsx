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
      <style>{`
        .tree ul {
          padding-top: 20px; 
          position: relative;
          transition: all 0.5s;
          display: flex; 
          justify-content: center;
        }
        .tree li {
          float: left; text-align: center;
          list-style-type: none;
          position: relative;
          padding: 20px 5px 0 5px;
          transition: all 0.5s;
        }
        /* Connectors */
        .tree li::before, .tree li::after {
          content: ''; 
          position: absolute; top: 0; right: 50%;
          border-top: 2px solid hsl(var(--muted-foreground) / 0.3); 
          width: 50%; height: 20px;
          transition: border-color 0.5s;
        }
        .tree li::after {
          right: auto; left: 50%;
          border-left: 2px solid hsl(var(--muted-foreground) / 0.3);
        }
        .tree li:only-child::after, .tree li:only-child::before {
          display: none;
        }
        .tree li:only-child { padding-top: 0; }
        .tree li:first-child::before, .tree li:last-child::after {
          border: 0 none;
        }
        .tree li:last-child::before{
          border-right: 2px solid hsl(var(--muted-foreground) / 0.3);
          border-radius: 0 5px 0 0;
        }
        .tree li:first-child::after{
          border-radius: 5px 0 0 0;
        }
        .tree ul ul::before{
          content: ''; position: absolute; top: 0; left: 50%;
          border-left: 2px solid hsl(var(--muted-foreground) / 0.3); 
          width: 0; height: 20px;
          transition: border-color 0.5s;
        }

        /* Green Connectors */
        .tree-green li::before, .tree-green li::after,
        .tree-green li:last-child::before, .tree-green li:first-child::after {
          border-color: #22c55e !important; /* green-500 */
        }
        .tree-green ul::before {
          border-color: #22c55e !important;
        }
      `}</style>

      <div className="tree w-full overflow-x-auto pb-8">
        {steps.length > 0 && (
          <RecursiveTree 
            steps={steps} 
            level={0} 
            currentLevel={currentLevel} 
            phase={phase} 
          />
        )}
      </div>

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

const RecursiveTree = ({ 
  steps, 
  level, 
  currentLevel, 
  phase 
}: { 
  steps: Step[], 
  level: number, 
  currentLevel: number, 
  phase: "pending" | "thinking" | "decided" 
}) => {
  if (level >= steps.length) return null;

  const step = steps[level];
  
  // Determine status for this level
  let status: "pending" | "thinking" | "decided" = "pending";
  if (level < currentLevel) {
    status = "decided";
  } else if (level === currentLevel) {
    status = phase === "thinking" ? "thinking" : "decided";
  }

  // If we are waiting for this level to appear (pending), don't render children yet
  // But we might want to render the root initially?
  // The logic in main component handles "thinking" phase by showing the level.
  // If status is pending, we hide it.
  const isVisible = status !== "pending";
  
  // Determine if the connections TO this level should be green.
  // This level's UL is connected to the previous level's selected node.
  // If the previous level is decided, then the connection is green?
  // Actually, the connection represents the flow. If we are AT this level (thinking or decided), 
  // the path TO here is valid.
  const isGreenPath = status !== "pending";

  if (!isVisible) return null;

  return (
    <ul className={isGreenPath ? "tree-green" : ""}>
      {step.candidates.map((candidate) => {
        const isSelected = candidate.id === step.selectedNode.id;
        const isDecided = status === 'decided';
        const isThinking = status === 'thinking';
        const isHistory = level < currentLevel;

        // Styles for the node card
        let selectedStyle = '';
        let iconStyle = '';
        
        if (isDecided && isSelected) {
          // Always Green for decided path
          selectedStyle = 'border-2 border-green-500 bg-green-500/10 shadow-sm';
          iconStyle = 'bg-green-500 text-white';

          if (!isHistory && currentLevel < steps.length) {
            selectedStyle += ' scale-105 shadow-md ring-2 ring-green-500/20';
          } else {
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
          <li key={candidate.id}>
            <div 
              className={`
                relative flex items-center gap-2 p-2 rounded-xl border transition-all duration-500 w-full min-w-[140px] max-w-[200px] mx-auto
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
              
              {isThinking && (
                <div className="absolute inset-0 rounded-xl bg-primary/5 animate-pulse pointer-events-none" />
              )}
            </div>

            {/* Recursive Children */}
            {isSelected && (
              <RecursiveTree 
                steps={steps} 
                level={level + 1} 
                currentLevel={currentLevel} 
                phase={phase} 
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};
