import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion"; // we need to check if framer-motion is installed, if not we will use css
import { Check, ChevronDown, Circle } from "lucide-react";
import iptcTreeData from "@/data/iptcTree.json";

// type definition for the tree data
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
  forceFullView?: boolean;
}

interface Step {
  level: number;
  selectedNode: TreeNode;
  candidates: TreeNode[]; // selected + random siblings
}

export const DecisionTreeAnimation = ({
  targetId,
  onComplete,
  forceFullView = false,
}: DecisionTreeAnimationProps) => {
  const [isCompact, setIsCompact] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [phase, setPhase] = useState<"pending" | "thinking" | "decided">("pending");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkSize = () => {
      if (forceFullView) {
        setIsCompact(false);
      } else {
        setIsCompact(window.innerWidth < 1024);
      }
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, [forceFullView]);

  // build the path from root to target
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

    // generate steps with random siblings
    const newSteps: Step[] = path.map((node, index) => {
      let candidates: TreeNode[] = [node];

      if (node.parent) {
        const parent = iptcTree[node.parent];
        const siblings = parent.children.filter((id) => id !== node.id);
        const shuffledSiblings = [...siblings].sort(() => 0.5 - Math.random());
        const selectedSiblings = shuffledSiblings.slice(0, 2).map((id) => iptcTree[id]);
        candidates = [...candidates, ...selectedSiblings];
      }

      // filter out any undefined or invalid candidates
      candidates = candidates
        .filter((c) => c && c.name && c.name.trim() !== "")
        .sort(() => 0.5 - Math.random());

      return {
        level: index,
        selectedNode: node,
        candidates,
      };
    });

    setSteps(newSteps);
    setCurrentLevel(0);
    setPhase("thinking");

    let level = 0;
    let mounted = true;

    const runSequence = async () => {
      // initial delay
      await new Promise((r) => setTimeout(r, 500));

      while (level < newSteps.length && mounted) {
        // start thinking at this level
        setCurrentLevel(level);
        setPhase("thinking");

        // wait thinking time
        await new Promise((r) => setTimeout(r, 1000));
        if (!mounted) break;

        // decide
        setPhase("decided");

        // wait before next level
        await new Promise((r) => setTimeout(r, 800));
        if (!mounted) break;

        level++;
      }

      // depois de terminar, currentLevel vira steps.length (focamos no último nó)
      if (mounted) {
        setCurrentLevel(level);
      }

      if (mounted && onComplete) {
        onComplete();
      }
    };

    runSequence();

    return () => {
      mounted = false;
    };
  }, [targetId, forceFullView, onComplete]);

  // em modo expandido, alterna o foco totalmente para a esquerda/direita
  useEffect(() => {
    if (isCompact || steps.length === 0) return;

    const level = Math.min(currentLevel, steps.length - 1);
    if (level <= 0) return; // nível 0 é só a raiz, não precisa mexer

    const treeContainer = treeContainerRef.current;
    if (!treeContainer) return;

    // níveis ímpares: foca mais à esquerda, níveis pares: mais à direita
    const side: "left" | "right" = level % 2 === 1 ? "left" : "right";

    const maxScroll =
      treeContainer.scrollWidth - treeContainer.clientWidth;
    if (maxScroll <= 0) return;

    const leftTarget =
      side === "left"
        ? maxScroll * 0.2 // ~20% do scroll
        : maxScroll * 0.85; // ~80% do scroll

    treeContainer.scrollTo({
      left: leftTarget,
      behavior: "smooth",
    });
  }, [currentLevel, steps, isCompact]);


  return (
    <div
      className={`flex flex-col gap-4 overflow-y-auto ${
        forceFullView ? "h-full p-0" : "max-h-[60vh] p-4"
      }`}
      ref={scrollRef}
    >
      <style>{`
        .tree ul {
          padding-top: 20px; 
          position: relative;
          transition: all 0.5s;
          display: flex;
          width: max-content;
          min-width: 100%;
          justify-content: center;
        }
        .tree ul.tree-left {
          justify-content: flex-start;
        }
        .tree ul.tree-right {
          justify-content: flex-end;
        }
        .tree li {
          text-align: center;
          list-style-type: none;
          position: relative;
          padding: 20px 5px 0 5px;
          transition: all 0.5s;
        }
        /* connectors */
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

        /* green connectors */
        .tree-green li::before, .tree-green li::after,
        .tree-green li:last-child::before, .tree-green li:first-child::after {
          border-color: #22c55e !important;
        }
        .tree-green ul::before {
          border-color: #22c55e !important;
        }
      `}</style>

      <div
        className="tree w-full overflow-x-auto pb-8 scrollbar-hide"
        ref={treeContainerRef}
      >
        {steps.length > 0 && (
          <RecursiveTree
            steps={steps}
            level={0}
            currentLevel={currentLevel}
            phase={phase}
            isCompact={isCompact}
          />
        )}
      </div>

      {/* final success state */}
      {currentLevel >= steps.length && steps.length > 0 && (
        <div className="mt-4 pt-6 border-t border-border w-full flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="h-10 w-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3 shadow-sm ring-2 ring-green-50">
            <Check className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-center">Classificação Concluída!</h3>
          <p className="text-sm text-muted-foreground text-center mt-1 max-w-md">
            A IA determinou a categoria{" "}
            <span className="font-semibold text-foreground">
              "{steps[steps.length - 1].selectedNode.name}"
            </span>{" "}
            navegando pela árvore de decisão com as{" "}
            <a
              href="https://iptc.org/standards/media-topics/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              categorias do IPTC
            </a>
            .
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
  phase,
  isCompact,
}: {
  steps: Step[];
  level: number;
  currentLevel: number;
  phase: "pending" | "thinking" | "decided";
  isCompact: boolean;
}) => {
  if (level >= steps.length) return null;

  const step = steps[level];

  // determine status for this level
  let status: "pending" | "thinking" | "decided" = "pending";
  if (level < currentLevel) {
    status = "decided";
  } else if (level === currentLevel) {
    status = phase === "thinking" ? "thinking" : "decided";
  }

  const isVisible = status !== "pending";
  const isGreenPath = status !== "pending";

  if (!isVisible) return null;

  // compact mode logic:
  // if isCompact is true and this level is already decided (past level),
  // only show the selected node.
  let candidatesToShow = step.candidates;
  if (isCompact && level < currentLevel) {
    candidatesToShow = step.candidates.filter(
      (c) => c.id === step.selectedNode.id,
    );
  }

  // em modo expandido, alterna lado do filho selecionado: esquerda, direita, esquerda...
  let sideClass = "";
  const isExpanded = !isCompact;

  if (isExpanded && level > 0) {
    const side: "left" | "right" = level % 2 === 1 ? "left" : "right";
    sideClass = side === "left" ? "tree-left" : "tree-right";

    // garante que o nó selecionado esteja sempre na extremidade
    const selected = step.selectedNode;
    const others = candidatesToShow.filter((c) => c.id !== selected.id);

    if (side === "left") {
      candidatesToShow = [selected, ...others];
    } else {
      candidatesToShow = [...others, selected];
    }
  }

  return (
    <ul className={`${isGreenPath ? "tree-green" : ""} ${sideClass}`}>
      {candidatesToShow.map((candidate) => {
        const isSelected = candidate.id === step.selectedNode.id;
        const isDecided = status === "decided";
        const isThinking = status === "thinking";
        const isHistory = level < currentLevel;

        // styles for the node card
        let selectedStyle = "";
        let iconStyle = "";

        if (isDecided && isSelected) {
          // always green for decided path
          selectedStyle =
            "border-2 border-green-500 bg-green-500/10 shadow-sm";
          iconStyle = "bg-green-500 text-white";

          if (!isHistory && currentLevel < steps.length) {
            selectedStyle += " scale-105 shadow-md ring-2 ring-green-500/20";
          } else {
            selectedStyle += " scale-100";
          }
        } else if (isDecided && !isSelected) {
          // rejected
          selectedStyle =
            "border-muted/50 bg-muted/10 opacity-50 grayscale scale-95";
          iconStyle = "bg-muted text-muted-foreground";
        } else if (isThinking) {
          // thinking
          selectedStyle = "border-muted bg-card";
          iconStyle = "bg-muted text-muted-foreground";
        } else {
          // pending
          selectedStyle = "border-muted bg-card";
          iconStyle = "bg-muted text-muted-foreground";
        }

        return (
          <li key={candidate.id}>
            <div
              id={`tree-node-${candidate.id}`}
              className={`
                relative flex items-center gap-2 p-2 rounded-xl border transition-all duration-500 w-full min-w-[120px] max-w-[180px] mx-auto
                ${selectedStyle}
              `}
            >
              <div
                className={`
                h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500
                ${iconStyle}
              `}
              >
                {isDecided && isSelected ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              <span
                className={`font-medium text-xs text-wrap leading-tight ${
                  isDecided && !isSelected
                    ? "line-through decoration-muted-foreground/50"
                    : ""
                }`}
              >
                {candidate.name}
              </span>

              {isThinking && (
                <div className="absolute inset-0 rounded-xl bg-primary/5 animate-pulse pointer-events-none" />
              )}
            </div>

            {/* recursive children */}
            {isSelected && (
              <RecursiveTree
                steps={steps}
                level={level + 1}
                currentLevel={currentLevel}
                phase={phase}
                isCompact={isCompact}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};
