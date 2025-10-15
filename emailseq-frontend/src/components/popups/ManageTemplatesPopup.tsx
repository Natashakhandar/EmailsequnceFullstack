import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Edit, Save, X, Mail, Plus } from "lucide-react";
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
  const [editData, setEditData] = useState({ subject: "", body: "", signature: "" });
  const [showCustomTemplate, setShowCustomTemplate] = useState(false);
  const [customTemplate, setCustomTemplate] = useState({ subject: "", body: "", signature: "" });
  const [customTemplates, setCustomTemplates] = useState<DefaultTemplate[]>([]);

  // Default professional signature
  const defaultSignature = `--\nBest regards,\nArnav Sales Company\nEmpowering Businesses with ERP, SaaS & App Solutions`;

  // Helper function to extract body and signature for editing
  const extractBodyAndSignature = (fullBody: string): { body: string; signature: string } => {
    const signatureIndex = fullBody.indexOf('\n\n--\nBest regards,');
    if (signatureIndex !== -1) {
      return {
        body: fullBody.substring(0, signatureIndex),
        signature: fullBody.substring(signatureIndex + 2) // Remove the \n\n prefix
      };
    }
    return {
      body: fullBody,
      signature: defaultSignature
    };
  };

  // Helper function to combine body and signature
  const combineBodyAndSignature = (body: string, signature: string): string => {
    return body + '\n\n' + signature;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'intro':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'followup':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300';
      case 'extro':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'reminder':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'random':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'custom':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const startEditing = (template: DefaultTemplate) => {
    setEditingTemplate(template.id);
    const { body, signature } = extractBodyAndSignature(template.body);
    setEditData({
      subject: template.subject,
      body: body,
      signature: signature
    });
  };

  const cancelEditing = () => {
    setEditingTemplate(null);
    setEditData({ subject: "", body: "", signature: "" });
  };

  const saveChanges = (templateId: string) => {
    if (!editData.subject.trim() || !editData.body.trim()) {
      toast.error("Subject and body cannot be empty");
      return;
    }

    // Combine body and signature before saving
    const fullBody = combineBodyAndSignature(editData.body, editData.signature);
    onTemplateUpdate(templateId, { subject: editData.subject, body: fullBody });
    setEditingTemplate(null);
    setEditData({ subject: "", body: "", signature: "" });
    toast.success("Template updated successfully ✅");
  };

  const saveCustomTemplate = () => {
    if (!customTemplate.subject.trim() || !customTemplate.body.trim()) {
      toast.error("Subject and body cannot be empty");
      return;
    }

    const fullBody = combineBodyAndSignature(customTemplate.body, customTemplate.signature || defaultSignature);
    const newCustomTemplate: DefaultTemplate = {
      id: `custom-template-${Date.now()}`,
      name: 'Custom Template',
      subject: customTemplate.subject,
      body: fullBody,
      type: 'custom' as any,
      description: 'User-created custom template'
    };

    setCustomTemplates(prev => [...prev, newCustomTemplate]);
    setCustomTemplate({ subject: "", body: "", signature: "" });
    setShowCustomTemplate(false);
    toast.success("Custom template created successfully ✅");
  };

  const deleteCustomTemplate = (templateId: string) => {
    setCustomTemplates(prev => prev.filter(template => template.id !== templateId));
    toast.success("Custom template deleted successfully ✅");
  };

  const allTemplates = [...defaultTemplates, ...customTemplates];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl w-full max-w-[95vw] max-h-[90vh] glass-dark backdrop-blur-xl flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            Manage Templates
          </DialogTitle>
          <p className="text-muted-foreground">
            Edit your default email templates with professional signatures. Changes will apply to new sequences.
          </p>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6 pb-4">
            {/* Custom Template Creation Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-6 shadow-card border-2 border-dashed border-primary/30"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Create Custom Template</h4>
                    <Badge className="text-xs mt-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300">
                      custom
                    </Badge>
                  </div>
                </div>
                
                {!showCustomTemplate && (
                  <Button
                    onClick={() => setShowCustomTemplate(true)}
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-primary/20 hover:border-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New
                  </Button>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-4 italic">
                Create your own personalized email template with custom subject and body
              </p>

              <AnimatePresence>
                {showCustomTemplate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="custom-subject">Subject Line</Label>
                      <Input
                        id="custom-subject"
                        value={customTemplate.subject}
                        onChange={(e) => setCustomTemplate(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Enter your custom email subject..."
                        className="rounded-xl"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="custom-body">Email Body</Label>
                      <Textarea
                        id="custom-body"
                        value={customTemplate.body}
                        onChange={(e) => setCustomTemplate(prev => ({ ...prev, body: e.target.value }))}
                        placeholder="Enter your custom email content...\n\nTip: You can use {{firstName}}, {{lastName}}, {{companyName}} for personalization"
                        className="rounded-xl min-h-[200px] resize-none"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="custom-signature">Email Signature</Label>
                      <Textarea
                        id="custom-signature"
                        value={customTemplate.signature || defaultSignature}
                        onChange={(e) => setCustomTemplate(prev => ({ ...prev, signature: e.target.value }))}
                        placeholder={defaultSignature}
                        className="rounded-xl min-h-[100px] resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        📝 Professional signature that will be appended to your email
                      </p>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button
                        onClick={() => {
                          setShowCustomTemplate(false);
                          setCustomTemplate({ subject: "", body: "", signature: "" });
                        }}
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-primary/20 hover:border-primary"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={saveCustomTemplate}
                        size="sm"
                        className="gradient-primary text-white rounded-xl shadow-luxury"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Template
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Predefined and Custom Templates */}
            {allTemplates.map((template, index) => (
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
                    <div className="flex gap-2">
                      <Button
                        onClick={() => startEditing(template)}
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-primary/20 hover:border-primary"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      {template.type === 'custom' && (
                        <Button
                          onClick={() => deleteCustomTemplate(template.id)}
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-red-200 hover:border-red-400 text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
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
                      
                      <div className="space-y-2">
                        <Label htmlFor={`signature-${template.id}`}>Email Signature</Label>
                        <Textarea
                          id={`signature-${template.id}`}
                          value={editData.signature}
                          onChange={(e) => setEditData(prev => ({ ...prev, signature: e.target.value }))}
                          className="rounded-xl min-h-[100px] resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          📝 Professional signature that will be appended to your email
                        </p>
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
                        <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 mt-1 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
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
        </div>

        {/* Fixed Footer */}
        <div className="flex justify-end pt-4 border-t border-border/60 flex-shrink-0 bg-background/95 backdrop-blur-sm">
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
