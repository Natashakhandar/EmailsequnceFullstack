import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, X, Mail, Info } from "lucide-react";
import { DefaultTemplate } from "@/data/defaultTemplates";
import { Template } from "@/lib/api";

interface EditTemplatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: { name: string; subject: string; body: string }) => void;
  template?: DefaultTemplate | Template | null;
  isLoading?: boolean;
}

const EditTemplatePopup = ({
  isOpen,
  onClose,
  onSave,
  template,
  isLoading = false
}: EditTemplatePopupProps) => {
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Available tokens for email personalization
  const availableTokens = [
    { token: "{{firstName}}", description: "Contact's first name" },
    { token: "{{lastName}}", description: "Contact's last name" },
    { token: "{{fullName}}", description: "Contact's full name" },
    { token: "{{email}}", description: "Contact's email address" },
    { token: "{{company}}", description: "Contact's company name" },
    { token: "{{senderName}}", description: "Your name" },
    { token: "{{senderEmail}}", description: "Your email address" }
  ];

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        subject: template.subject,
        body: template.body
      });
    } else {
      setFormData({
        name: "",
        subject: "",
        body: ""
      });
    }
    setErrors({});
  }, [template, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Template name is required";
    }

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject line is required";
    }

    if (!formData.body.trim()) {
      newErrors.body = "Email body is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const insertToken = (token: string, field: 'subject' | 'body') => {
    const textarea = document.getElementById(field) as HTMLTextAreaElement;
    const input = document.getElementById(field) as HTMLInputElement;
    const element = textarea || input;
    
    if (element) {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      const currentValue = formData[field];
      const newValue = currentValue.substring(0, start) + token + currentValue.substring(end);
      
      setFormData(prev => ({ ...prev, [field]: newValue }));
      
      // Set cursor position after the inserted token
      setTimeout(() => {
        element.focus();
        element.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    }
  };

  const getCharCount = (text: string) => text.length;
  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] glass-dark backdrop-blur-xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            {template ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
          <p className="text-muted-foreground">
            {template ? 'Modify your email template' : 'Create a new email template for your sequences'}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {/* Template Name */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <Label htmlFor="name" className="text-sm font-medium">
                    Template Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Introduction Email"
                    className={`rounded-xl ${errors.name ? 'border-destructive' : ''}`}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </motion.div>

                {/* Subject Line */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-2"
                >
                  <Label htmlFor="subject" className="text-sm font-medium">
                    Subject Line *
                  </Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Hi {{firstName}}, let's connect!"
                    className={`rounded-xl ${errors.subject ? 'border-destructive' : ''}`}
                  />
                  {errors.subject && (
                    <p className="text-sm text-destructive">{errors.subject}</p>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{getCharCount(formData.subject)} characters</span>
                    <span className={getCharCount(formData.subject) > 50 ? 'text-amber-500' : ''}>
                      {getCharCount(formData.subject) > 50 ? 'Consider shortening for better deliverability' : 'Good length'}
                    </span>
                  </div>
                </motion.div>

                {/* Email Body */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <Label htmlFor="body" className="text-sm font-medium">
                    Email Body *
                  </Label>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                    placeholder={`Hi {{firstName}},

I hope you're doing well at {{company}}...

Best regards,
{{senderName}}`}
                    className={`rounded-xl min-h-[300px] resize-none ${errors.body ? 'border-destructive' : ''}`}
                  />
                  {errors.body && (
                    <p className="text-sm text-destructive">{errors.body}</p>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{getWordCount(formData.body)} words • {getCharCount(formData.body)} characters</span>
                    <span className={getWordCount(formData.body) > 150 ? 'text-amber-500' : 'text-green-600'}>
                      {getWordCount(formData.body) > 150 ? 'Consider shortening for better response rates' : 'Good length'}
                    </span>
                  </div>
                </motion.div>
              </div>
            </ScrollArea>
          </div>

          {/* Tokens Sidebar */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-primary" />
                <h4 className="font-semibold">Personalization Tokens</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Click any token to insert it at your cursor position
              </p>
              
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {availableTokens.map((item, index) => (
                    <motion.div
                      key={item.token}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="space-y-2"
                    >
                      <div className="flex gap-2">
                        <Button
                          onClick={() => insertToken(item.token, 'subject')}
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-lg border-primary/20 hover:border-primary flex-1"
                        >
                          Subject
                        </Button>
                        <Button
                          onClick={() => insertToken(item.token, 'body')}
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-lg border-primary/20 hover:border-primary flex-1"
                        >
                          Body
                        </Button>
                      </div>
                      <Badge variant="secondary" className="w-full justify-start text-xs">
                        {item.token}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
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
            disabled={isLoading}
            className="gradient-primary text-white rounded-xl shadow-luxury"
          >
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditTemplatePopup;
