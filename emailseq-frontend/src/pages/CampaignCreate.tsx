import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Target, Loader2, Users, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, Contact, Sequence } from "@/lib/api";

interface FormData {
  campaignName: string;
  description: string;
  sequenceId: string;
  leadIds: string[];
  startDate: string;
  endDate: string;
}

interface FormErrors {
  campaignName?: string;
  sequenceId?: string;
  leadIds?: string;
  startDate?: string;
  endDate?: string;
}

const CampaignCreate = () => {
  const navigate = useNavigate();
  
  // Form state with proper initialization
  const [formData, setFormData] = useState<FormData>({
    campaignName: "",
    description: "",
    sequenceId: "",
    leadIds: [],
    startDate: "",
    endDate: ""
  });
  
  // Validation and UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  
  // Data loading state
  const [leads, setLeads] = useState<Contact[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingSequences, setLoadingSequences] = useState(true);

  // Load data on component mount
  useEffect(() => {
    loadLeads();
    loadSequences();
  }, []);

  // Validate form whenever formData changes
  useEffect(() => {
    validateForm();
  }, [formData]);

  const loadLeads = async () => {
    try {
      setLoadingLeads(true);
      const response = await api.getContacts({ limit: 100 });
      // Only show active leads for campaign creation
      const activeLeads = response.contacts.filter(contact => contact.status === 'ACTIVE');
      setLeads(activeLeads);
    } catch (error) {
      console.error("Error loading leads:", error);
      toast.error("Failed to load leads");
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadSequences = async () => {
    try {
      setLoadingSequences(true);
      const response = await api.getSequences({ isActive: true });
      setSequences(response.sequences);
    } catch (error) {
      console.error("Error loading sequences:", error);
      toast.error("Failed to load sequences");
      setSequences([]);
    } finally {
      setLoadingSequences(false);
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    // Validate campaign name (required)
    if (!formData.campaignName || formData.campaignName.trim().length === 0) {
      newErrors.campaignName = "Campaign name is required";
    } else if (formData.campaignName.trim().length < 3) {
      newErrors.campaignName = "Campaign name must be at least 3 characters";
    }
    
    // Validate sequence selection (required)
    if (!formData.sequenceId || formData.sequenceId.trim().length === 0) {
      newErrors.sequenceId = "Email sequence selection is required";
    }
    
    // Validate lead selection (at least one required)
    if (!formData.leadIds || formData.leadIds.length === 0) {
      newErrors.leadIds = "At least one lead must be selected";
    }
    
    // Validate start date (optional but if provided, must be valid)
    if (formData.startDate && formData.startDate.trim().length > 0) {
      const startDate = new Date(formData.startDate);
      if (isNaN(startDate.getTime())) {
        newErrors.startDate = "Please enter a valid start date";
      }
    }
    
    // Validate end date (optional but if provided, must be valid and after start date)
    if (formData.endDate && formData.endDate.trim().length > 0) {
      const endDate = new Date(formData.endDate);
      if (isNaN(endDate.getTime())) {
        newErrors.endDate = "Please enter a valid end date";
      } else if (formData.startDate && formData.startDate.trim().length > 0) {
        const startDate = new Date(formData.startDate);
        if (!isNaN(startDate.getTime()) && endDate <= startDate) {
          newErrors.endDate = "End date must be after start date";
        }
      }
    }
    
    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLeadSelection = (leadId: string) => {
    setFormData(prev => ({
      ...prev,
      leadIds: prev.leadIds.includes(leadId)
        ? prev.leadIds.filter(id => id !== leadId)
        : [...prev.leadIds, leadId]
    }));
  };

  const handleSelectAllLeads = () => {
    setFormData(prev => ({
      ...prev,
      leadIds: prev.leadIds.length === leads.length ? [] : leads.map(lead => lead.id)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Comprehensive form state logging for debugging
    console.log("=== CAMPAIGN FORM SUBMISSION DEBUG ===");
    console.log("Current form state:", {
      campaignName: formData.campaignName,
      campaignNameLength: formData.campaignName.length,
      description: formData.description,
      descriptionLength: formData.description.length,
      sequenceId: formData.sequenceId,
      leadIds: formData.leadIds,
      leadCount: formData.leadIds.length,
      startDate: formData.startDate,
      endDate: formData.endDate,
      isValid: isValid,
      errors: errors
    });
    
    // Final validation before submission
    if (!isValid) {
      console.error("Form validation failed:", errors);
      toast.error("Please fix all validation errors before submitting");
      return;
    }

    // Validate required fields are not undefined or empty
    if (!formData.campaignName || formData.campaignName.trim().length === 0) {
      console.error("Campaign name is undefined or empty");
      toast.error("Campaign name is required");
      return;
    }
    
    if (!formData.sequenceId || formData.sequenceId.trim().length === 0) {
      console.error("Sequence ID is undefined or empty");
      toast.error("Email sequence selection is required");
      return;
    }
    
    if (!formData.leadIds || formData.leadIds.length === 0) {
      console.error("No leads selected");
      toast.error("At least one lead must be selected");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Transform camelCase form data to snake_case for backend API
      const campaignData = {
        campaign_name: formData.campaignName.trim(),
        description: formData.description.trim() || undefined,
        sequence_id: formData.sequenceId,
        lead_ids: formData.leadIds,
        start_date: formData.startDate.trim() || undefined,
        end_date: formData.endDate.trim() || undefined
      };

      console.log("=== PAYLOAD TRANSFORMATION VERIFICATION ===");
      console.log("Original form data (camelCase):", {
        campaignName: formData.campaignName,
        sequenceId: formData.sequenceId,
        leadIds: formData.leadIds,
        startDate: formData.startDate,
        endDate: formData.endDate
      });
      console.log("Transformed API payload (snake_case):", campaignData);
      console.log("API payload size:", JSON.stringify(campaignData).length, "bytes");
      
      const campaign = await api.createCampaign(campaignData);
      
      console.log("Campaign created successfully:", campaign);
      toast.success("Campaign created successfully!");
      
      // Navigate back to leads page or to a campaigns list page
      navigate("/leads");
      
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      console.error("Error details:", {
        message: error.message,
        status: error.status,
        response: error.response
      });
      toast.error(error.message || "Failed to create campaign");
    } finally {
      setIsSubmitting(false);
      console.log("=== CAMPAIGN FORM SUBMISSION END ===");
    }
  };

  const handleCancel = () => {
    navigate("/leads");
  };

  const getSelectedSequence = () => {
    return sequences.find(seq => seq.id === formData.sequenceId);
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
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leads
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Create Campaign</h1>
              <p className="text-muted-foreground">
                Organize leads into targeted campaigns for better tracking and management
              </p>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="max-w-4xl mx-auto glass shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Campaign Details
              </CardTitle>
              <CardDescription>
                Fill in the campaign information and select leads to get started
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Campaign Name */}
                <div className="space-y-2">
                  <Label htmlFor="campaignName" className="text-sm font-medium">
                    Campaign Name *
                  </Label>
                  <Input
                    id="campaignName"
                    value={formData.campaignName}
                    onChange={(e) => handleInputChange('campaignName', e.target.value)}
                    placeholder="e.g., Q1 Product Launch Campaign"
                    className={`rounded-xl ${errors.campaignName ? 'border-red-500' : ''}`}
                  />
                  {errors.campaignName && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {errors.campaignName}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Brief description of the campaign goals and target audience..."
                    className="rounded-xl min-h-[80px]"
                  />
                </div>

                {/* Campaign Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-sm font-medium">
                      Start Date (Optional)
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className={`rounded-xl ${errors.startDate ? 'border-red-500' : ''}`}
                    />
                    {errors.startDate && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {errors.startDate}
                      </div>
                    )}
                  </div>

                  {/* End Date */}
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-sm font-medium">
                      End Date (Optional)
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      className={`rounded-xl ${errors.endDate ? 'border-red-500' : ''}`}
                    />
                    {errors.endDate && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {errors.endDate}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Sequence */}
                <div className="space-y-2">
                  <Label htmlFor="sequence" className="text-sm font-medium">
                    Email Sequence *
                  </Label>
                  <Select 
                    value={formData.sequenceId} 
                    onValueChange={(value) => handleInputChange('sequenceId', value)}
                    disabled={loadingSequences || sequences.length === 0}
                  >
                    <SelectTrigger className={`rounded-xl ${errors.sequenceId ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder={
                        loadingSequences 
                          ? "Loading sequences..." 
                          : sequences.length === 0 
                          ? "No active sequences available" 
                          : "Choose a sequence..."
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {sequences.length > 0 ? (
                        sequences.map((sequence) => {
                          if (!sequence.id) {
                            console.warn('Skipping sequence with missing ID:', sequence);
                            return null;
                          }
                          return (
                            <SelectItem key={sequence.id} value={String(sequence.id)}>
                              {sequence.name} ({sequence.steps?.length || 0} steps)
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="no-sequences" disabled>
                          {loadingSequences ? "Loading..." : "No sequences available"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.sequenceId && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {errors.sequenceId}
                    </div>
                  )}
                  {!loadingSequences && sequences.length === 0 && (
                    <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <strong>No active sequences found.</strong><br />
                      Please create and activate sequences in the Sequences page first.
                    </div>
                  )}
                  {getSelectedSequence() && (
                    <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <strong>Selected: {getSelectedSequence()?.name}</strong>
                      </div>
                      <p className="mt-1 text-green-700">
                        {getSelectedSequence()?.description || "This sequence will be used for the campaign"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Lead Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Select Leads *
                  </Label>
                  
                  {loadingLeads ? (
                    <div className="flex items-center justify-center py-8 border rounded-xl">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                      <span className="text-muted-foreground">Loading leads...</span>
                    </div>
                  ) : leads.length === 0 ? (
                    <div className="text-center py-8 border rounded-xl bg-muted/20">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">No Active Leads Available</h3>
                      <p className="text-muted-foreground text-sm">
                        Please add some active leads first before creating a campaign.
                      </p>
                    </div>
                  ) : (
                    <div className={`border rounded-xl p-4 max-h-[300px] overflow-y-auto ${errors.leadIds ? 'border-red-500' : ''}`}>
                      {/* Select All */}
                      <div className="flex items-center space-x-2 mb-3 pb-3 border-b">
                        <Checkbox 
                          checked={formData.leadIds.length === leads.length && leads.length > 0}
                          onCheckedChange={handleSelectAllLeads}
                        />
                        <Label className="text-sm font-medium">
                          Select All Active Leads ({leads.length})
                        </Label>
                      </div>
                      
                      {/* Individual Leads */}
                      <div className="space-y-2">
                        {leads.map((lead) => (
                          <div key={lead.id} className="flex items-center space-x-2 py-1">
                            <Checkbox 
                              checked={formData.leadIds.includes(lead.id)}
                              onCheckedChange={() => handleLeadSelection(lead.id)}
                            />
                            <Label className="text-sm cursor-pointer flex-1">
                              <div className="flex items-center justify-between">
                                <span>
                                  {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  {lead.email}
                                </span>
                              </div>
                              {lead.company && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {lead.company}
                                </div>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Selection Summary */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formData.leadIds.length} lead(s) selected
                    </span>
                    {formData.leadIds.length > 0 && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        Ready for campaign
                      </div>
                    )}
                  </div>
                  
                  {errors.leadIds && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {errors.leadIds}
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  
                  <div className="flex items-center gap-3">
                    {/* Validation Status */}
                    <div className="text-sm">
                      {isValid ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Ready to create
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <AlertCircle className="w-4 h-4" />
                          Please complete all required fields
                        </div>
                      )}
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={!isValid || isSubmitting || loadingLeads || loadingSequences}
                      className="gradient-primary text-white rounded-xl min-w-[140px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Target className="w-4 h-4 mr-2" />
                          Create Campaign
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default CampaignCreate;
