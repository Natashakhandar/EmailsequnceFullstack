import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Settings, Edit, Save, X, Mail } from "lucide-react";
import { defaultTemplates, DefaultTemplate } from "@/data/defaultTemplates";
import { api, Template } from "@/lib/api";
import { toast } from "sonner";

interface SimpleEditTemplatesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateUpdate: (templateId: string, updates: { subject: string; body: string }) => void;
}

const SimpleEditTemplatesPopup = ({
  isOpen,
  onClose,
  onTemplateUpdate
}: SimpleEditTemplatesPopupProps) => {
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editData, setEditData] = useState({ subject: "", body: "", signature: "" });
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Default professional signature
  const defaultSignature = `--\nBest regards,\nArnav Sales Company\nEmpowering Businesses with ERP, SaaS & App Solutions`;

  // Fetch custom templates from API
  const fetchCustomTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await api.getTemplates();
      setCustomTemplates(response.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load custom templates');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Load templates when popup opens
  useEffect(() => {
    if (isOpen) {
      fetchCustomTemplates();
    }
  }, [isOpen]);

  // Helper function to extract body and signature for editing
  const extractBodyAndSignature = (fullBody: string): { body: string; signature: string } => {
    const signatureIndex = fullBody.indexOf('\n\n--\nBest regards,');
    if (signatureIndex !== -1) {
      return {
        body: fullBody.substring(0, signatureIndex),
        signature: fullBody.substring(signatureIndex + 2)
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
        return 'bg-blue-100 text-blue-800';
      case 'followup':
        return 'bg-amber-100 text-amber-800';
      case 'extro':
        return 'bg-red-100 text-red-800';
      case 'reminder':
        return 'bg-purple-100 text-purple-800';
      case 'random':
        return 'bg-green-100 text-green-800';
      case 'custom':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const startEditing = (template: DefaultTemplate | Template) => {
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

  const saveChanges = async (templateId: string) => {
    if (!editData.subject.trim() || !editData.body.trim()) {
      toast.error("Subject and body cannot be empty");
      return;
    }

    try {
      // Combine body and signature before saving
      const fullBody = combineBodyAndSignature(editData.body, editData.signature);
      const updates = { subject: editData.subject, body: fullBody };
      
      // Check if this is a custom template (from API)
      const isCustomTemplate = customTemplates.some(t => t.id === templateId);
      
      if (isCustomTemplate) {
        // Update custom template via API
        await api.updateTemplate(templateId, updates);
        await fetchCustomTemplates(); // Refresh custom templates
        toast.success("Custom template updated successfully ✅");
      } else {
        // Handle default template update
        onTemplateUpdate(templateId, updates);
        toast.success("Default template updated successfully ✅");
      }
      
      setEditingTemplate(null);
      setEditData({ subject: "", body: "", signature: "" });
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  // Combine default and custom templates
  const allTemplates = [
    ...defaultTemplates.map(t => ({ ...t, isDefault: true })),
    ...customTemplates.map(t => ({ ...t, isDefault: false, type: 'custom' }))
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl w-full max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            Manage Templates
          </DialogTitle>
          <p className="text-muted-foreground">
            Edit your email templates with professional signatures. Changes will apply to new sequences.
          </p>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6 pb-4">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading templates...</p>
                  </div>
                </div>
              ) : (
                allTemplates.map((template) => (
                  <div key={template.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{template.name}</h4>
                          <Badge className={`text-xs mt-1 ${getTypeColor(template.type)}`}>
                            {template.isDefault ? template.type : 'custom'}
                          </Badge>
                        </div>
                      </div>
                      
                      {editingTemplate !== template.id && (
                        <Button
                          onClick={() => startEditing(template)}
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-blue-200 hover:border-blue-400"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>

                    {editingTemplate === template.id ? (
                      <div className="space-y-4">
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
                            placeholder="Enter your email content...\n\nTip: You can use {{firstName}}, {{lastName}}, {{companyName}} for personalization"
                            className="rounded-xl min-h-[200px] resize-none"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor={`signature-${template.id}`}>Email Signature</Label>
                          <Textarea
                            id={`signature-${template.id}`}
                            value={editData.signature}
                            onChange={(e) => setEditData(prev => ({ ...prev, signature: e.target.value }))}
                            placeholder={defaultSignature}
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
                            className="rounded-xl border-gray-200 hover:border-gray-400"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            onClick={() => saveChanges(template.id)}
                            size="sm"
                            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl shadow-lg"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Subject:</Label>
                          <div className="text-sm bg-gray-50 rounded-lg p-3 mt-1">
                            {template.subject}
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Body:</Label>
                          <div className="text-sm text-muted-foreground bg-gray-50 rounded-lg p-3 mt-1 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                            {template.body}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Fixed Footer */}
        <div className="flex justify-end pt-4 border-t border-gray-200 flex-shrink-0 bg-white">
          <Button
            onClick={onClose}
            variant="outline"
            className="rounded-xl border-gray-200 hover:border-gray-400"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleEditTemplatesPopup;
