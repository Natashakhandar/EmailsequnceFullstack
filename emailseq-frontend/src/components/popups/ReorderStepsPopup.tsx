import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, GripVertical, ArrowUp, ArrowDown, Save, X } from "lucide-react";

interface EmailStep {
  id: string;
  templateId: string;
  subject: string;
  body: string;
  stepOrder: number;
  delayDays: number;
  delayHours: number;
}

interface ReorderStepsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reorderedSteps: EmailStep[]) => void;
  steps: EmailStep[];
}

const ReorderStepsPopup = ({
  isOpen,
  onClose,
  onSave,
  steps
}: ReorderStepsPopupProps) => {
  const [reorderedSteps, setReorderedSteps] = useState<EmailStep[]>([...steps]);

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...reorderedSteps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newSteps.length) {
      // Swap the steps
      [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
      
      // Update step orders
      newSteps.forEach((step, idx) => {
        step.stepOrder = idx + 1;
      });

      setReorderedSteps(newSteps);
    }
  };

  const handleSave = () => {
    onSave(reorderedSteps);
    onClose();
  };

  const handleReset = () => {
    setReorderedSteps([...steps]);
  };

  const getTotalDelay = (step: EmailStep, index: number) => {
    if (index === 0) return "Immediate";
    const totalHours = step.delayDays * 24 + step.delayHours;
    if (totalHours < 24) {
      return `${totalHours}h`;
    } else {
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] glass-dark backdrop-blur-xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <GripVertical className="w-5 h-5 text-white" />
            </div>
            Reorder Sequence Steps
          </DialogTitle>
          <p className="text-muted-foreground">
            Change the order of your email sequence steps. The first step will be sent immediately.
          </p>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {reorderedSteps.map((step, index) => (
                <motion.div
                  key={step.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="glass rounded-xl p-4 shadow-card hover-lift group"
                >
                  <div className="flex items-center gap-4">
                    {/* Step Number */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">{index + 1}</span>
                      </div>
                      
                      {/* Move Buttons */}
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={() => moveStep(index, 'up')}
                          disabled={index === 0}
                          variant="ghost"
                          size="sm"
                          className="w-6 h-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => moveStep(index, 'down')}
                          disabled={index === reorderedSteps.length - 1}
                          variant="ghost"
                          size="sm"
                          className="w-6 h-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold truncate">
                          {step.subject || 'No subject'}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {getTotalDelay(step, index)}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {truncateText(step.body || 'No content')}
                      </p>
                    </div>

                    {/* Drag Handle */}
                    <div className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 transition-opacity">
                      <GripVertical className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Delay Info */}
                  {index > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Delay:</span>
                        <Badge variant="secondary" className="text-xs">
                          {step.delayDays} days
                        </Badge>
                        {step.delayHours > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {step.delayHours} hours
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="glass rounded-xl p-4 mt-4">
          <h4 className="font-semibold mb-2">Sequence Summary</h4>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{reorderedSteps.length} steps</span>
            <span>•</span>
            <span>
              Total duration: {
                reorderedSteps.reduce((total, step, index) => {
                  if (index === 0) return 0;
                  return total + step.delayDays * 24 + step.delayHours;
                }, 0) / 24
              } days
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t border-border/60">
          <Button
            onClick={handleReset}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
          >
            Reset Order
          </Button>
          
          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="rounded-xl border-primary/20 hover:border-primary"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            
            <Button
              onClick={handleSave}
              className="gradient-primary text-white rounded-xl shadow-luxury"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReorderStepsPopup;
