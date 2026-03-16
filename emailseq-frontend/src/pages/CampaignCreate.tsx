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
import { ArrowLeft, Target, Loader2, Users, Mail, AlertCircle, CheckCircle2, Plus, Search, Trash2, ChevronRight, ChevronDown, Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { api, Contact, Sequence } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
  const [groups, setGroups] = useState<Array<{ name: string; count: number }>>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingSequences, setLoadingSequences] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [warmupStatus, setWarmupStatus] = useState({ isEnabled: false, reached: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("groups");
  const [isQuickAddPopoverOpen, setIsQuickAddPopoverOpen] = useState(false);
  const [isGroupPopoverOpen, setIsGroupPopoverOpen] = useState(false);

  // Quick Add state
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [newContact, setNewContact] = useState({
    email: "",
    firstName: "",
    lastName: "",
    company: "",
    leadListName: ""
  });

  // Load data on component mount
  useEffect(() => {
    loadLeads();
    loadSequences();
    loadGroups();
    loadWarmupStatus();
  }, []);

  // Validate form whenever formData changes
  useEffect(() => {
    validateForm();
  }, [formData]);

  const loadLeads = async () => {
    try {
      setLoadingLeads(true);
      // Fetch a larger number of contacts for campaign creation
      const response = await api.getContacts({ limit: 1000 });
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

  const loadGroups = async () => {
    try {
      setLoadingGroups(true);
      const data = await api.getContactGroups();
      setGroups(data);
    } catch (error) {
      console.error("Error loading groups:", error);
      toast.error("Failed to load lead groups");
    } finally {
      setLoadingGroups(false);
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

  const loadWarmupStatus = async () => {
    try {
      const status = await api.getWarmupSettings();
      console.log("📊 [DEBUG] Warmup Status Loaded:", status);
      if (status) {
        const isEnabled = status.isEnabled === true;
        const sent = Number(status.dailySentCount || 0);
        const limit = Number(status.currentBatchSize || 0);
        
        setWarmupStatus({
          isEnabled,
          reached: isEnabled && sent >= limit
        });
      }
    } catch (error) {
      console.error("Error loading warmup status:", error);
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
    const filteredLeadIds = filteredLeads.map(lead => lead.id);
    const areAllFilteredSelected = filteredLeadIds.every(id => formData.leadIds.includes(id));
    
    if (areAllFilteredSelected) {
      // Deselect only the filtered leads
      setFormData(prev => ({
        ...prev,
        leadIds: prev.leadIds.filter(id => !filteredLeadIds.includes(id))
      }));
    } else {
      // Select all filtered leads (maintaining others)
      setFormData(prev => ({
        ...prev,
        leadIds: Array.from(new Set([...prev.leadIds, ...filteredLeadIds]))
      }));
    }
  };

  const handleGroupToggle = async (groupName: string, currentlySelected: boolean) => {
    try {
      // Get all leads for this group
      const params: any = { limit: 1000 };
      if (groupName === 'Uncategorized') {
        params.leadListName = null;
      } else {
        params.leadListName = groupName;
      }
      
      const response = await api.getContacts(params);
      const activeGroupLeadIds = response.contacts
        .filter(c => c.status === 'ACTIVE')
        .map(c => c.id);

      if (currentlySelected) {
        // Deselect all from this group
        setFormData(prev => ({
          ...prev,
          leadIds: prev.leadIds.filter(id => !activeGroupLeadIds.includes(id))
        }));
      } else {
        // Select all from this group
        setFormData(prev => ({
          ...prev,
          leadIds: Array.from(new Set([...prev.leadIds, ...activeGroupLeadIds]))
        }));
      }
    } catch (error) {
      toast.error("Failed to toggle group selection");
    }
  };

  const handleQuickAdd = async () => {
    if (!newContact.email) {
      toast.error("Email is required");
      return;
    }

    try {
      setIsQuickAdding(true);
      const contact = await api.createContact({
        ...newContact,
        status: "ACTIVE",
        timezone: "UTC"
      });
      
      // Add to leads list and select it
      setLeads(prev => [contact, ...prev]);
      setFormData(prev => ({
        ...prev,
        leadIds: [...prev.leadIds, contact.id]
      }));
      
      setNewContact({ email: "", firstName: "", lastName: "", company: "", leadListName: "" });
      toast.success("Lead added and selected");
    } catch (error: any) {
      toast.error(error.message || "Failed to add lead");
    } finally {
      setIsQuickAdding(false);
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isGroupSelected = (groupName: string) => {
    // A group is considered selected if all its leads (that we have loaded) are selected
    const groupLeads = leads.filter(l => 
      groupName === 'Uncategorized' ? !l.leadListName : l.leadListName === groupName
    );
    if (groupLeads.length === 0) return false;
    return groupLeads.every(l => formData.leadIds.includes(l.id));
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

    // CHECK WARMUP LIMIT
    console.log("🛡️ Checking warmup limit before submission:", warmupStatus);
    if (warmupStatus.reached) {
      toast.error("Todays limit reach! Your campaign will be created, but emails will be automatically scheduled for tomorrow.", {
        duration: 6000,
      });
      // We don't block the creation, but we warn the user.
    }

    try {
      setIsSubmitting(true);
      
      // RE-CHECK WARMUP STATUS RIGHT BEFORE SUBMIT (FORCE FRESH DATA)
      const status = await api.getWarmupSettings();
      const sent = Number(status?.dailySentCount || 0);
      const limit = Number(status?.currentBatchSize || 0);
      const isReached = status?.isEnabled && (sent >= limit);
      
      console.log("🛡️ [WARMUP CHECK] Sent:", sent, "Limit:", limit, "Reached:", isReached);

      if (isReached) {
        // Force a confirmation modal that cannot be missed
        const proceed = window.confirm("⚠️ Daily sending limit reached!\n\nYour campaign will be created, but emails will be automatically scheduled for tomorrow morning. Do you want to proceed?");
        
        if (!proceed) {
          setIsSubmitting(false);
          return;
        }
      }
      
      // Transform camelCase form data to snake_case for backend API
      const campaignData = {
        campaign_name: formData.campaignName.trim(),
        description: formData.description.trim() || undefined,
        sequence_id: formData.sequenceId,
        lead_ids: formData.leadIds,
        start_date: formData.startDate.trim() || undefined,
        end_date: formData.endDate.trim() || undefined
      };

      const campaign = await api.createCampaign(campaignData);
      console.log("Campaign created successfully:", campaign);
      
      toast.success("Campaign created successfully!");
      if (isReached) {
        toast.info("Emails scheduled for tomorrow due to limit.");
      }
      
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
              {warmupStatus.reached && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-800">Daily Warmup Limit Reached</h4>
                    <p className="text-xs text-amber-700">You've hit your daily sending limit. Any emails from this campaign will be automatically scheduled for tomorrow morning.</p>
                  </div>
                </div>
              )}
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Select Leads *
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsQuickAdding(!isQuickAdding)}
                        className="text-primary hover:text-primary/80 h-8"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Quick Add Lead
                      </Button>
                    </div>
                  </div>

                  {isQuickAdding && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Input
                          placeholder="Email *"
                          value={newContact.email}
                          onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                          className="h-9 rounded-lg"
                        />
                        <Input
                          placeholder="First Name"
                          value={newContact.firstName}
                          onChange={(e) => setNewContact({...newContact, firstName: e.target.value})}
                          className="h-9 rounded-lg"
                        />
                        <Input
                          placeholder="Last Name"
                          value={newContact.lastName}
                          onChange={(e) => setNewContact({...newContact, lastName: e.target.value})}
                          className="h-9 rounded-lg"
                        />
                        <Input
                          placeholder="Company"
                          value={newContact.company}
                          onChange={(e) => setNewContact({...newContact, company: e.target.value})}
                          className="h-9 rounded-lg"
                        />
                      </div>
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="flex-1 w-full">
                          <Label className="text-xs text-muted-foreground mb-1 block">Lead List Name (Groups)</Label>
                          <Popover open={isQuickAddPopoverOpen} onOpenChange={setIsQuickAddPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between rounded-lg font-normal h-9 px-3 text-sm",
                                  !newContact.leadListName && "text-muted-foreground"
                                )}
                              >
                                {newContact.leadListName || "Select or type a group..."}
                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Search or type new group..." 
                                  onValueChange={(val) => setNewContact({ ...newContact, leadListName: val })}
                                />
                                <CommandList>
                                  <CommandEmpty 
                                    className="py-2 px-4 cursor-pointer hover:bg-accent text-sm" 
                                    onClick={() => {
                                      setIsQuickAddPopoverOpen(false);
                                    }}
                                  >
                                    Using new group: "{newContact.leadListName}"
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {groups.map((group) => (
                                      <CommandItem
                                        key={group.name}
                                        value={group.name}
                                        onSelect={(currentValue) => {
                                          setNewContact({ ...newContact, leadListName: currentValue });
                                          setIsQuickAddPopoverOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-3 w-3",
                                            newContact.leadListName === group.name ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {group.name} ({group.count})
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex justify-end gap-2 w-full md:w-auto self-end">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setIsQuickAdding(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="button" 
                          size="sm"
                          onClick={handleQuickAdd}
                          className="gradient-primary text-white"
                        >
                          Add & Select
                        </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-muted/50 rounded-lg">
                      <TabsTrigger value="groups" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Users className="w-4 h-4 mr-2" />
                        By Groups
                      </TabsTrigger>
                      <TabsTrigger value="individual" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Mail className="w-4 h-4 mr-2" />
                        Individual Leads
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="groups" className="mt-4 space-y-4">
                      {loadingGroups ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                          <span className="text-muted-foreground">Loading groups...</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">Select one or more lead groups to add all their active contacts to your campaign.</p>
                          
                          <Popover open={isGroupPopoverOpen} onOpenChange={setIsGroupPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between rounded-xl h-12 bg-white border-border/50 hover:bg-muted/30 transition-smooth px-4"
                              >
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-primary" />
                                  <span>Search or select lead groups...</span>
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command className="rounded-xl border-none shadow-luxury">
                                <CommandInput placeholder="Search or type new group name..." className="h-11 border-b" />
                                <CommandList className="max-h-[300px]">
                                  <CommandEmpty className="py-6 text-center text-muted-foreground">
                                    No lead groups found matching your search.
                                  </CommandEmpty>
                                  <CommandGroup className="p-2">
                                    {/* All Leads Option */}
                                    <CommandItem
                                      onSelect={() => {
                                        handleSelectAllLeads();
                                        setIsGroupPopoverOpen(false);
                                      }}
                                      className="rounded-lg py-3 cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded-full",
                                            formData.leadIds.length === leads.length && leads.length > 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                          )}>
                                            <Users className="w-4 h-4" />
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="font-semibold text-sm">All Leads</span>
                                            <span className="text-xs text-muted-foreground">{leads.length} contacts total</span>
                                          </div>
                                        </div>
                                        {formData.leadIds.length === leads.length && leads.length > 0 && (
                                          <Check className="w-4 h-4 text-primary" />
                                        )}
                                      </div>
                                    </CommandItem>

                                    {/* Uncategorized Option if not in groups list */}
                                    {!groups.find(g => g.name === 'Uncategorized') && (
                                      <CommandItem
                                        onSelect={() => {
                                          handleGroupToggle('Uncategorized', isGroupSelected('Uncategorized'));
                                          setIsGroupPopoverOpen(false);
                                        }}
                                        className="rounded-lg py-3 cursor-pointer"
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <div className="flex items-center gap-3">
                                            <div className={cn(
                                              "flex items-center justify-center w-8 h-8 rounded-full",
                                              isGroupSelected('Uncategorized') ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                            )}>
                                              <Users className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="font-semibold text-sm">Uncategorized</span>
                                              <span className="text-xs text-muted-foreground">
                                                {leads.filter(l => !l.leadListName).length} contacts
                                              </span>
                                            </div>
                                          </div>
                                          {isGroupSelected('Uncategorized') && (
                                            <Check className="w-4 h-4 text-primary" />
                                          )}
                                        </div>
                                      </CommandItem>
                                    )}

                                    {/* Map existing groups */}
                                    {groups.map((group) => {
                                      const selected = isGroupSelected(group.name);
                                      return (
                                        <CommandItem
                                          key={group.name}
                                          onSelect={() => {
                                            handleGroupToggle(group.name, selected);
                                            setIsGroupPopoverOpen(false);
                                          }}
                                          className="rounded-lg py-3 cursor-pointer"
                                        >
                                          <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-3">
                                              <div className={cn(
                                                "flex items-center justify-center w-8 h-8 rounded-full",
                                                selected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                              )}>
                                                <Users className="w-4 h-4" />
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="font-semibold text-sm">{group.name}</span>
                                                <span className="text-xs text-muted-foreground">{group.count} contacts</span>
                                              </div>
                                            </div>
                                            {selected && (
                                              <Check className="w-4 h-4 text-primary" />
                                            )}
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          
                          {/* Selected Groups Display */}
                          {(groups.some(g => isGroupSelected(g.name)) || isGroupSelected('Uncategorized')) && (
                            <div className="flex flex-wrap gap-2 mt-3 p-3 rounded-xl border border-dashed border-primary/20 bg-primary/5">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-full mb-1">Current Groups:</span>
                              {isGroupSelected('Uncategorized') && (
                                <Badge variant="secondary" className="bg-white border-primary/20 text-primary gap-1 pl-2 h-7 rounded-lg">
                                  Uncategorized
                                  <button type="button" onClick={() => handleGroupToggle('Uncategorized', true)} className="hover:text-red-500 ml-1">
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              )}
                              {groups.map(group => isGroupSelected(group.name) ? (
                                <Badge key={group.name} variant="secondary" className="bg-white border-primary/20 text-primary gap-1 pl-2 h-7 rounded-lg">
                                  {group.name}
                                  <button type="button" onClick={() => handleGroupToggle(group.name, true)} className="hover:text-red-500 ml-1">
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ) : null)}
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="individual" className="mt-4 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search manual leads..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 h-10 rounded-xl"
                        />
                      </div>

                      {loadingLeads ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                          <span className="text-muted-foreground">Loading leads...</span>
                        </div>
                      ) : filteredLeads.length === 0 ? (
                        <div className="text-center py-8 border rounded-xl bg-muted/20">
                          <p className="text-muted-foreground text-sm">No leads found.</p>
                        </div>
                      ) : (
                        <div className="border rounded-xl max-h-[300px] overflow-y-auto divide-y divide-border/50">
                          <div className="flex items-center p-3 sticky top-0 bg-white/80 backdrop-blur-md z-10 cursor-pointer" onClick={handleSelectAllLeads}>
                            <Checkbox 
                              checked={filteredLeads.length > 0 && filteredLeads.every(lead => formData.leadIds.includes(lead.id))}
                              onCheckedChange={handleSelectAllLeads}
                            />
                            <Label className="text-xs font-bold text-muted-foreground ml-3 uppercase tracking-wider cursor-pointer">
                              Select All Filtered Leads ({filteredLeads.length})
                            </Label>
                          </div>
                          {filteredLeads.map((lead) => (
                            <div 
                              key={lead.id} 
                              className={cn(
                                "flex items-center gap-3 p-3 transition-colors hover:bg-muted/30",
                                formData.leadIds.includes(lead.id) && "bg-primary/5"
                              )}
                              onClick={() => handleLeadSelection(lead.id)}
                            >
                              <Checkbox 
                                checked={formData.leadIds.includes(lead.id)}
                                onCheckedChange={() => {}} // Handled by div onClick
                              />
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate text-slate-900">
                                    {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[11px] font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded-md">
                                      {lead.leadListName || "Uncategorized"}
                                    </span>
                                    {lead.company && (
                                      <>
                                        <span className="text-muted-foreground/30 text-[10px]">•</span>
                                        <span className="text-[11px] text-muted-foreground font-medium">{lead.company}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium whitespace-nowrap">{lead.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                  
                  {/* Selection Summary */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white shadow-sm border border-border/50">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">
                        {formData.leadIds.length} lead(s) selected
                      </span>
                    </div>
                    {formData.leadIds.length > 0 && (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Ready
                      </Badge>
                    )}
                  </div>
                  
                  {errors.leadIds && (
                    <div className="flex items-center gap-2 text-sm text-red-600 px-1">
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
