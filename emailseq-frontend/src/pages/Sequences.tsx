import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Mail, Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { api, Template, Sequence } from "@/lib/api";
import { ManageTemplatesPopup } from "@/components/popups";
import { DefaultTemplate, defaultTemplates } from "@/data/defaultTemplates";

interface EmailStep {
  id: string;
  templateId: string;
  subject: string;
  body: string;
  stepOrder: number;
  delayDays: number;
  delayHours: number;
}

const Sequences = () => {
  const [steps, setSteps] = useState<EmailStep[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [localDefaultTemplates, setLocalDefaultTemplates] = useState(defaultTemplates);
  const [sequenceName, setSequenceName] = useState("");
  const [sequenceDescription, setSequenceDescription] = useState("");
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    subject: "",
    body: ""
  });

  // Load templates and sequences on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesResponse, sequencesResponse] = await Promise.all([
        api.getTemplates({ limit: 100 }),
        api.getSequences({ limit: 50 })
      ]);
      setTemplates(templatesResponse.templates);
      setSequences(sequencesResponse.sequences);
    } catch (error) {
      toast.error("Failed to load data");
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    if (steps.length >= 5) {
      toast.error("Maximum 5 steps allowed");
      return;
    }

    const newStep: EmailStep = {
      id: Date.now().toString(),
      templateId: "",
      subject: "",
      body: "",
      stepOrder: steps.length + 1,
      delayDays: steps.length === 0 ? 0 : 2,
      delayHours: 0,
    };

    setSteps([...steps, newStep]);
    toast.success("Step added successfully");
  };

  const removeStep = (id: string) => {
    if (steps.length === 1) {
      toast.error("At least one step is required");
      return;
    }
    const updatedSteps = steps.filter((step) => step.id !== id);
    // Reorder step numbers
    const reorderedSteps = updatedSteps.map((step, index) => ({
      ...step,
      stepOrder: index + 1
    }));
    setSteps(reorderedSteps);
    toast.success("Step removed");
  };

  const updateStep = (id: string, field: keyof EmailStep, value: string | number) => {
    setSteps(
      steps.map((step) => {
        if (step.id === id) {
          if (field === 'templateId') {
            // Find template in both custom templates and default templates
            const customTemplate = templates.find(t => t.id === String(value));
            const defaultTemplate = localDefaultTemplates.find(t => t.id === String(value));
            const selectedTemplate = customTemplate || defaultTemplate;
            
            return {
              ...step,
              [field]: String(value),
              subject: selectedTemplate?.subject || step.subject,
              body: selectedTemplate?.body || step.body
            };
          }
          return { ...step, [field]: value };
        }
        return step;
      })
    );
  };

  // Template management handlers
  const handleTemplateUpdate = (templateId: string, updates: { subject: string; body: string }) => {
    setLocalDefaultTemplates(prev => 
      prev.map(template => 
        template.id === templateId 
          ? { ...template, ...updates }
          : template
      )
    );
    
    // Update any existing steps that use this template
    setSteps(prev => 
      prev.map(step => 
        step.templateId === templateId 
          ? { ...step, subject: updates.subject, body: updates.body }
          : step
      )
    );
  };

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.body) {
      toast.error("Please fill in all template fields");
      return;
    }

    try {
      const template = await api.createTemplate({
        name: newTemplate.name,
        subject: newTemplate.subject,
        body: newTemplate.body,
        isActive: true
      });
      
      setTemplates([template, ...templates]);
      setIsTemplateDialogOpen(false);
      setNewTemplate({ name: "", subject: "", body: "" });
      toast.success("Template created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create template");
    }
  };

  const saveSequence = async () => {
    if (!sequenceName.trim()) {
      toast.error("Please enter a sequence name");
      return;
    }

    if (steps.length === 0) {
      toast.error("Please add at least one step");
      return;
    }

    // Validate that all steps have content
    const invalidSteps = steps.filter(step => !step.subject.trim() || !step.body.trim());
    if (invalidSteps.length > 0) {
      toast.error("Please add subject and body content for all steps");
      return;
    }

    try {
      // For steps using default templates, create custom templates first
      const processedSteps = [];
      
      for (const step of steps) {
        let templateId = step.templateId;
        
        // If using a default template or no template, create a custom one
        if (!templateId || localDefaultTemplates.find(t => t.id === templateId)) {
          const customTemplate = await api.createTemplate({
            name: `${sequenceName} - Step ${step.stepOrder}`,
            subject: step.subject,
            body: step.body,
            isActive: true
          });
          templateId = customTemplate.id;
        }
        
        processedSteps.push({
          templateId,
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          isActive: true
        });
      }

      const sequence = await api.createSequence({
        name: sequenceName,
        description: sequenceDescription || undefined,
        steps: processedSteps
      });

      setSequences([sequence, ...sequences]);
      setSteps([]);
      setSequenceName("");
      setSequenceDescription("");
      toast.success("Sequence Saved Successfully ✅");
      
      // Reload templates to include newly created ones
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to save sequence");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />

      <main className="container mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Email Sequences</h1>
              <p className="text-muted-foreground">
                Create automated email sequences with up to 5 steps
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setIsManageTemplatesOpen(true)}
                variant="outline"
                className="rounded-xl border-primary/20 hover:border-primary"
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage Templates
              </Button>
              
              <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-xl border-primary/20 hover:border-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Email Template</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="templateName">Template Name *</Label>
                    <Input
                      id="templateName"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      placeholder="e.g., Introduction Email"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="templateSubject">Subject Line *</Label>
                    <Input
                      id="templateSubject"
                      value={newTemplate.subject}
                      onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                      placeholder="Hi {{firstName}}, let's connect!"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="templateBody">Email Body *</Label>
                    <Textarea
                      id="templateBody"
                      value={newTemplate.body}
                      onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                      placeholder="Hi {{firstName}},&#10;&#10;I hope you're doing well at {{company}}...&#10;&#10;Best regards,&#10;Your Name"
                      className="rounded-xl min-h-[150px] resize-none"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Available tokens:</p>
                    <p>{`{{firstName}}, {{lastName}}, {{email}}, {{company}}, {{fullName}}`}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsTemplateDialogOpen(false)}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createTemplate}
                    className="gradient-primary text-white rounded-xl"
                  >
                    Create Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Sequence Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 shadow-card hover-lift mb-6"
        >
          <h3 className="text-xl font-semibold mb-4">Sequence Configuration</h3>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sequenceName">Sequence Name *</Label>
              <Input
                id="sequenceName"
                value={sequenceName}
                onChange={(e) => setSequenceName(e.target.value)}
                placeholder="e.g., Outreach Sequence"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sequenceDescription">Description (Optional)</Label>
              <Textarea
                id="sequenceDescription"
                value={sequenceDescription}
                onChange={(e) => setSequenceDescription(e.target.value)}
                placeholder="Brief description of this sequence..."
                className="rounded-xl resize-none"
                rows={2}
              />
            </div>
          </div>
        </motion.div>

        {/* Sequence Steps */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading templates...</span>
              </div>
            ) : (
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="glass rounded-2xl p-6 shadow-card hover-lift"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                        <Mail className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold">Step {index + 1}</h3>
                    </div>
                    {steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStep(step.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Template Selection */}
                    <div className="space-y-2">
                      <Label htmlFor={`template-${step.id}`}>Email Template</Label>
                      <Select
                        value={step.templateId}
                        onValueChange={(value) => updateStep(step.id, "templateId", value)}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          <optgroup label="Default Templates">
                            {localDefaultTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </optgroup>
                          {templates.length > 0 && (
                            <optgroup label="Custom Templates">
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </optgroup>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Editable Template Content */}
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ 
                        opacity: step.subject || step.body ? 1 : 0.7, 
                        height: "auto" 
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`subject-${step.id}`}>Subject Line</Label>
                        <Input
                          id={`subject-${step.id}`}
                          value={step.subject}
                          onChange={(e) => updateStep(step.id, "subject", e.target.value)}
                          placeholder="Enter email subject..."
                          className="rounded-xl"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor={`body-${step.id}`}>Email Body</Label>
                        <Textarea
                          id={`body-${step.id}`}
                          value={step.body}
                          onChange={(e) => updateStep(step.id, "body", e.target.value)}
                          placeholder="Enter email content..."
                          className="rounded-xl min-h-[150px] resize-none"
                        />
                      </div>
                    </motion.div>

                    {/* Delay Settings */}
                    {index > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`delayDays-${step.id}`}>Delay (days)</Label>
                          <Input
                            id={`delayDays-${step.id}`}
                            type="number"
                            min="0"
                            max="30"
                            value={step.delayDays}
                            onChange={(e) => updateStep(step.id, "delayDays", parseInt(e.target.value) || 0)}
                            className="rounded-xl"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`delayHours-${step.id}`}>Additional Hours</Label>
                          <Input
                            id={`delayHours-${step.id}`}
                            type="number"
                            min="0"
                            max="23"
                            value={step.delayHours}
                            onChange={(e) => updateStep(step.id, "delayHours", parseInt(e.target.value) || 0)}
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    )}

                    {index === 0 && (
                      <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                        <strong>First Step:</strong> This email will be sent immediately when a contact is enrolled in the sequence.
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
                </AnimatePresence>
              </div>
            )}

            {/* Action Buttons */}
            {!loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8 flex gap-4 flex-wrap"
              >
            <Button
              onClick={addStep}
              disabled={steps.length >= 5}
              variant="outline"
              className="rounded-xl border-primary/20 hover:border-primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Step {steps.length < 5 && `(${5 - steps.length} remaining)`}
            </Button>


            <Button
              onClick={saveSequence}
              disabled={!sequenceName.trim() || steps.length === 0}
              className="gradient-primary text-white rounded-xl shadow-luxury hover:shadow-hover transition-all duration-300 hover:scale-105"
            >
              <Save className="w-5 h-5 mr-2" />
              Save Sequence
            </Button>

            {steps.length > 0 && (
              <Button
                onClick={() => {
                  setSteps([]);
                  setSequenceName("");
                  setSequenceDescription("");
                }}
                variant="ghost"
                className="rounded-xl text-muted-foreground hover:text-foreground"
              >
                Clear All
              </Button>
            )}
              </motion.div>
            )}

        {/* Existing Sequences */}
        {!loading && sequences.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12"
          >
            <h3 className="text-2xl font-semibold mb-6">Existing Sequences</h3>
            <div className="grid gap-4">
              {sequences.map((sequence) => (
                <div
                  key={sequence.id}
                  className="glass rounded-xl p-4 shadow-card hover-lift"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">{sequence.name}</h4>
                      {sequence.description && (
                        <p className="text-muted-foreground text-sm mt-1">
                          {sequence.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{sequence.steps?.length || 0} steps</span>
                        <span>•</span>
                        <span>Created {new Date(sequence.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className={sequence.isActive ? "text-green-600" : "text-red-600"}>
                          {sequence.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Manage Templates Popup */}
        <ManageTemplatesPopup
          isOpen={isManageTemplatesOpen}
          onClose={() => setIsManageTemplatesOpen(false)}
          onTemplateUpdate={handleTemplateUpdate}
        />
      </main>
    </div>
  );
};

export default Sequences;
