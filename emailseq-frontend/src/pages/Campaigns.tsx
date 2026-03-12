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
import { 
  Target, Loader2, Users, Mail, AlertCircle, CheckCircle2, Plus, 
  Eye, Edit, Trash2, Calendar, Clock, Play, Pause, MoreHorizontal,
  Filter, Search, RefreshCw
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingSequences, setLoadingSequences] = useState(false);
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

  // Load data on component mount
  useEffect(() => {
    loadCampaigns();
    loadSequences(); // Load sequences so they are available for mapping names in the table
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

  const handleSelectAllLeads = () => {
    setFormData(prev => ({
      ...prev,
      leadIds: prev.leadIds.length === leads.length ? [] : leads.map(lead => lead.id)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      toast.error("Please fix all validation errors before submitting");
      return;
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

      <main className="container mx-auto px-6 pt-20 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">Campaign Management</h1>
                <p className="text-muted-foreground">
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    All Campaigns
                  </CardTitle>
                  <CardDescription>
                    {campaigns.length} total campaigns
                  </CardDescription>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search campaigns..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
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
                    disabled={loadingCampaigns}
                  >
                  <RefreshCw className={`w-4 h-4 ${loadingCampaigns ? 'animate-spin' : ''}`} />

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
  className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl border border-gray-200 rounded-2xl"
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
                <div className={`border rounded-xl p-4 max-h-[300px] overflow-y-auto bg-white ${errors.leadIds ? 'border-red-500' : ''}`}>
                  {/* Search Bar */}
                  <div className="mb-3 pb-3 border-b">
                    <Input
                      placeholder="Search leads..."
                      value={leadsSearchTerm}
                      onChange={(e) => setLeadsSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  {(() => {
                    // Filter leads based on search term
                    const filteredLeads = leads.filter((lead) => {
                      const searchLower = leadsSearchTerm.toLowerCase();
                     const fullName = `${(lead.firstName || '')} ${(lead.lastName || '')}`.trim();

                      return (
                        fullName.toLowerCase().includes(searchLower) ||
                        lead.email.toLowerCase().includes(searchLower) ||
                        (lead.company && lead.company.toLowerCase().includes(searchLower))
                      );
                    });
                    
                    return (
                      <>
                        {/* Select All */}
                        <div className="flex items-center space-x-2 mb-3 pb-3 border-b">
                          <Checkbox 
                            checked={filteredLeads.length > 0 && filteredLeads.every(lead => formData.leadIds.includes(lead.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // Add all filtered leads to selection
                                const newLeadIds = [...new Set([...formData.leadIds, ...filteredLeads.map(lead => lead.id)])];
                                setFormData(prev => ({ ...prev, leadIds: newLeadIds }));
                              } else {
                                // Remove all filtered leads from selection
                                const filteredLeadIds = filteredLeads.map(lead => lead.id);
                                const newLeadIds = formData.leadIds.filter(id => !filteredLeadIds.includes(id));
                                setFormData(prev => ({ ...prev, leadIds: newLeadIds }));
                              }
                            }}
                          />
                          <Label className="text-sm font-medium">
                            Select All {leadsSearchTerm ? 'Filtered' : 'Active'} Leads ({filteredLeads.length})
                          </Label>
                        </div>
                        
                        {/* Individual Leads */}
                        <div className="space-y-2">
                          {filteredLeads.length === 0 && leadsSearchTerm ? (
                            <div className="text-center py-4 text-muted-foreground">
                              <p>No leads found matching "{leadsSearchTerm}"</p>
                            </div>
                          ) : (
                            filteredLeads.map((lead) => (
                              <div key={lead.id} className="flex items-center space-x-2 py-1">
                                <Checkbox 
                                  checked={formData.leadIds.includes(lead.id)}
                                  onCheckedChange={() => handleLeadSelection(lead.id)}
                                />
                                <Label className="text-sm cursor-pointer flex-1">
                                  <div className="flex items-center justify-between">
                                    <span>
                                     {`${(lead.firstName || '')} ${(lead.lastName || '')}`.trim() || lead.email}

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
                            ))
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              
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
          <DialogContent
  className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white shadow-xl border border-gray-200 rounded-2xl"
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
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                  <Label className="text-sm font-medium text-gray-600">Campaign Name</Label>
                  <p className="text-xl font-bold text-gray-900 mt-1">{selectedCampaign.campaignName}</p>
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
              
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
                  <Label className="text-sm font-medium text-gray-600">Start Date</Label>
                  <p className="mt-2 text-lg font-semibold text-gray-900">
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
                  <p className="mt-2 text-lg font-semibold text-gray-900">
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
                <div className="flex items-center justify-between mb-6">
                  <Label className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Status</TableHead>
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
            <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-lg shadow-2xl border border-red-200 rounded-2xl">
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