import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Edit, Save, X, Mail } from "lucide-react";
import { defaultTemplates, DefaultTemplate } from "@/data/defaultTemplates";
import { toast } from "sonner";

interface ManageTemplatesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateUpdate: (templateId: string, updates: { subject: string; body: string }) => void;
}

const ManageTemplatesPopup = ({
  isOpen,
  onClose,
  onTemplateUpdate
}: ManageTemplatesPopupProps) => {
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editData, setEditData] = useState({ subject: "", body: "" });

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

  const startEditing = (template: DefaultTemplate) => {
    setEditingTemplate(template.id);
    setEditData({
      subject: template.subject,
      body: template.body
    });
  };

  const cancelEditing = () => {
    setEditingTemplate(null);
    setEditData({ subject: "", body: "" });
  };

  const saveChanges = (templateId: string) => {
    if (!editData.subject.trim() || !editData.body.trim()) {
      toast.error("Subject and body cannot be empty");
      return;
    }

    onTemplateUpdate(templateId, editData);
    setEditingTemplate(null);
    setEditData({ subject: "", body: "" });
    toast.success("Template updated successfully ✅");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] glass-dark backdrop-blur-xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            Manage Templates
          </DialogTitle>
          <p className="text-muted-foreground">
            Edit your default email templates. Changes will apply to new sequences.
          </p>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6">
            {defaultTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-6 shadow-card"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{template.name}</h4>
                      <Badge className={`text-xs mt-1 ${getTypeColor(template.type)}`}>
                        {template.type}
                      </Badge>
                    </div>
                  </div>
                  
                  {editingTemplate !== template.id && (
                    <Button
                      onClick={() => startEditing(template)}
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-primary/20 hover:border-primary"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-4 italic">
                  {template.description}
                </p>

                <AnimatePresence mode="wait">
                  {editingTemplate === template.id ? (
                    <motion.div
                      key="editing"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`subject-${template.id}`}>Subject Line</Label>
                        <Input
                          id={`subject-${template.id}`}
                          value={editData.subject}
                          onChange={(e) => setEditData(prev => ({ ...prev, subject: e.target.value }))}
                          className="rounded-xl"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor={`body-${template.id}`}>Email Body</Label>
                        <Textarea
                          id={`body-${template.id}`}
                          value={editData.body}
                          onChange={(e) => setEditData(prev => ({ ...prev, body: e.target.value }))}
                          className="rounded-xl min-h-[200px] resize-none"
                        />
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={cancelEditing}
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-primary/20 hover:border-primary"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          onClick={() => saveChanges(template.id)}
                          size="sm"
                          className="gradient-primary text-white rounded-xl shadow-luxury"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="viewing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Subject:</Label>
                        <div className="text-sm bg-muted/30 rounded-lg p-3 mt-1">
                          {template.subject}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Body:</Label>
                        <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 mt-1 whitespace-pre-wrap leading-relaxed">
                          {template.body}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
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

export default ManageTemplatesPopup;
