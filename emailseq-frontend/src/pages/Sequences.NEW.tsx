import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Mail, Clock, Edit3, Save, ChevronDown, Loader2, ChevronLeft, ChevronRight, Settings, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import { api, Template, Sequence, SequenceStep } from '@/lib/api';
import SimpleEditTemplatesPopup from '@/components/popups/SimpleEditTemplatesPopup';
import { defaultTemplates } from '@/data/defaultTemplates';

// TypeScript interfaces for local state
interface EmailStep {
  id: string;
  subject: string;
  body: string;
  templateId?: string | null;
  delayDays: number;
  delayHours: number;
  triggerType: 'delay' | 'opened' | 'not_opened' | 'replied' | 'skip';
  notOpenedDelayHours?: number;
  triggerStepId?: string | null; // Which step acts as trigger
  skipTrigger?: boolean;
  stepOrder: number;
}


// Animation variants for consistent motion
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const slideInLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 }
};

const buttonHover = {
  scale: 1.02,
  transition: { type: "spring" as const, stiffness: 400, damping: 25 }
};

const buttonTap = {
  scale: 0.98,
  transition: { type: "spring" as const, stiffness: 400, damping: 25 }
};

const SequencesNew: React.FC = () => {
  // React states
  const [sequenceName, setSequenceName] = useState<string>('');
  const [sequenceDescription, setSequenceDescription] = useState<string>('');
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const [steps, setSteps] = useState<EmailStep[]>([
    {
      id: '1',
      subject: 'Welcome Email',
      body: 'Hello! This is the first email in our sequence.',
      templateId: null,
      delayDays: 0,
      delayHours: 0,
      triggerType: 'delay',
      skipTrigger: false,
      stepOrder: 1
    }
  ]);
  const [selectedStep, setSelectedStep] = useState<string>('1');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(true);
  const [isLoadingSequences, setIsLoadingSequences] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState<boolean>(false);
  const [backendStepIdMap, setBackendStepIdMap] = useState<Map<string, string>>(new Map()); // frontend ID -> backend ID

  // Fetch templates and sequences from API
  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([fetchTemplates(), fetchSequences()]);
    };
    fetchData();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await api.getTemplates({ isActive: true });
      setTemplates(response.templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const fetchSequences = async () => {
    try {
      setIsLoadingSequences(true);
      const response = await api.getSequences();
      setSequences(response.sequences);
    } catch (error) {
      console.error('Error fetching sequences:', error);
      toast.error('Failed to load sequences');
      setSequences([]);
    } finally {
      setIsLoadingSequences(false);
    }
  };

  // Add email tracking pixel to email body
  const addEmailTracking = (body: string, emailId: string): string => {
    const trackingPixel = `<img src="/api/track-open?emailId=${emailId}" width="1" height="1" style="display:none;" />`;
    
    // Check if tracking pixel already exists
    if (body.includes('/api/track-open')) {
      return body;
    }
    
    // Add tracking pixel at the end of the email
    return body + '\n\n' + trackingPixel;
  };

  // Remove tracking pixel from email body (for editing)
  const removeEmailTracking = (body: string): string => {
    return body.replace(/<img[^>]*\/api\/track-open[^>]*>/gi, '').trim();
  };

  // Logic functions
  const addNewStep = () => {
    const newStepId = Date.now().toString();
    const newStep: EmailStep = {
      id: newStepId,
      subject: `Email Step ${steps.length + 1}`,
      body: '',
      templateId: null,
      delayDays: steps.length === 0 ? 0 : 1, // First step immediate, others 1 day delay
      delayHours: 0,
      triggerType: 'delay',
      skipTrigger: false,
      stepOrder: steps.length + 1
    };
    
    setSteps(prevSteps => [...prevSteps, newStep]);
    setSelectedStep(newStepId); // Automatically select the new step
  };

  const deleteStep = (stepId: string) => {
    // Prevent deleting if only one step remains
    if (steps.length <= 1) {
      return;
    }

    setSteps(prevSteps => {
      const updatedSteps = prevSteps.filter(step => step.id !== stepId);
      
      // If deleted step was selected, select the first remaining step
      if (selectedStep === stepId && updatedSteps.length > 0) {
        setSelectedStep(updatedSteps[0].id);
      }
      
      return updatedSteps;
    });
  };

  const updateStep = (stepId: string, field: keyof EmailStep, value: string | number | boolean) => {
    setSteps(prevSteps => 
      prevSteps.map(step => {
        if (step.id === stepId) {
          // Prevent empty subjects
          if (field === 'subject' && typeof value === 'string' && value.trim() === '') {
            return step; // Don't update if subject would be empty
          }
          
          return {
            ...step,
            [field]: value
          };
        }
        return step;
      })
    );
  };

  // Add signature/footer to email body if not present
  const addSignatureToBody = (body: string): string => {
    const defaultSignature = `\n\n--\nBest regards,\nArnav Sales Company\nEmpowering Businesses with ERP, SaaS & App Solutions`;
    
    // Check if signature already exists
    if (body.includes('--\nBest regards,')) {
      return body;
    }
    
    return body + defaultSignature;
  };

  // Action bar functions
  const saveSequence = async () => {
    try {
      setIsSaving(true);
      
      // Comprehensive validation
      if (!sequenceName.trim()) {
        toast.error('Please enter a sequence name');
        return;
      }
      
      if (steps.length === 0) {
        toast.error('Please add at least one email step');
        return;
      }

      // Validate each step
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Every step must have stepOrder
        if (!step.stepOrder || step.stepOrder < 1) {
          toast.error(`Step ${i + 1} is missing a valid step order`);
          return;
        }
        
        // Either subject/body or templateId must be provided
        const hasContent = (step.subject && step.subject.trim()) || (step.body && step.body.trim());
        const hasTemplate = step.templateId && step.templateId.trim();
        
        if (!hasContent && !hasTemplate) {
          toast.error(`Step ${step.stepOrder} must have either content (subject/body) or a template selected`);
          return;
        }
        
        // If using trigger types other than delay, triggerStepId must reference a previous step
        if (step.triggerType !== 'delay' && step.triggerType !== 'skip') {
          if (!step.triggerStepId) {
            toast.error(`Step ${step.stepOrder} with trigger type '${step.triggerType}' must reference a trigger step`);
            return;
          }
          
          // Validate triggerStepId references an existing previous step
          const triggerStep = steps.find(s => s.id === step.triggerStepId);
          if (!triggerStep) {
            toast.error(`Step ${step.stepOrder} references an invalid trigger step`);
            return;
          }
          
          if (triggerStep.stepOrder >= step.stepOrder) {
            toast.error(`Step ${step.stepOrder} can only be triggered by previous steps`);
            return;
          }
        }
      }
      
      // Prepare sequence data for API with enhanced backend schema
      const sequenceData = {
        name: sequenceName.trim(),
        description: sequenceDescription.trim() || undefined,
        steps: steps.map((step) => {
          // Determine final trigger type
          let finalTriggerType = step.triggerType;
          if (step.skipTrigger) {
            finalTriggerType = 'skip';
          }
          
          // Resolve triggerStepId: convert frontend step ID to backend step ID if editing existing sequence
          let resolvedTriggerStepId = null;
          if (finalTriggerType !== 'delay' && finalTriggerType !== 'skip' && step.triggerStepId) {
            if (editingSequenceId && backendStepIdMap.has(step.triggerStepId)) {
              // For existing sequences, use the backend step ID
              resolvedTriggerStepId = backendStepIdMap.get(step.triggerStepId);
            } else {
              // For new sequences, backend will resolve by step order
              // Find the target step and use its step order for reference
              const targetStep = steps.find(s => s.id === step.triggerStepId);
              if (targetStep) {
                resolvedTriggerStepId = `step-order-${targetStep.stepOrder}`; // Backend will resolve this
              }
            }
          }
          
          // Prepare step data
          const stepData: any = {
            stepOrder: step.stepOrder,
            triggerType: finalTriggerType,
            triggerStepId: resolvedTriggerStepId,
            delayDays: step.delayDays || 0,
            delayHours: step.delayHours || 0,
            templateId: step.templateId || null
          };
          
          // Add subject and body if not using a template or if content exists
          if (!step.templateId || step.subject || step.body) {
            if (step.subject && step.subject.trim()) {
              stepData.subject = step.subject.trim();
            }
            if (step.body && step.body.trim()) {
              // Add signature and tracking pixel to body
              let finalBody = addSignatureToBody(step.body.trim());
              stepData.body = addEmailTracking(finalBody, `${Date.now()}-${step.stepOrder}`);
            }
          }
          
          return stepData;
        })
      };
      
      console.log('Saving sequence with trigger step mapping:', {
        frontendSteps: steps.map(s => ({ id: s.id, stepOrder: s.stepOrder, triggerStepId: s.triggerStepId, triggerType: s.triggerType })),
        payloadSteps: sequenceData.steps.map(s => ({ stepOrder: s.stepOrder, triggerStepId: s.triggerStepId, triggerType: s.triggerType }))
      });

      console.log('Sending sequence data to backend:', JSON.stringify(sequenceData, null, 2));

      let savedSequence: Sequence;
      
      if (editingSequenceId) {
        // Update existing sequence
        savedSequence = await api.updateSequence(editingSequenceId, sequenceData);
        toast.success(`✅ Sequence "${sequenceName}" updated successfully!`);
      } else {
        // Create new sequence
        savedSequence = await api.createSequence(sequenceData);
        toast.success(`✅ Sequence "${sequenceName}" created successfully!`);
      }
      
      console.log('Backend response:', savedSequence);
      
      // Refresh sequences list
      await fetchSequences();
      
      // Reset form if creating new sequence
      if (!editingSequenceId) {
        clearAllSteps();
      }
      
    } catch (error: any) {
      console.error('Error saving sequence:', error);
      console.error('Full error response:', error.response || error);
      
      // Display backend error message if available
      let errorMessage = 'Failed to save sequence. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const clearAllSteps = () => {
    const firstStep: EmailStep = {
      id: Date.now().toString(),
      subject: 'Welcome Email',
      body: '',
      templateId: null,
      delayDays: 0,
      delayHours: 0,
      triggerType: 'delay',
      skipTrigger: false,
      stepOrder: 1
    };
    setSteps([firstStep]);
    setSelectedStep(firstStep.id);
    setSequenceName('');
    setSequenceDescription('');
    setEditingSequenceId(null);
    setBackendStepIdMap(new Map()); // Clear backend step ID mapping
    toast.success('Sequence cleared');
  };

  const loadSequence = async (sequence: Sequence) => {
    try {
      setSequenceName(sequence.name);
      setSequenceDescription(sequence.description || '');
      setEditingSequenceId(sequence.id);
      
      // Sort steps by stepOrder to ensure correct mapping
      const sortedSteps = [...sequence.steps].sort((a, b) => a.stepOrder - b.stepOrder);
      
      // Create mappings between backend and frontend step IDs
      const backendToFrontendIdMap = new Map<string, string>();
      const frontendToBackendIdMap = new Map<string, string>();
      
      // First pass: Create EmailStep objects with frontend IDs
      const emailSteps: EmailStep[] = sortedSteps.map((step, index) => {
        const frontendId = `loaded-step-${index + 1}-${Date.now()}`;
        backendToFrontendIdMap.set(step.id, frontendId);
        frontendToBackendIdMap.set(frontendId, step.id);
        
        return {
          id: frontendId,
          subject: step.subject || step.template?.subject || `Step ${index + 1}`,
          body: removeEmailTracking(step.body || step.template?.body || ''),
          templateId: step.templateId,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          triggerType: step.triggerType || 'delay',
          triggerStepId: null, // Will be set in second pass
          skipTrigger: step.triggerType === 'skip',
          stepOrder: step.stepOrder,
          notOpenedDelayHours: step.triggerType === 'not_opened' ? 24 : undefined // Default for not_opened
        };
      });
      
      // Second pass: Map triggerStepId from backend IDs to frontend IDs
      sortedSteps.forEach((backendStep, index) => {
        if (backendStep.triggerStepId && backendToFrontendIdMap.has(backendStep.triggerStepId)) {
          const frontendTriggerStepId = backendToFrontendIdMap.get(backendStep.triggerStepId);
          emailSteps[index].triggerStepId = frontendTriggerStepId;
        }
      });
      
      console.log('Loaded sequence steps with trigger mapping:', {
        backendSteps: sortedSteps.map(s => ({ id: s.id, stepOrder: s.stepOrder, triggerStepId: s.triggerStepId, triggerType: s.triggerType })),
        frontendSteps: emailSteps.map(s => ({ id: s.id, stepOrder: s.stepOrder, triggerStepId: s.triggerStepId, triggerType: s.triggerType })),
        idMapping: Object.fromEntries(backendToFrontendIdMap)
      });
      
      setSteps(emailSteps);
      setBackendStepIdMap(frontendToBackendIdMap); // Store the mapping for save operations
      setSelectedStep(emailSteps[0]?.id || '');
      setSidebarOpen(false);
      toast.success(`Loaded "${sequence.name}" for editing`);
    } catch (error) {
      console.error('Error loading sequence:', error);
      toast.error('Failed to load sequence');
    }
  };

  // Template selection function
  const applyTemplate = (templateId: string, stepId: string) => {
    // Check both API templates and default templates
    let template = templates.find(t => t.id === templateId);
    
    // If not found in API templates, check default templates
    if (!template) {
      const defaultTemplate = defaultTemplates.find(t => t.id === templateId);
      if (defaultTemplate) {
        template = {
          id: defaultTemplate.id,
          name: defaultTemplate.name,
          subject: defaultTemplate.subject,
          body: defaultTemplate.body,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    }
    
    if (template && stepId) {
      // For default templates, don't set templateId (they will be saved as custom content)
      // For API templates, set the templateId
      const isDefaultTemplate = defaultTemplates.some(t => t.id === templateId);
      
      if (isDefaultTemplate) {
        updateStep(stepId, 'templateId', null);
      } else {
        updateStep(stepId, 'templateId', templateId);
      }
      
      updateStep(stepId, 'subject', template.subject);
      updateStep(stepId, 'body', removeEmailTracking(template.body));
      
      toast.success(`Template "${template.name}" applied successfully!`);
    }
  };

  // Handle template updates from SimpleEditTemplatesPopup
  const handleTemplateUpdate = (templateId: string, updates: { subject: string; body: string }) => {
    // Check if this is a default template update
    const isDefaultTemplate = defaultTemplates.some(t => t.id === templateId);
    
    if (isDefaultTemplate) {
      // For default templates, update any steps currently using this template
      setSteps(prevSteps => 
        prevSteps.map(step => {
          // If step is using this template (either by templateId or by matching content)
          if (step.templateId === templateId) {
            return {
              ...step,
              subject: updates.subject,
              body: removeEmailTracking(updates.body),
              templateId: null // Convert to custom content since default template was modified
            };
          }
          return step;
        })
      );
      
      toast.success('Default template updated and applied to current steps!');
    } else {
      // For API templates, refresh from backend
      fetchTemplates();
      toast.success('Template updated successfully!');
    }
  };


  // Shuffle steps function
  const shuffleSteps = () => {
    const shuffledSteps = [...steps];
    // Keep first step in place, shuffle the rest
    const firstStep = shuffledSteps.shift();
    for (let i = shuffledSteps.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledSteps[i], shuffledSteps[j]] = [shuffledSteps[j], shuffledSteps[i]];
    }
    if (firstStep) {
      shuffledSteps.unshift(firstStep);
    }
    // Update step orders
    const reorderedSteps = shuffledSteps.map((step, index) => ({
      ...step,
      stepOrder: index + 1
    }));
    setSteps(reorderedSteps);
    toast.success('Steps shuffled successfully!');
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Fixed Header */}
      <div className="fixed top-16 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="px-6 py-6"
          style={{ 
            marginLeft: sidebarOpen ? '320px' : '0px',
            transition: 'margin-left 0.3s ease-in-out'
          }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Sidebar Toggle */}
                <Button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  variant="outline"
                  size="icon"
                  className="rounded-full shadow-sm bg-white border-gray-200 hover:bg-gray-50"
                >
                  {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
                
                <div className="flex-1 max-w-md space-y-2">
                  <div>
                    <Label htmlFor="sequenceName" className="text-sm font-medium text-gray-700 mb-2 block">
                      Sequence Name {editingSequenceId && <span className="text-blue-600">(Editing)</span>}
                    </Label>
                    <Input
                      id="sequenceName"
                      value={sequenceName}
                      onChange={(e) => setSequenceName(e.target.value)}
                      placeholder="e.g., Welcome Series, Product Demo Follow-up"
                      className="text-lg font-semibold border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sequenceDescription" className="text-sm font-medium text-gray-700 mb-1 block">
                      Description (Optional)
                    </Label>
                    <Input
                      id="sequenceDescription"
                      value={sequenceDescription}
                      onChange={(e) => setSequenceDescription(e.target.value)}
                      placeholder="Brief description of this sequence..."
                      className="text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>
                            <div className="flex items-center space-x-3">
                <Button
                  onClick={() => setIsManageTemplatesOpen(true)}
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Templates
                </Button>
                {editingSequenceId && (
                  <Button
                    onClick={clearAllSteps}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    New Sequence
                  </Button>
                )}
                <Button
                  onClick={saveSequence}
                  disabled={!sequenceName.trim() || steps.length === 0 || isSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 font-medium shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isSaving ? 'Saving...' : (editingSequenceId ? 'Update Sequence' : 'Save Sequence')}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Existing Sequences Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 h-full w-80 bg-white border-r border-gray-200 shadow-xl z-40 pt-32"
          >
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Sequences</h3>
                <Button
                  onClick={clearAllSteps}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  New
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2">
                {isLoadingSequences ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading sequences...</span>
                  </div>
                ) : sequences.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No sequences yet</p>
                    <p className="text-xs text-gray-400 mt-1">Create your first sequence to get started</p>
                  </div>
                ) : (
                  sequences.map((sequence) => (
                    <motion.div
                      key={sequence.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                        editingSequenceId === sequence.id
                          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                      }`}
                      onClick={() => loadSequence(sequence)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm text-gray-900 truncate pr-2">
                          {sequence.name}
                          {editingSequenceId === sequence.id && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Editing
                            </span>
                          )}
                        </h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          sequence.isActive 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {sequence.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span>{sequence.steps?.length || 0} steps</span>
                        </div>
                        <span>•</span>
                        <span>{new Date(sequence.createdAt).toLocaleDateString()}</span>
                      </div>
                      {sequence.description && (
                        <p className="text-xs text-gray-400 mt-2 truncate">
                          {sequence.description}
                        </p>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Container */}
      <div className="pt-32">
        <motion.div 
          className="flex h-[calc(100vh-8rem)]"
          style={{ 
            marginLeft: sidebarOpen ? '320px' : '0px'
          }}
          animate={{ 
            marginLeft: sidebarOpen ? '320px' : '0px'
          }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
          {/* Steps Sidebar */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm"
          >
            {/* Sidebar Header */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="p-6 border-b border-gray-200 bg-gray-50"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Email Steps</h2>
                <div className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Configure your email sequence steps
              </p>
            </motion.div>

            {/* Steps List */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {steps.map((step, index) => {
                    const isSelected = selectedStep === step.id;
                    const stepTitle = step.subject.trim() || "Untitled Step";
                    
                    return (
                      <motion.div
                        key={step.id}
                        layout
                        variants={slideInLeft}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ 
                          type: "spring", 
                          stiffness: 300, 
                          damping: 30,
                          delay: index * 0.1
                        }}
                        whileHover={{ 
                          scale: 1.02,
                          y: -2,
                          transition: { type: "spring", stiffness: 400, damping: 25 }
                        }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div
                          className={`
                            relative p-4 rounded-xl cursor-pointer transition-all duration-300 group
                            ${isSelected 
                              ? 'bg-blue-600 text-white shadow-lg border border-blue-500' 
                              : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-md shadow-sm'
                            }
                          `}
                          onClick={() => setSelectedStep(step.id)}
                        >
                          {/* Step Number Badge */}
                          <div className="flex items-start justify-between mb-3">
                            <div className={`
                              w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                              ${isSelected 
                                ? 'bg-white/20 text-white' 
                                : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
                              }
                            `}>
                              {index + 1}
                            </div>
                            
                            {/* Delete Button */}
                            {steps.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteStep(step.id);
                                }}
                                className={`
                                  p-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                                  ${isSelected 
                                    ? 'text-white/70 hover:text-white hover:bg-white/20' 
                                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                  }
                                `}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>

                          {/* Step Content */}
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <Mail className={`w-4 h-4 mr-2 ${isSelected ? 'text-white/80' : 'text-gray-500'}`} />
                              <h3 className={`
                                font-semibold text-sm truncate
                                ${isSelected ? 'text-white' : 'text-gray-900'}
                              `}>
                                {stepTitle}
                              </h3>
                            </div>
                            
                            <div className="flex items-center">
                              <Clock className={`w-3 h-3 mr-2 ${isSelected ? 'text-white/70' : 'text-gray-400'}`} />
                              <span className={`
                                text-xs
                                ${isSelected ? 'text-white/90' : 'text-gray-500'}
                              `}>
                                {step.triggerType === 'delay' 
                                  ? (step.delayDays === 0 && step.delayHours === 0 
                                      ? 'Send immediately' 
                                      : `${step.delayDays}d ${step.delayHours}h delay`)
                                  : step.triggerType === 'opened' ? 'If opened'
                                  : step.triggerType === 'not_opened' ? `If not opened (${step.notOpenedDelayHours || 24}h)`
                                  : step.triggerType === 'replied' ? 'If replied'
                                  : step.triggerType === 'skip' ? 'Send immediately'
                                  : 'Unknown trigger'
                                }
                                {step.skipTrigger && step.triggerType !== 'skip' && ' (Skipped)'}
                              </span>
                            </div>
                          </div>

                          {/* Selected Indicator */}
                          {isSelected && (
                            <motion.div
                              layoutId="selectedIndicator"
                              className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"
                              initial={false}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Add Step Button at Bottom */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  onClick={addNewStep}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                  size="lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Email Step
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Main editing area */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex-1 flex flex-col bg-gray-50"
          >
            {/* Header with Tabs */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="bg-white border-b border-gray-200 shadow-sm"
            >
              <div className="p-6 pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Email Sequence Builder</h1>
                    <p className="text-gray-600 mt-1 text-sm">Create sequences and manage templates</p>
                  </div>
                </div>
                
              </div>
            </motion.div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <AnimatePresence mode="wait">
                {selectedStep ? (
              <motion.div
                key={selectedStep}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  transition: { 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 30 
                  }
                }}
                exit={{ 
                  opacity: 0, 
                  y: -20, 
                  scale: 0.95,
                  transition: { duration: 0.2 }
                }}
                className="max-w-4xl mx-auto"
              >
                <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 border-b border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <CardTitle className="flex items-center text-lg sm:text-xl">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-lg">
                          <Edit3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <span className="text-slate-900 font-bold tracking-tight">
                            Step {steps.findIndex(s => s.id === selectedStep) + 1}
                          </span>
                          <p className="text-sm text-slate-600 font-normal mt-1">
                            {steps.find(s => s.id === selectedStep)?.subject.trim() || "Untitled Step"}
                          </p>
                        </div>
                      </CardTitle>
                      
                      {/* Delete Current Step Button */}
                      {steps.length > 1 && (
                        <motion.div
                          whileHover={buttonHover}
                          whileTap={buttonTap}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteStep(selectedStep)}
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 shadow-sm"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Delete Step</span>
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-8 space-y-8">
                    {/* Template Selector */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 }}
                    >
                      <Label className="text-base font-semibold text-gray-800 mb-3 block">
                        Choose Template
                      </Label>
                      <div className="relative">
                        <select
                          value={steps.find(s => s.id === selectedStep)?.templateId || ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              applyTemplate(e.target.value, selectedStep);
                            } else {
                              // Clear template selection
                              selectedStep && updateStep(selectedStep, 'templateId', null);
                            }
                          }}
                          disabled={isLoadingTemplates}
                          className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 bg-white/80 backdrop-blur-sm appearance-none pr-10 shadow-sm text-sm sm:text-base"
                        >
                          <option value="">
                            {isLoadingTemplates ? 'Loading templates...' : 'Custom Email (write your own)'}
                          </option>
                          
                          {/* Default Templates */}
                          <optgroup label="Default Templates">
                            {defaultTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name} - {template.subject}
                              </option>
                            ))}
                          </optgroup>
                          
                          {/* API Templates */}
                          {!isLoadingTemplates && templates.length > 0 && (
                            <optgroup label="Custom Templates">
                              {templates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name} - {template.subject}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          {isLoadingTemplates ? (
                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        Select from default templates or your custom templates to automatically fill subject and body
                      </p>
                    </motion.div>

                    {/* Email Subject */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Label htmlFor="subject" className="text-base font-semibold text-gray-800 mb-3 block">
                        Email Subject Line
                      </Label>
                      <Input
                        id="subject"
                        value={steps.find(s => s.id === selectedStep)?.subject || ''}
                        onChange={(e) => selectedStep && updateStep(selectedStep, 'subject', e.target.value)}
                        className="text-base sm:text-lg p-3 sm:p-4 border-2 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm"
                        placeholder="Enter a compelling subject line..."
                      />
                      <p className="text-sm text-gray-500 mt-2">
                        Keep it concise and engaging to improve open rates
                      </p>
                    </motion.div>

                    {/* Email Body */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Label htmlFor="body" className="text-base font-semibold text-gray-800 mb-3 block">
                        Email Content
                      </Label>
                      <Textarea
                        id="body"
                        value={steps.find(s => s.id === selectedStep)?.body || ''}
                        onChange={(e) => selectedStep && updateStep(selectedStep, 'body', e.target.value)}
                        className="min-h-[250px] sm:min-h-[300px] text-sm sm:text-base p-3 sm:p-4 border-2 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 resize-none bg-white/80 backdrop-blur-sm rounded-lg shadow-sm"
                        placeholder="Write your email content here...

You can use personalization variables:
• [firstName] - Contact's first name
• [lastName] - Contact's last name  
• [email] - Contact's email address
• [company] - Contact's company name"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-sm text-gray-500">
                          Use personalization variables to make emails more engaging
                        </p>
                        <span className="text-xs text-gray-400">
                          {(steps.find(s => s.id === selectedStep)?.body || '').length} characters
                        </span>
                      </div>
                    </motion.div>

                    {/* Trigger Condition Settings */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base font-semibold text-gray-800">
                          Trigger Condition
                        </Label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="skipTrigger"
                            checked={steps.find(s => s.id === selectedStep)?.skipTrigger || false}
                            onChange={(e) => selectedStep && updateStep(selectedStep, 'skipTrigger', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor="skipTrigger" className="text-sm text-gray-600 cursor-pointer">
                            Skip trigger (send immediately)
                          </Label>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {!steps.find(s => s.id === selectedStep)?.skipTrigger && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-4"
                          >
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                  Trigger Type
                                </Label>
                                <Select
                                  value={steps.find(s => s.id === selectedStep)?.triggerType || 'delay'}
                                  onValueChange={(value: 'delay' | 'opened' | 'not_opened' | 'replied' | 'skip') => 
                                    selectedStep && updateStep(selectedStep, 'triggerType', value)
                                  }
                                >
                                  <SelectTrigger className="w-full border-gray-200 focus:border-blue-500">
                                    <SelectValue placeholder="Select trigger condition" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="delay">
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-2 text-blue-600" />
                                        Send after delay
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="opened">
                                      <div className="flex items-center">
                                        <Mail className="w-4 h-4 mr-2 text-green-600" />
                                        Send if previous email was opened
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="not_opened">
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-2 text-orange-600" />
                                        Send if previous email was not opened
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="replied">
                                      <div className="flex items-center">
                                        <Mail className="w-4 h-4 mr-2 text-purple-600" />
                                        Send if user replied
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="skip">
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-2 text-gray-600" />
                                        Skip trigger (send immediately)
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Trigger Step Selection for non-delay triggers */}
                              {steps.find(s => s.id === selectedStep)?.triggerType !== 'delay' && steps.find(s => s.id === selectedStep)?.triggerType !== 'skip' && (
                                <div>
                                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Which step should trigger this email?
                                  </Label>
                                  <Select
                                    value={steps.find(s => s.id === selectedStep)?.triggerStepId || ''}
                                    onValueChange={(value) => selectedStep && updateStep(selectedStep, 'triggerStepId', value)}
                                  >
                                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500">
                                      <SelectValue placeholder="Select trigger step" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {steps
                                        .filter(step => step.id !== selectedStep)
                                        .map((step, index) => (
                                          <SelectItem key={step.id} value={step.id}>
                                            Step {step.stepOrder}: {step.subject || 'Untitled'}
                                          </SelectItem>
                                        ))
                                      }
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                        
                            {/* Conditional Content Based on Trigger Type */}
                            <AnimatePresence mode="wait">
                              {steps.find(s => s.id === selectedStep)?.triggerType === 'delay' ? (
                                <motion.div
                                  key="delay-settings"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="space-y-3"
                                >
                                  <Label className="text-sm font-medium text-gray-700">
                                    Delay Duration
                                  </Label>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Days
                                      </Label>
                                      <select
                                        value={steps.find(s => s.id === selectedStep)?.delayDays || 0}
                                        onChange={(e) => selectedStep && updateStep(selectedStep, 'delayDays', parseInt(e.target.value))}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 bg-white text-sm"
                                      >
                                        <option value={0}>0 days</option>
                                        <option value={1}>1 day</option>
                                        <option value={2}>2 days</option>
                                        <option value={3}>3 days</option>
                                        <option value={7}>1 week</option>
                                        <option value={14}>2 weeks</option>
                                        <option value={30}>1 month</option>
                                      </select>
                                    </div>
                                    <div>
                                      <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Hours
                                      </Label>
                                      <select
                                        value={steps.find(s => s.id === selectedStep)?.delayHours || 0}
                                        onChange={(e) => selectedStep && updateStep(selectedStep, 'delayHours', parseInt(e.target.value))}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 bg-white text-sm"
                                      >
                                        <option value={0}>0 hours</option>
                                        <option value={1}>1 hour</option>
                                        <option value={2}>2 hours</option>
                                        <option value={4}>4 hours</option>
                                        <option value={8}>8 hours</option>
                                        <option value={12}>12 hours</option>
                                      </select>
                                    </div>
                                  </div>
                                </motion.div>
                              ) : steps.find(s => s.id === selectedStep)?.triggerType === 'not_opened' ? (
                                <motion.div
                                  key="not-opened-settings"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="space-y-4"
                                >
                                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Clock className="w-3 h-3 text-orange-600" />
                                      </div>
                                      <div className="text-sm text-orange-800">
                                        <p className="font-medium mb-1">If Not Opened Trigger</p>
                                        <p>This email will be sent if the selected step has not been opened after the specified delay.</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                      Wait before sending (if not opened)
                                    </Label>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-xs text-gray-600 mb-1 block">Days</Label>
                                        <select
                                          value={Math.floor((steps.find(s => s.id === selectedStep)?.notOpenedDelayHours || 24) / 24)}
                                          onChange={(e) => {
                                            const days = parseInt(e.target.value);
                                            const currentHours = (steps.find(s => s.id === selectedStep)?.notOpenedDelayHours || 24) % 24;
                                            selectedStep && updateStep(selectedStep, 'notOpenedDelayHours', days * 24 + currentHours);
                                          }}
                                          className="w-full p-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 bg-white text-sm"
                                        >
                                          <option value={0}>0 days</option>
                                          <option value={1}>1 day</option>
                                          <option value={2}>2 days</option>
                                          <option value={3}>3 days</option>
                                          <option value={7}>1 week</option>
                                        </select>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-gray-600 mb-1 block">Hours</Label>
                                        <select
                                          value={(steps.find(s => s.id === selectedStep)?.notOpenedDelayHours || 24) % 24}
                                          onChange={(e) => {
                                            const hours = parseInt(e.target.value);
                                            const currentDays = Math.floor((steps.find(s => s.id === selectedStep)?.notOpenedDelayHours || 24) / 24);
                                            selectedStep && updateStep(selectedStep, 'notOpenedDelayHours', currentDays * 24 + hours);
                                          }}
                                          className="w-full p-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 bg-white text-sm"
                                        >
                                          <option value={0}>0 hours</option>
                                          <option value={1}>1 hour</option>
                                          <option value={2}>2 hours</option>
                                          <option value={4}>4 hours</option>
                                          <option value={8}>8 hours</option>
                                          <option value={12}>12 hours</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ) : steps.find(s => s.id === selectedStep)?.triggerType === 'skip' ? (
                                <motion.div
                                  key="skip-info"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <Clock className="w-3 h-3 text-gray-600" />
                                    </div>
                                    <div className="text-sm text-gray-800">
                                      <p className="font-medium mb-1">Skip Trigger</p>
                                      <p>This email will be sent immediately after the previous step, ignoring any trigger conditions.</p>
                                    </div>
                                  </div>
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="condition-info"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <Clock className="w-3 h-3 text-blue-600" />
                                    </div>
                                    <div className="text-sm text-blue-800">
                                      <p className="font-medium mb-1">Conditional Trigger</p>
                                      <p>
                                        {steps.find(s => s.id === selectedStep)?.triggerType === 'opened' && 
                                          'This email will be sent immediately when the selected step is opened by the recipient.'
                                        }
                                        {steps.find(s => s.id === selectedStep)?.triggerType === 'replied' && 
                                          'This email will be sent immediately when the recipient replies to the selected step.'
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <p className="text-sm text-gray-500 mt-2">
                        {steps.find(s => s.id === selectedStep)?.skipTrigger || steps.find(s => s.id === selectedStep)?.triggerType === 'skip'
                          ? 'This email will be sent immediately after the previous step'
                          : 'Choose when this email should be sent based on recipient behavior'
                        }
                      </p>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="flex justify-between items-center pt-6 border-t border-gray-200"
                    >
                      <div className="text-sm text-gray-500">
                        Changes are saved automatically
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                          <Button 
                            onClick={shuffleSteps}
                            variant="outline" 
                            className="w-full sm:w-auto border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm"
                            disabled={steps.length <= 1}
                          >
                            <Shuffle className="w-4 h-4 mr-2" />
                            Shuffle Steps
                          </Button>
                        </motion.div>
                        <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                          <Button 
                            variant="outline" 
                            className="w-full sm:w-auto border-gray-300 hover:bg-gray-50 shadow-sm"
                          >
                            Preview Email
                          </Button>
                        </motion.div>
                        <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                          <Button 
                            onClick={addNewStep}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Next Step
                          </Button>
                        </motion.div>
                      </div>
                    </motion.div>
                  </CardContent>
                </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center h-full"
                    >
                      <Card className="p-12 text-center max-w-md mx-auto shadow-lg border-0">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Mail className="w-10 h-10 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">
                          Select a Step to Edit
                        </h3>
                        <p className="text-gray-600 mb-6">
                          Choose a step from the sidebar to start customizing your email content and timing.
                        </p>
                        <Button 
                          onClick={addNewStep}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Step
                        </Button>
                      </Card>
                    </motion.div>
                  )
                }
              </AnimatePresence>
            </div>
      </motion.div>
      </div>
        </motion.div>
      </div>

        {/* Manage Templates Popup */}
        <SimpleEditTemplatesPopup
          isOpen={isManageTemplatesOpen}
          onClose={() => setIsManageTemplatesOpen(false)}
          onTemplateUpdate={handleTemplateUpdate}
        />
    </div>
  );
};

export default SequencesNew;
