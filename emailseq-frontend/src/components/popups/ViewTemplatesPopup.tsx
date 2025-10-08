import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Eye, Edit, Check } from "lucide-react";
import { defaultTemplates, DefaultTemplate, truncateText } from "@/data/defaultTemplates";
import { Template } from "@/lib/api";

interface ViewTemplatesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: DefaultTemplate | Template) => void;
  onEditTemplate: (template: DefaultTemplate | Template) => void;
  onViewTemplate: (template: DefaultTemplate | Template) => void;
  customTemplates?: Template[];
}

const ViewTemplatesPopup = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onEditTemplate,
  onViewTemplate,
  customTemplates = []
}: ViewTemplatesPopupProps) => {
  const [selectedTab, setSelectedTab] = useState<'default' | 'custom'>('default');

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

  const TemplateCard = ({ template, isDefault = true }: { template: DefaultTemplate | Template; isDefault?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass rounded-xl p-4 shadow-card hover-lift group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-lg">{template.name}</h4>
            {isDefault && 'type' in template && (
              <Badge className={`text-xs mt-1 ${getTypeColor(template.type)}`}>
                {template.type}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Subject:</p>
          <p className="text-sm bg-muted/30 rounded-lg p-2">
            {template.subject}
          </p>
        </div>
        
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Preview:</p>
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-2 leading-relaxed">
            {truncateText(template.body, 150)}
          </p>
        </div>

        {isDefault && 'description' in template && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Description:</p>
            <p className="text-xs text-muted-foreground italic">
              {template.description}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onSelectTemplate(template)}
          className="flex-1 gradient-primary text-white rounded-xl shadow-luxury"
          size="sm"
        >
          <Check className="w-4 h-4 mr-2" />
          Use Template
        </Button>
        
        <Button
          onClick={() => onViewTemplate(template)}
          variant="outline"
          size="sm"
          className="rounded-xl border-primary/20 hover:border-primary"
        >
          <Eye className="w-4 h-4" />
        </Button>
        
        <Button
          onClick={() => onEditTemplate(template)}
          variant="outline"
          size="sm"
          className="rounded-xl border-primary/20 hover:border-primary"
        >
          <Edit className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] glass-dark backdrop-blur-xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold">Email Templates</DialogTitle>
          <p className="text-muted-foreground">
            Choose from our curated templates or use your custom ones
          </p>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setSelectedTab('default')}
            variant={selectedTab === 'default' ? 'default' : 'outline'}
            className={`rounded-xl ${
              selectedTab === 'default' 
                ? 'gradient-primary text-white shadow-luxury' 
                : 'border-primary/20 hover:border-primary'
            }`}
          >
            Default Templates ({defaultTemplates.length})
          </Button>
          <Button
            onClick={() => setSelectedTab('custom')}
            variant={selectedTab === 'custom' ? 'default' : 'outline'}
            className={`rounded-xl ${
              selectedTab === 'custom' 
                ? 'gradient-primary text-white shadow-luxury' 
                : 'border-primary/20 hover:border-primary'
            }`}
          >
            Custom Templates ({customTemplates.length})
          </Button>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          <AnimatePresence mode="wait">
            {selectedTab === 'default' ? (
              <motion.div
                key="default"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid gap-4"
              >
                {defaultTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} isDefault={true} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="custom"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid gap-4"
              >
                {customTemplates.length > 0 ? (
                  customTemplates.map((template) => (
                    <TemplateCard key={template.id} template={template} isDefault={false} />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Mail className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Custom Templates</h3>
                    <p className="text-muted-foreground mb-4">
                      You haven't created any custom templates yet.
                    </p>
                    <Button
                      onClick={onClose}
                      variant="outline"
                      className="rounded-xl border-primary/20 hover:border-primary"
                    >
                      Create Your First Template
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t border-border/60">
          <Button
            onClick={onClose}
            variant="outline"
            className="rounded-xl border-primary/20 hover:border-primary"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewTemplatesPopup;
