import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Edit, Check, Copy } from "lucide-react";
import { DefaultTemplate } from "@/data/defaultTemplates";
import { Template } from "@/lib/api";
import { toast } from "sonner";

interface ViewFullTemplatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: DefaultTemplate | Template) => void;
  onEditTemplate: (template: DefaultTemplate | Template) => void;
  template: DefaultTemplate | Template | null;
}

const ViewFullTemplatePopup = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onEditTemplate,
  template
}: ViewFullTemplatePopupProps) => {
  if (!template) return null;

  const isDefaultTemplate = 'type' in template;

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

  const copyToClipboard = (text: string, type: 'subject' | 'body') => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${type === 'subject' ? 'Subject' : 'Email body'} copied to clipboard`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const formatEmailBody = (body: string) => {
    return body.split('\n').map((line, index) => (
      <span key={index}>
        {line}
        {index < body.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(word => word.length > 0).length;
  const getCharCount = (text: string) => text.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] glass-dark backdrop-blur-xl">
        <DialogHeader className="pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold">{template.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                {isDefaultTemplate && (
                  <Badge className={`text-xs ${getTypeColor(template.type)}`}>
                    {template.type}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {getWordCount(template.body)} words
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getCharCount(template.body)} characters
                </Badge>
              </div>
            </div>
          </div>
          
          {isDefaultTemplate && template.description && (
            <p className="text-muted-foreground italic">
              {template.description}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {/* Subject Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-lg">Subject Line</h4>
                <Button
                  onClick={() => copyToClipboard(template.subject, 'subject')}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm font-medium">
                  {template.subject}
                </p>
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{getCharCount(template.subject)} characters</span>
                <span className={getCharCount(template.subject) > 50 ? 'text-amber-500' : 'text-green-600'}>
                  {getCharCount(template.subject) > 50 ? 'Long subject line' : 'Good length'}
                </span>
              </div>
            </motion.div>

            {/* Email Body Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-lg">Email Body</h4>
                <Button
                  onClick={() => copyToClipboard(template.body, 'body')}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {formatEmailBody(template.body)}
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{getWordCount(template.body)} words • {getCharCount(template.body)} characters</span>
                <span className={getWordCount(template.body) > 150 ? 'text-amber-500' : 'text-green-600'}>
                  {getWordCount(template.body) > 150 ? 'Long email' : 'Good length'}
                </span>
              </div>
            </motion.div>

            {/* Personalization Tokens Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-xl p-4"
            >
              <h4 className="font-semibold text-lg mb-3">Personalization Tokens</h4>
              
              <div className="space-y-2">
                {[
                  { token: '{{firstName}}', description: 'Contact\'s first name' },
                  { token: '{{lastName}}', description: 'Contact\'s last name' },
                  { token: '{{company}}', description: 'Contact\'s company name' },
                  { token: '{{senderName}}', description: 'Your name' }
                ].map((item) => {
                  const isUsed = template.subject.includes(item.token) || template.body.includes(item.token);
                  return (
                    <div
                      key={item.token}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        isUsed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={isUsed ? 'default' : 'secondary'} className="text-xs">
                          {item.token}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {item.description}
                        </span>
                      </div>
                      {isUsed && (
                        <Badge variant="outline" className="text-xs text-green-600">
                          Used
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t border-border/60">
          <Button
            onClick={onClose}
            variant="outline"
            className="rounded-xl border-primary/20 hover:border-primary"
          >
            Close
          </Button>
          
          <div className="flex gap-2">
            <Button
              onClick={() => onEditTemplate(template)}
              variant="outline"
              className="rounded-xl border-primary/20 hover:border-primary"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Template
            </Button>
            
            <Button
              onClick={() => onSelectTemplate(template)}
              className="gradient-primary text-white rounded-xl shadow-luxury"
            >
              <Check className="w-4 h-4 mr-2" />
              Use This Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewFullTemplatePopup;
