import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { defaultTemplates, DefaultTemplate } from "@/data/defaultTemplates";
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
  const [editData, setEditData] = useState({ subject: "", body: "" });

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
    toast.success("Template updated successfully");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Edit Templates</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {defaultTemplates.map((template) => (
              <div key={template.id} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{template.name}</h4>
                  {editingTemplate !== template.id && (
                    <Button
                      onClick={() => startEditing(template)}
                      variant="outline"
                      size="sm"
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {editingTemplate === template.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`subject-${template.id}`}>Subject</Label>
                      <Input
                        id={`subject-${template.id}`}
                        value={editData.subject}
                        onChange={(e) => setEditData(prev => ({ ...prev, subject: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`body-${template.id}`}>Body</Label>
                      <Textarea
                        id={`body-${template.id}`}
                        value={editData.body}
                        onChange={(e) => setEditData(prev => ({ ...prev, body: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => saveChanges(template.id)}
                        size="sm"
                      >
                        Save Changes
                      </Button>
                      <Button
                        onClick={cancelEditing}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-sm text-gray-600">Subject:</Label>
                      <p className="text-sm">{template.subject}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-gray-600">Body:</Label>
                      <p className="text-sm">{template.body}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleEditTemplatesPopup;
