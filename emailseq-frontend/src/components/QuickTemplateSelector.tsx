import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Zap } from "lucide-react";
import { defaultTemplates, DefaultTemplate, truncateText } from "@/data/defaultTemplates";

interface QuickTemplateSelectorProps {
  onSelectTemplate: (template: DefaultTemplate) => void;
  className?: string;
}

const QuickTemplateSelector = ({ onSelectTemplate, className = "" }: QuickTemplateSelectorProps) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'intro':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'followup':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300';
      case 'final':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm">Quick Templates</h4>
      </div>
      
      <div className="grid gap-3">
        {defaultTemplates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass rounded-lg p-3 hover-lift cursor-pointer group"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="font-medium text-sm truncate">{template.name}</h5>
                  <Badge className={`text-xs ${getTypeColor(template.type)}`}>
                    {template.type}
                  </Badge>
                </div>
                
                <p className="text-xs text-muted-foreground mb-2">
                  {template.subject}
                </p>
                
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {truncateText(template.body, 80)}
                </p>
              </div>
            </div>
            
            <div className="mt-3 pt-2 border-t border-border/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                className="w-full gradient-primary text-white rounded-lg text-xs"
              >
                Use Template
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default QuickTemplateSelector;
