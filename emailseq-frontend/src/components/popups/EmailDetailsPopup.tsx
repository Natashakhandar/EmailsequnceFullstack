import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, User, Calendar, Activity, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Event } from "@/lib/api";

interface EmailDetailsPopupProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

const EmailDetailsPopup = ({ event, isOpen, onClose }: EmailDetailsPopupProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const getStatusBadge = (type: string) => {
    const statusConfig = {
      SENT: { variant: "default" as const, color: "bg-blue-100 text-blue-800" },
      DELIVERED: { variant: "default" as const, color: "bg-green-100 text-green-800" },
      OPENED: { variant: "default" as const, color: "bg-purple-100 text-purple-800" },
      CLICKED: { variant: "default" as const, color: "bg-indigo-100 text-indigo-800" },
      REPLIED: { variant: "default" as const, color: "bg-emerald-100 text-emerald-800" },
      BOUNCED: { variant: "destructive" as const, color: "bg-red-100 text-red-800" },
      FAILED: { variant: "destructive" as const, color: "bg-red-100 text-red-800" },
      UNSUBSCRIBED: { variant: "secondary" as const, color: "bg-gray-100 text-gray-800" }
    };

    const config = statusConfig[type as keyof typeof statusConfig] || statusConfig.SENT;
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {type}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getContactName = () => {
    const contact = event.contact;
    if (!contact) return 'Unknown Contact';
    return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
  };

  const getEmailContent = () => {
    // Try to get email content from event details
    if (event.details) {
      try {
        const details = JSON.parse(event.details);
        return {
          subject: details.subject || 'Email Subject',
          body: details.body || details.content || 'Email content not available'
        };
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Fallback to sequence step template
    const sequence = event.enrollment?.sequence;
    if (sequence?.steps && sequence.steps.length > 0) {
      const currentStep = sequence.steps.find(step => 
        step.stepOrder === event.enrollment?.currentStep
      );
      if (currentStep?.template) {
        return {
          subject: currentStep.template.subject,
          body: currentStep.template.body
        };
      }
    }
    
    return {
      subject: 'Email Subject',
      body: 'Email content not available'
    };
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const emailContent = getEmailContent();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    Email Details
                  </CardTitle>
                  <CardDescription>
                    Detailed information about this email activity
                  </CardDescription>
                </div>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  {/* Event Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Contact Information
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="font-medium text-gray-900">{getContactName()}</div>
                          <div className="text-sm text-gray-600">{event.contact?.email}</div>
                          {event.contact?.company && (
                            <div className="text-sm text-gray-600">{event.contact.company}</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Event Status
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(event.type)}
                          </div>
                          <div className="text-sm text-gray-600">
                            Event ID: {event.id}
                          </div>
                          {event.emailId && (
                            <div className="text-sm text-gray-600">
                              Email ID: {event.emailId}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Sequence Information
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="font-medium text-gray-900">
                            {event.enrollment?.sequence?.name || 'Unknown Sequence'}
                          </div>
                          <div className="text-sm text-gray-600">
                            Step {event.enrollment?.currentStep || 1} of{' '}
                            {event.enrollment?.sequence?.steps?.length || 1}
                          </div>
                          <div className="text-sm text-gray-600">
                            Status: {event.enrollment?.status || 'Unknown'}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Timing Information
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="text-sm text-gray-600">
                            <div>Event Time: {formatDate(event.timestamp)}</div>
                            {event.enrollment?.startedAt && (
                              <div>Sequence Started: {formatDate(event.enrollment.startedAt)}</div>
                            )}
                            {event.enrollment?.nextSendAt && (
                              <div>Next Send: {formatDate(event.enrollment.nextSendAt)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Email Content */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Email Content</h3>
                      <Button
                        onClick={() => copyToClipboard(`Subject: ${emailContent.subject}\n\n${emailContent.body}`)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {copied ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {copied ? 'Copied!' : 'Copy Content'}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Subject:</Label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg border">
                          <p className="text-gray-900">{emailContent.subject}</p>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-gray-700">Body:</Label>
                        <div className="mt-1 p-4 bg-gray-50 rounded-lg border max-h-64 overflow-y-auto">
                          <div className="whitespace-pre-wrap text-gray-900">
                            {emailContent.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Details */}
                  {event.details && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Details</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <pre className="text-sm text-gray-600 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(JSON.parse(event.details), null, 2)}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <label className={`block text-sm font-medium text-gray-700 ${className}`}>
    {children}
  </label>
);

export default EmailDetailsPopup;
