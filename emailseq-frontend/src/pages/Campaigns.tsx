import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  Target, Loader2, Users, Mail, AlertCircle, CheckCircle2, Plus, 
  Eye, Edit, Trash2, Calendar, Clock, Play, Pause, MoreHorizontal,
  Filter, Search, RefreshCw, Check, ChevronsUpDown, X
} from "lucide-react";
import { toast } from "sonner";
import { api, Contact, Sequence, Campaign } from "@/lib/api";

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

const Campaigns = () => {
  const navigate = useNavigate();
  
  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  
  // Campaign details modal
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [campaignLeads, setCampaignLeads] = useState<Contact[]>([]);
  const [loadingCampaignDetails, setLoadingCampaignDetails] = useState(false);
  
  // Delete confirmation states
  const [showDeleteCampaignDialog, setShowDeleteCampaignDialog] = useState(false);
  const [showDeleteLeadDialog, setShowDeleteLeadDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Contact | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leadsSearchTerm, setLeadsSearchTerm] = useState("");
  const [warmupStatus, setWarmupStatus] = useState({ isEnabled: false, reached: false });
  const [activeTab, setActiveTab] = useState("groups");
  const [isGroupPopoverOpen, setIsGroupPopoverOpen] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadCampaigns();
    loadSequences(); 
    loadWarmupStatus();
    loadGroups();
  }, []);

  // Validate form whenever formData changes
  useEffect(() => {
    if (showCreateForm) {
      validateForm();
    }
  }, [formData, showCreateForm]);

  const loadCampaigns = async () => {
    try {
      setLoadingCampaigns(true);
      const response = await api.getCampaigns({ limit: 100 });
      setCampaigns(response.campaigns);
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast.error("Failed to load campaigns");
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const loadWarmupStatus = async () => {
    try {
      const status = await api.getWarmupSettings();
      if (status) {
        setWarmupStatus({
          isEnabled: status.isEnabled,
          reached: status.isEnabled && (Number(status.dailySentCount) >= Number(status.currentBatchSize))
        });
      }
    } catch (error) {
      console.error("Error loading warmup status:", error);
    }
  };

  const loadCampaignDetails = async (campaignId: string) => {
    try {
      setLoadingCampaignDetails(true);
      console.log('🔍 Loading campaign details for ID:', campaignId);
      
      const campaign = await api.getCampaign(campaignId);
      console.log('📊 Campaign data received:', {
        id: campaign.id,
        campaignName: campaign.campaignName,
        isActive: campaign.isActive,
        sequenceId: campaign.sequenceId,
        leadsCount: campaign.leads?.length || 0,
        hasSequence: !!campaign.sequence,
        sequenceName: campaign.sequence?.name
      });
      
      // Ensure we have the complete campaign data
      if (!campaign.id || !campaign.campaignName) {
        throw new Error('Invalid campaign data received from server');
      }
      
      setSelectedCampaign(campaign);
      setCampaignLeads(campaign.leads || []);
      
      console.log('✅ Campaign details loaded successfully:', {
        campaignName: campaign.campaignName,
        leadsCount: campaign.leads?.length || 0,
        sequenceId: campaign.sequenceId,
        status: campaign.isActive ? 'Active' : 'Inactive'
      });
    } catch (error: any) {
      console.error('❌ Error loading campaign details:', error);
      
      if (error.status === 404) {
        toast.error("Campaign not found. It may have been deleted.");
        setShowDetailsModal(false);
      } else {
        toast.error(error.message || "Failed to load campaign details");
      }
      
      // Reset states on error
      setSelectedCampaign(null);
      setCampaignLeads([]);
    } finally {
      setLoadingCampaignDetails(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!selectedCampaign?.id) {
      console.error('❌ No campaign selected for deletion');
      toast.error("No campaign selected");
      return;
    }
    
    try {
      setDeletingCampaign(true);
      console.log('🗑 Deleting campaign:', {
        id: selectedCampaign.id,
        name: selectedCampaign.campaignName
      });
      
      await api.deleteCampaign(selectedCampaign.id);
      
toast.success(`Campaign "${selectedCampaign.campaignName}" deleted successfully`);

      
      // Close all modals and reset states
      setShowDeleteCampaignDialog(false);
      setShowDetailsModal(false);
      setSelectedCampaign(null);
      setCampaignLeads([]);
      
      // Refresh the campaigns list
      await loadCampaigns();
      
      console.log('✅ Campaign deleted and list refreshed');
    } catch (error: any) {
      console.error('❌ Error deleting campaign:', error);
      
      if (error.status === 404 || error.message?.includes('not found')) {
        toast.error("Campaign not found. It may have already been deleted.");
        // Close modals and refresh list even on 404
        setShowDeleteCampaignDialog(false);
        setShowDetailsModal(false);
        setSelectedCampaign(null);
        setCampaignLeads([]);
        await loadCampaigns();
      } else if (error.status === 403) {
        toast.error("You don't have permission to delete this campaign.");
      } else {
        toast.error(error.message || "Failed to delete campaign. Please try again.");
      }
    } finally {
      setDeletingCampaign(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    
    try {
      setDeletingLead(true);
      await api.deleteContact(leadToDelete.id);
      toast.success("Lead deleted successfully");
      
      // Remove the lead from the local state immediately
      setCampaignLeads(prev => prev.filter(lead => lead.id !== leadToDelete.id));
      
      setShowDeleteLeadDialog(false);
      setLeadToDelete(null);
    } catch (error: any) {
      console.error("Error deleting lead:", error);
      toast.error(error.message || "Failed to delete lead");
    } finally {
      setDeletingLead(false);
    }
  };

  const handleViewCampaign = (campaign: Campaign) => {
    console.log('👁 Opening campaign details for:', {
      id: campaign.id,
      name: campaign.campaignName
    });
    
    // Reset states before loading new data
    setSelectedCampaign(null);
    setCampaignLeads([]);
    
    // Open modal and load fresh data
    setShowDetailsModal(true);
    loadCampaignDetails(campaign.id);
  };

  const loadGroups = async () => {
    try {
      setLoadingGroups(true);
      const data = await api.getContactGroups();
      setGroups(data);
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadLeads = async () => {
    try {
      setLoadingLeads(true);
      const response = await api.getContacts({ limit: 100 });
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
      // Fetch all sequences (not just active ones) for proper name mapping in the campaigns list
      const response = await api.getSequences({ limit: 100 });
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
    
    if (!formData.campaignName || formData.campaignName.trim().length === 0) {
      newErrors.campaignName = "Campaign name is required";
    } else if (formData.campaignName.trim().length < 3) {
      newErrors.campaignName = "Campaign name must be at least 3 characters";
    }
    
    if (!formData.sequenceId || formData.sequenceId.trim().length === 0) {
      newErrors.sequenceId = "Email sequence selection is required";
    }
    
    if (!formData.leadIds || formData.leadIds.length === 0) {
      newErrors.leadIds = "At least one lead must be selected";
    }
    
    if (formData.startDate && formData.startDate.trim().length > 0) {
      const startDate = new Date(formData.startDate);
      if (isNaN(startDate.getTime())) {
        newErrors.startDate = "Please enter a valid start date";
      }
    }
    
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

  const handleGroupToggle = (groupName: string, currentlySelected: boolean) => {
    const groupLeads = leads.filter(lead => {
      const leadGroup = lead.leadListName || 'Uncategorized';
      return leadGroup === groupName;
    });
    
    const groupLeadIds = groupLeads.map(l => l.id);
    
    if (currentlySelected) {
      // Remove all leads in this group
      setFormData(prev => ({
        ...prev,
        leadIds: prev.leadIds.filter(id => !groupLeadIds.includes(id))
      }));
    } else {
      // Add all leads in this group
      setFormData(prev => ({
        ...prev,
        leadIds: [...new Set([...prev.leadIds, ...groupLeadIds])]
      }));
    }
  };

  const isGroupSelected = (groupName: string) => {
    const groupLeads = leads.filter(lead => {
      const leadGroup = lead.leadListName || 'Uncategorized';
      return leadGroup === groupName;
    });
    
    if (groupLeads.length === 0) return false;
    return groupLeads.every(lead => formData.leadIds.includes(lead.id));
  };

  const handleSelectAllLeads = () => {
    const searchLower = leadsSearchTerm.toLowerCase();
    const filteredLeads = leads.filter(lead => {
      const fullName = `${(lead.firstName || '')} ${(lead.lastName || '')}`.trim();
      return fullName.toLowerCase().includes(searchLower) || 
             lead.email.toLowerCase().includes(searchLower) ||
             (lead.company && lead.company.toLowerCase().includes(searchLower));
    });
    
    const filteredLeadIds = filteredLeads.map(lead => lead.id);
    const areAllFilteredSelected = filteredLeadIds.every(id => formData.leadIds.includes(id));
    
    if (areAllFilteredSelected) {
      setFormData(prev => ({
        ...prev,
        leadIds: prev.leadIds.filter(id => !filteredLeadIds.includes(id))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        leadIds: Array.from(new Set([...prev.leadIds, ...filteredLeadIds]))
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      toast.error("Please fix all validation errors before submitting");
      return;
    }

    // CHECK WARMUP LIMIT
    if (warmupStatus.reached) {
      const proceed = window.confirm("⚠️ Daily sending limit reached!\n\nAny emails from this campaign will be automatically scheduled for tomorrow. Do you want to proceed?");
      if (!proceed) return;
    }

    try {
      setIsSubmitting(true);
      
      const campaignData = {
        campaign_name: formData.campaignName.trim(),
        description: formData.description.trim() || undefined,
        sequence_id: formData.sequenceId,
        lead_ids: formData.leadIds,
        start_date: formData.startDate.trim() || undefined,
        end_date: formData.endDate.trim() || undefined
      };

      await api.createCampaign(campaignData);
      
      toast.success("Campaign created successfully!");
      setShowCreateForm(false);
      setLeadsSearchTerm(""); // Reset search term
      setFormData({
        campaignName: "",
        description: "",
        sequenceId: "",
        leadIds: [],
        startDate: "",
        endDate: ""
      });
      setErrors({});
      
      // Refresh campaigns list
      await loadCampaigns();
      
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast.error(error.message || "Failed to create campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowCreateForm = () => {
    setShowCreateForm(true);
    setLeadsSearchTerm(""); // Reset search term when opening modal
    loadLeads();
    loadSequences(); // Load all sequences for mapping purposes
  };

  const getStatusBadge = (campaign: Campaign) => {
    const now = new Date();
    const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
    const endDate = campaign.endDate ? new Date(campaign.endDate) : null;
    
    if (!campaign.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    if (endDate && now > endDate) {
      return <Badge variant="outline">Completed</Badge>;
    }
    
    if (startDate && now < startDate) {
      return <Badge variant="default">Upcoming</Badge>;
    }
    
    return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
  };

  // Filter campaigns based on search and status
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.campaignName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    
    const now = new Date();
    const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
    const endDate = campaign.endDate ? new Date(campaign.endDate) : null;
    
    let status = "active";
    if (!campaign.isActive) status = "inactive";
    else if (endDate && now > endDate) status = "completed";
    else if (startDate && now < startDate) status = "upcoming";
    
    return matchesSearch && status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />

      <main className="container mx-auto px-6 pt-24 pb-12">
        {/* Warmup Alert Banner */}
        {warmupStatus.reached && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-900">Daily Warmup Limit Reached!</h3>
                <p className="text-sm text-red-700">You've reached your daily sending limit. New emails will be automatically queued for tomorrow morning to protect your reputation.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Target className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2 text-slate-900">Campaign Management</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Create, manage, and track your email campaigns
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleShowCreateForm}
              className="gradient-primary text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </motion.div>

        {/* Campaigns List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass shadow-card">
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    All Campaigns
                  </CardTitle>
                  <CardDescription>
                    {campaigns.length} total campaigns
                  </CardDescription>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  {/* Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search campaigns..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full"
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Refresh */}
                  <Button
                    onClick={loadCampaigns}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={loadingCampaigns}
                  >
                  <RefreshCw className={`w-4 h-4 mr-2 sm:mr-0 ${loadingCampaigns ? 'animate-spin' : ''}`} />
                  <span className="sm:hidden">Refresh</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Loading campaigns...</span>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || statusFilter !== "all" ? "No campaigns found" : "No campaigns yet"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search or filters" 
                      : "Create your first campaign to get started"
                    }
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Button onClick={handleShowCreateForm} className="gradient-primary text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Campaign
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign Name</TableHead>
                        <TableHead>Sequence</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((campaign) => (
                        <TableRow key={campaign.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div>
                              <div className="font-medium">{campaign.campaignName}</div>
                              {campaign.description && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {campaign.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {campaign.sequence?.name || 
                                 sequences.find(s => s.id === campaign.sequenceId)?.name || 
                                 (campaign.sequenceId ? `ID: ${campaign.sequenceId.substring(0, 8)}...` : 'Unknown Sequence')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {campaign.startDate ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {new Date(campaign.startDate).toLocaleDateString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not set</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {campaign.endDate ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {new Date(campaign.endDate).toLocaleDateString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not set</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(campaign)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={() => handleViewCampaign(campaign)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Create Campaign Modal */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
       <DialogContent
  className="sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-white shadow-2xl border border-gray-200 rounded-2xl top-0 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] p-5 sm:p-6"
  style={{ backgroundColor: 'white' }}
>

          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Create New Campaign</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
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
            </div>

            {/* Lead Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Select Leads *
                </Label>
              </div>

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
                      <p className="text-sm text-muted-foreground">Select one or more lead groups to add all their active contacts.</p>
                      
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
                            <CommandInput placeholder="Search group name..." className="h-11 border-b" />
                            <CommandList className="max-h-[300px]">
                              <CommandEmpty className="py-6 text-center text-muted-foreground">
                                No lead groups found.
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
                      value={leadsSearchTerm}
                      onChange={(e) => setLeadsSearchTerm(e.target.value)}
                      className="pl-10 h-10 rounded-xl"
                    />
                  </div>

                  {loadingLeads ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                      <span className="text-muted-foreground">Loading leads...</span>
                    </div>
                  ) : (
                    <div className="border rounded-xl max-h-[300px] overflow-y-auto divide-y divide-border/50">
                      <div className="flex items-center p-3 sticky top-0 bg-white/80 backdrop-blur-md z-10 cursor-pointer" onClick={handleSelectAllLeads}>
                        <Checkbox 
                          checked={(() => {
                            const searchLower = leadsSearchTerm.toLowerCase();
                            const filtered = leads.filter(lead => {
                              const fullName = `${(lead.firstName || '')} ${(lead.lastName || '')}`.trim();
                              return fullName.toLowerCase().includes(searchLower) || 
                                     lead.email.toLowerCase().includes(searchLower) ||
                                     (lead.company && lead.company.toLowerCase().includes(searchLower));
                            });
                            return filtered.length > 0 && filtered.every(lead => formData.leadIds.includes(lead.id));
                          })()}
                          onCheckedChange={handleSelectAllLeads}
                        />
                        <Label className="text-xs font-bold text-muted-foreground ml-3 uppercase tracking-wider cursor-pointer">
                          Select All Filtered Leads
                        </Label>
                      </div>

                      {leads.filter(lead => {
                        const searchLower = leadsSearchTerm.toLowerCase();
                        const fullName = `${(lead.firstName || '')} ${(lead.lastName || '')}`.trim();
                        return fullName.toLowerCase().includes(searchLower) || 
                               lead.email.toLowerCase().includes(searchLower) ||
                               (lead.company && lead.company.toLowerCase().includes(searchLower));
                      }).map((lead) => (
                        <div 
                          key={lead.id} 
                          className={cn(
                            "flex items-center gap-3 p-3 transition-colors hover:bg-muted/30 cursor-pointer",
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
                onClick={() => {
                  setShowCreateForm(false);
                  setLeadsSearchTerm(""); // Reset search term when canceling
                }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              
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
          </form>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Modal */}
      <AnimatePresence>
        {showDetailsModal && (
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto bg-slate-50 p-0 overflow-hidden border-none shadow-luxury top-0 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] rounded-2xl"
  style={{ backgroundColor: 'white' }}
>

          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Campaign Details</DialogTitle>
          </DialogHeader>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {loadingCampaignDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
                <span className="text-gray-600">Loading campaign details...</span>
              </div>
            ) : selectedCampaign ? (
            <div className="space-y-6 mt-6">
              {/* Campaign Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                  <Label className="text-sm font-medium text-gray-600">Campaign Name</Label>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">{selectedCampaign.campaignName}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
                  <Label className="text-sm font-medium text-gray-600">Status</Label>
                  <div className="mt-2">{getStatusBadge(selectedCampaign)}</div>
                </div>
              </div>
              
              {selectedCampaign.description && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Label className="text-sm font-medium text-gray-600">Description</Label>
                  <p className="mt-2 text-gray-800 leading-relaxed">{selectedCampaign.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
                  <Label className="text-sm font-medium text-gray-600">Start Date</Label>
                  <p className="mt-2 text-md sm:text-lg font-semibold text-gray-900">
                    {selectedCampaign.startDate 
                      ? new Date(selectedCampaign.startDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : "Not set"
                    }
                  </p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-xl border border-orange-100">
                  <Label className="text-sm font-medium text-gray-600">End Date</Label>
                  <p className="mt-2 text-md sm:text-lg font-semibold text-gray-900">
                    {selectedCampaign.endDate 
                      ? new Date(selectedCampaign.endDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : "Not set"
                    }
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-xl border border-teal-100">
                <Label className="text-sm font-medium text-gray-600">Email Sequence</Label>
                <p className="mt-2 text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-teal-600" />
                  {selectedCampaign.sequence?.name || 
                   sequences.find((s) => s.id === selectedCampaign.sequenceId)?.name || 
                   (selectedCampaign.sequenceId ? `ID: ${selectedCampaign.sequenceId.substring(0, 8)}...` : 'Unknown Sequence')}
                </p>
                {selectedCampaign.sequence?.description && (
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedCampaign.sequence.description}
                  </p>
                )}
              </div>

              {/* Leads Section */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                  <Label className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    Campaign Leads ({campaignLeads.length})
                  </Label>
                </div>
                
                {loadingCampaignDetails ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-gray-600">Loading campaign leads...</p>
                  </div>
                ) : campaignLeads.length === 0 ? (
                  <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border border-gray-200">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Leads Found</h3>
                    <p className="text-gray-600">
                      This campaign doesn't have any leads assigned yet.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                    {/* Desktop Table View */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">Name</TableHead>
                            <TableHead className="whitespace-nowrap">Email</TableHead>
                            <TableHead className="whitespace-nowrap">Company</TableHead>
                            <TableHead className="whitespace-nowrap">Status</TableHead>
                            <TableHead className="w-16">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campaignLeads.map((lead) => (
                            <TableRow key={lead.id} className="hover:bg-blue-50 transition-colors duration-200">
                              <TableCell>
                                <div className="font-medium">
                                  {`${(lead.firstName || '')} ${(lead.lastName || '')}`.trim() || 'N/A'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{lead.email}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{lead.company || 'N/A'}</div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={lead.status === 'ACTIVE' ? 'default' : 'secondary'}
                                  className={lead.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : ''}
                                >
                                  {lead.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  onClick={() => {
                                    setLeadToDelete(lead);
                                    setShowDeleteLeadDialog(true);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Delete Lead"
                                >
                                  🗑
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="sm:hidden divide-y divide-gray-100">
                      {campaignLeads.map((lead) => (
                        <div key={lead.id} className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 truncate">
                              {`${(lead.firstName || '')} ${(lead.lastName || '')}`.trim() || lead.email}
                            </div>
                            <div className="text-xs text-gray-500 truncate mt-0.5">{lead.email}</div>
                            {lead.company && (
                              <div className="text-[10px] text-primary bg-primary/5 inline-block px-1.5 py-0.5 rounded-md mt-1 font-medium">
                                {lead.company}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className={cn(
                              "w-6 h-2 rounded-full shadow-sm",
                              lead.status === 'ACTIVE' ? "bg-[#0d7a5f]" : "bg-slate-300"
                            )} title={lead.status || 'ACTIVE'} />
                            <Button
                              onClick={() => {
                                setLeadToDelete(lead);
                                setShowDeleteLeadDialog(true);
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive bg-destructive/5 hover:bg-destructive/10 rounded-lg"
                            >
                              🗑
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <Button
                  onClick={() => setShowDetailsModal(false)}
                  variant="outline"
                  className="rounded-xl px-6 py-2 border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Close
                </Button>
                
                <Button
                  onClick={() => setShowDeleteCampaignDialog(true)}
                  variant="destructive"
                  className="rounded-xl px-6 py-2 bg-red-600 hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Campaign
                </Button>
              </div>
            </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign Not Found</h3>
                <p className="text-gray-600 mb-4">Unable to load campaign details. The campaign may have been deleted.</p>
                <Button
                  onClick={() => {
                    setShowDetailsModal(false);
                    loadCampaigns();
                  }}
                  variant="outline"
                  className="rounded-xl"
                >
                  Refresh Campaigns
                </Button>
              </div>
            )}
          </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Delete Campaign Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteCampaignDialog && (
          <Dialog open={showDeleteCampaignDialog} onOpenChange={setShowDeleteCampaignDialog}>
            <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-lg shadow-2xl border border-red-200 rounded-2xl top-0 translate-y-0 sm:top-[50%] sm:translate-y-[-50%]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-700">Delete Campaign</DialogTitle>
            </DialogHeader>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 mt-4"
            >
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-800">Are you sure you want to delete this campaign?</p>
                  <p className="text-sm text-red-600 mt-1">
                    This action cannot be undone. The campaign "{selectedCampaign?.campaignName}" and all its associated data will be permanently deleted.
                  </p>
                  {campaignLeads.length > 0 && (
                    <p className="text-xs text-red-500 mt-2">
                      ⚠ This will also remove {campaignLeads.length} lead{campaignLeads.length !== 1 ? 's' : ''} from this campaign.
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-4">
                <Button
                  onClick={() => setShowDeleteCampaignDialog(false)}
                  variant="outline"
                  disabled={deletingCampaign}
                  className="rounded-xl px-6 py-2 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteCampaign}
                  variant="destructive"
                  disabled={deletingCampaign}
                  className="rounded-xl px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingCampaign ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Campaign
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Delete Lead Confirmation Dialog */}
      <Dialog open={showDeleteLeadDialog} onOpenChange={setShowDeleteLeadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive">Delete Lead</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-xl">
              <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Are you sure you want to delete this lead?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete "{leadToDelete?.firstName} {leadToDelete?.lastName}" ({leadToDelete?.email}) from the system.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowDeleteLeadDialog(false);
                  setLeadToDelete(null);
                }}
                variant="outline"
                disabled={deletingLead}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteLead}
                variant="destructive"
                disabled={deletingLead}
              >
                {deletingLead ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Lead
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Campaigns;