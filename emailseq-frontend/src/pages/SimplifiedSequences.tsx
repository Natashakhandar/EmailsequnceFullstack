import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, Template, Sequence } from "@/lib/api";
import { defaultTemplates, DefaultTemplate } from "@/data/defaultTemplates";
import SimpleEditTemplatesPopup from "@/components/popups/SimpleEditTemplatesPopup";

interface SequenceStep {
  id: string;
  label: string;
  condition: string;
  templateId: string;
  selectedTemplate?: DefaultTemplate;
}

const SimplifiedSequences = () => {
  const [sequenceName, setSequenceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditTemplatesOpen, setIsEditTemplatesOpen] = useState(false);
  const [localDefaultTemplates, setLocalDefaultTemplates] = useState(defaultTemplates);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [userSignature, setUserSignature] = useState<string>("");

  // Fixed 4-step sequence structure
  const [steps, setSteps] = useState<SequenceStep[]>([
    {
      id: "step-1",
      label: "Intro Email",
      condition: "Always send first",
      templateId: "",
      selectedTemplate: undefined
    },
    {
      id: "step-2",
      label: "Follow-Up Email",
      condition: "If they open → send next email",
      templateId: "",
      selectedTemplate: undefined
    },
    {
      id: "step-3",
      label: "Reminder Email",
      condition: "If they don't open for 3 days → send reminder email",
      templateId: "",
      selectedTemplate: undefined
    },
    {
      id: "step-4",
      label: "Thank-You Email",
      condition: "If they reply → send thank-you or closing email",
      templateId: "",
      selectedTemplate: undefined
    }
  ]);

  // Load templates and sequences on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Try to load from backend first
      try {
        const [templatesResponse, sequencesResponse, signatureResponse] = await Promise.allSettled([
          api.getTemplates({ limit: 100 }),
          api.getSequences({ limit: 50 }),
          api.getProfileSignature()
        ]);

        if (templatesResponse.status === 'fulfilled') {
          setTemplates(templatesResponse.value.templates);
        }

        if (sequencesResponse.status === 'fulfilled') {
          // Combine backend sequences with localStorage sequences
          const localSequences = JSON.parse(localStorage.getItem('emailSequences') || '[]');
          const allSequences = [...sequencesResponse.value.sequences, ...localSequences.filter((seq: any) => !seq.backendSaved)];
          setSequences(allSequences);
        }

        if (signatureResponse.status === 'fulfilled') {
          setUserSignature(signatureResponse.value.signature || "");
        }

      } catch (backendError) {
        console.error("Backend loading failed, using localStorage:", backendError);

        // Fallback to localStorage only
        const localSequences = JSON.parse(localStorage.getItem('emailSequences') || '[]');
        setSequences(localSequences);
        setTemplates([]); // No custom templates available offline

        if (localSequences.length > 0) {
          toast.success("Loaded sequences from local storage");
        }
      }

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (stepId: string, templateId: string) => {
    const selectedTemplate = localDefaultTemplates.find(t => t.id === templateId);

    setSteps(prev => prev.map(step =>
      step.id === stepId
        ? { ...step, templateId, selectedTemplate }
        : step
    ));
  };

  // Add signature to template body
  const addSignatureToBody = (body: string): string => {
    if (!userSignature) return body;

    // Check if signature already exists (avoid duplicates)
    if (body.includes(userSignature)) {
      return body;
    }

    return body + `\n\n${userSignature}`;
  };

  const handleTemplateUpdate = (templateId: string, updates: { subject: string; body: string }) => {
    setLocalDefaultTemplates(prev =>
      prev.map(template =>
        template.id === templateId
          ? { ...template, ...updates }
          : template
      )
    );

    // Update selected templates in steps
    setSteps(prev => prev.map(step =>
      step.selectedTemplate?.id === templateId
        ? { ...step, selectedTemplate: { ...step.selectedTemplate, ...updates } }
        : step
    ));
  };

  const saveSequence = async () => {
    if (!sequenceName.trim()) {
      toast.error("Please enter a sequence name");
      return;
    }

    const stepsWithTemplates = steps.filter(step => step.templateId && step.selectedTemplate);
    if (stepsWithTemplates.length === 0) {
      toast.error("Please select at least one template");
      return;
    }

    // Collect comprehensive sequence data
    const sequenceData = {
      name: sequenceName,
      description: `4-step email sequence: ${stepsWithTemplates.map(s => s.label).join(" → ")}`,
      createdAt: new Date().toISOString(),
      steps: stepsWithTemplates.map((step, index) => ({
        stepId: step.id,
        label: step.label,
        condition: step.condition,
        stepOrder: index + 1,
        templateData: {
          name: step.selectedTemplate!.name,
          subject: step.selectedTemplate!.subject,
          body: step.selectedTemplate!.body,
          type: step.selectedTemplate!.type
        },
        delayDays: index === 0 ? 0 : 2, // First step immediate, others after 2 days
        delayHours: 0,
        isActive: true
      })),
      totalSteps: stepsWithTemplates.length,
      isActive: true
    };

    try {
      // Try to save to backend first
      const processedSteps = [];

      for (let i = 0; i < stepsWithTemplates.length; i++) {
        const step = stepsWithTemplates[i];
        if (step.selectedTemplate) {
          const customTemplate = await api.createTemplate({
            name: `${sequenceName} - ${step.label}`,
            subject: step.selectedTemplate.subject,
            body: addSignatureToBody(step.selectedTemplate.body),
            isActive: true
          });

          processedSteps.push({
            templateId: customTemplate.id,
            stepOrder: i + 1,
            delayDays: i === 0 ? 0 : 2,
            delayHours: 0,
            isActive: true
          });
        }
      }

      const sequence = await api.createSequence({
        name: sequenceName,
        description: sequenceData.description,
        steps: processedSteps
      });

      setSequences([sequence, ...sequences]);

      // Also save to localStorage as backup
      const savedSequences = JSON.parse(localStorage.getItem('emailSequences') || '[]');
      savedSequences.push({ ...sequenceData, id: sequence.id, backendSaved: true });
      localStorage.setItem('emailSequences', JSON.stringify(savedSequences));

      // Reset form
      setSequenceName("");
      setSteps(prev => prev.map(step => ({
        ...step,
        templateId: "",
        selectedTemplate: undefined
      })));

      toast.success("✅ Sequence saved successfully");
      loadData();

    } catch (error: any) {
      console.error("Backend save failed, falling back to localStorage:", error);

      // Fallback to localStorage if backend fails
      try {
        const savedSequences = JSON.parse(localStorage.getItem('emailSequences') || '[]');
        const localSequence = {
          ...sequenceData,
          id: `local_${Date.now()}`,
          backendSaved: false
        };

        savedSequences.push(localSequence);
        localStorage.setItem('emailSequences', JSON.stringify(savedSequences));

        // Add to local state
        setSequences([localSequence as any, ...sequences]);

        // Reset form
        setSequenceName("");
        setSteps(prev => prev.map(step => ({
          ...step,
          templateId: "",
          selectedTemplate: undefined
        })));

        toast.success("✅ Sequence saved successfully (stored locally)");

      } catch (localError) {
        console.error("localStorage save also failed:", localError);
        toast.error("Failed to save sequence. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-12">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="container mx-auto px-6 pt-24 pb-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 text-slate-800">Email Sequence Builder</h1>
              <p className="text-sm sm:text-base text-gray-600">
                Create a 4-step automated email sequence
              </p>
            </div>

            <Button
              onClick={() => setIsEditTemplatesOpen(true)}
              variant="outline"
              className="border-gray-300 w-full sm:w-auto"
            >
              Edit Templates
            </Button>
          </div>

          {/* Sequence Name */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <Label htmlFor="sequenceName" className="text-sm font-medium text-gray-700">
              Sequence Name
            </Label>
            <Input
              id="sequenceName"
              value={sequenceName}
              onChange={(e) => setSequenceName(e.target.value)}
              placeholder="e.g., Sales Outreach Sequence"
              className="mt-1"
            />
          </div>
        </div>

        {/* Email Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{step.label}</h3>
                  <p className="text-sm text-gray-500">{step.condition}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor={`template-${step.id}`} className="text-sm font-medium text-gray-700">
                    Select Template
                  </Label>
                  <Select
                    value={step.templateId}
                    onValueChange={(value) => handleTemplateSelect(step.id, value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {localDefaultTemplates.map((template) => {
                        if (!template.id) {
                          console.warn('Skipping template with missing ID:', template);
                          return null;
                        }
                        return (
                          <SelectItem key={template.id} value={String(template.id)}>
                            {template.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {step.selectedTemplate && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Subject:</Label>
                      <p className="text-sm text-gray-900 mt-1">{step.selectedTemplate.subject}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-700">Body:</Label>
                      <p className="text-sm text-gray-900 mt-1">{step.selectedTemplate.body}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="flex justify-center">
          <Button
            onClick={saveSequence}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
          >
            Save Sequence
          </Button>
        </div>

        {/* Existing Sequences */}
        {sequences.length > 0 && (
          <div className="mt-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Existing Sequences</h3>
            <div className="space-y-3">
              {sequences.map((sequence: any) => (
                <div
                  key={sequence.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{sequence.name}</h4>
                    {sequence.backendSaved === false && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Local Only
                      </span>
                    )}
                  </div>
                  {sequence.description && (
                    <p className="text-sm text-gray-600 mt-1">{sequence.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{sequence.steps?.length || sequence.totalSteps || 0} steps</span>
                    <span>•</span>
                    <span>Created {new Date(sequence.createdAt).toLocaleDateString()}</span>
                    {sequence.backendSaved === false && (
                      <>
                        <span>•</span>
                        <span className="text-yellow-600">Stored locally</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Templates Popup */}
        <SimpleEditTemplatesPopup
          isOpen={isEditTemplatesOpen}
          onClose={() => setIsEditTemplatesOpen(false)}
          onTemplateUpdate={handleTemplateUpdate}
        />
      </main>
    </div>
  );
};

export default SimplifiedSequences;
