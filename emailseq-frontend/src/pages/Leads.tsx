import * as React from "react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Download, Plus, Search, Loader2, Users, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { api, Contact } from "@/lib/api";

interface Lead extends Contact {
  lastContacted?: string;
}

const Leads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [newLead, setNewLead] = useState({
    email: "",
    firstName: "",
    lastName: "",
    company: "",
    leadListName: "",
    timezone: "UTC"
  });

  const [groups, setGroups] = useState<Array<{ name: string; count: number }>>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [uploadGroupName, setUploadGroupName] = useState("");
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [isUploadPopoverOpen, setIsUploadPopoverOpen] = useState(false);


  // Delete functionality state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoadingGroups(true);
      const data = await api.getContactGroups();
      
      // Calculate total count for "All Leads"
      const totalCount = data.reduce((acc, curr) => acc + curr.count, 0);
      
      // Add "All Leads" at the beginning
      const updatedGroups = [
        { name: "All Leads", count: totalCount },
        ...data
      ];
      
      setGroups(updatedGroups);
    } catch (error) {
      console.error("Error loading groups:", error);
      toast.error("Failed to load lead groups");
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadContacts = async (groupName: string | null = selectedGroupName) => {
    try {
      setLoading(true);
      const params: any = { limit: 1000 };
      
      if (groupName === 'All Leads') {
        // No leadListName param to fetch all
      } else if (groupName && groupName !== 'Uncategorized') {
        params.leadListName = groupName;
      } else if (groupName === 'Uncategorized') {
        params.leadListName = null;
      }
      
      const response = await api.getContacts(params);
      setLeads(response.contacts);
    } catch (error) {
      toast.error("Failed to load contacts");
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupClick = (groupName: string) => {
    setSelectedGroupName(groupName);
    loadContacts(groupName);
  };

  const handleBackToGroups = () => {
    setSelectedGroupName(null);
    loadGroups();
  };


  const handleSelectContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    const activeLeads = filteredLeads.filter(lead => lead.status === 'ACTIVE');
    if (selectedContacts.length === activeLeads.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(activeLeads.map(lead => lead.id));
    }
  };

  const handleAddLead = async () => {
    if (!newLead.email) {
      toast.error("Email is required");
      return;
    }

    try {
      const contact = await api.createContact({
        email: newLead.email,
        firstName: newLead.firstName || undefined,
        lastName: newLead.lastName || undefined,
        company: newLead.company || undefined,
        leadListName: newLead.leadListName || undefined,
        timezone: newLead.timezone,
        status: "ACTIVE"
      });
      
      // Refresh groups and contacts based on current view
      if (selectedGroupName) {
        loadContacts(selectedGroupName);
      }
      loadGroups(); // Always refresh groups to update counts
      
      setIsAddDialogOpen(false);
      setNewLead({ email: "", firstName: "", lastName: "", company: "", leadListName: "", timezone: "UTC" });
      toast.success("Contact added successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to add contact");
    }
  };

  const handleUploadExcel = () => {
    setIsUploadDialogOpen(true);
    setSelectedFile(null);
  };

  const processFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    try {
      setUploading(true);
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const contacts = jsonData.map((row: any) => ({
        email: row.email || row.Email,
        firstName: row.firstName || row.FirstName || row.first_name,
        lastName: row.lastName || row.LastName || row.last_name,
        company: row.company || row.Company,
        leadListName: uploadGroupName || undefined,
        timezone: "UTC",
        status: "ACTIVE" as const
      })).filter(contact => contact.email);

      if (contacts.length === 0) {
        toast.error("No valid contacts found in file");
        return;
      }

      const result = await api.bulkImportContacts(contacts);
      toast.success(`Imported ${result.created} contacts, skipped ${result.skipped}`);
      
      // Refresh groups and contacts based on current view
      if (selectedGroupName) {
        loadContacts(selectedGroupName);
      }
      loadGroups(); // Always refresh groups to update counts

      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadGroupName("");
    } catch (error) {
      toast.error("Failed to import contacts");
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      { email: "john@example.com", firstName: "John", lastName: "Doe", company: "Example Inc" },
      { email: "jane@example.com", firstName: "Jane", lastName: "Smith", company: "Tech Solutions" }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, "sample-leads.csv");
    toast.success("Sample CSV downloaded");
  };

  const handleDownloadReport = () => {
    const exportData = leads.map(lead => ({
      Name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email,
      Email: lead.email,
      Company: lead.company || '',
      'Lead List': lead.leadListName || 'Uncategorized',
      Status: lead.status,
      'Created At': new Date(lead.createdAt).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    XLSX.writeFile(workbook, "contacts-report.xlsx");
    toast.success("Report downloaded successfully");
  };

  // Delete functionality
  const handleDeleteContact = (contact: Lead) => {
    setContactToDelete(contact);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete) return;

    try {
      setDeleting(true);
      await api.deleteContact(contactToDelete.id);
      
      // Remove from UI immediately
      setLeads(leads.filter(lead => lead.id !== contactToDelete.id));
      
      // Clear selection if deleted contact was selected
      setSelectedContacts(prev => prev.filter(id => id !== contactToDelete.id));
      
      toast.success(`Contact ${contactToDelete.email} deleted successfully`);
      setIsDeleteDialogOpen(false);
      setContactToDelete(null);

      // Refresh groups and contacts based on current view
      if (selectedGroupName) {
        loadContacts(selectedGroupName);
      }
      loadGroups(); // Always refresh groups to update counts
    } catch (error: any) {
      toast.error(error.message || "Failed to delete contact");
      console.error("Error deleting contact:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedContacts.length === 0) {
      toast.error("Please select contacts to delete");
      return;
    }
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedContacts.length === 0) return;

    try {
      setBulkDeleting(true);
      const result = await api.bulkDeleteContacts(selectedContacts);
      
      // Remove deleted contacts from UI immediately
      setLeads(leads.filter(lead => !selectedContacts.includes(lead.id)));
      
      // Clear selections
      setSelectedContacts([]);
      
      toast.success(`Successfully deleted ${result.deleted} contact(s)`);
      
      setIsBulkDeleteDialogOpen(false);

      // Refresh groups and contacts based on current view
      if (selectedGroupName) {
        loadContacts(selectedGroupName);
      }
      loadGroups(); // Always refresh groups to update counts
    } catch (error: any) {
      toast.error(error.message || "Failed to delete contacts");
      console.error("Error deleting contacts:", error);
    } finally {
      setBulkDeleting(false);
    }
  };


  const getStatusBadge = (status: Contact["status"]) => {
    const variants = {
      ACTIVE: "bg-green-100 text-green-700 hover:bg-green-100",
      UNSUBSCRIBED: "bg-red-100 text-red-700 hover:bg-red-100",
      BOUNCED: "bg-orange-100 text-orange-700 hover:bg-orange-100",
      INACTIVE: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    };

    return (
      <Badge className={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
      </Badge>
    );
  };

  const filteredLeads = leads.filter(lead => 
    lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderLeadsContent = () => {
    if (selectedGroupName === null) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 shadow-card hover-lift"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-800">Lead Groups</h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl glass h-10 w-full"
              />
            </div>
          </div>
          
          {loadingGroups ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading groups...</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No leads found. Add or import contacts to see groups here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase())).map((group, index) => (
                <motion.div
                  key={group.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleGroupClick(group.name)}
                  className="group relative overflow-hidden bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Users className="w-6 h-6" />
                    </div>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-bold border-none">
                      {group.count} Leads
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Grouped by list name
                  </p>
                  
                  <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Plus className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      );
    }

    return (
      <>
        {/* Back Button and Group Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToGroups}
              className="text-muted-foreground hover:text-foreground hover:bg-white/50"
            >
              <Users className="w-4 h-4 mr-2" />
              Back to Groups
            </Button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedGroupName}</h2>
              <p className="text-sm text-muted-foreground">{leads.length} contacts found</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={`Search in ${selectedGroupName}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl glass"
            />
          </div>
        </motion.div>



        {/* Leads Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 shadow-card hover-lift"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading contacts...</span>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedContacts.length === filteredLeads.filter(lead => lead.status === 'ACTIVE').length && filteredLeads.filter(lead => lead.status === 'ACTIVE').length > 0}
                      onCheckedChange={() => handleSelectAll()}
                    />
                  </TableHead>
                  {selectedGroupName === "All Leads" && (
                    <TableHead className="font-semibold">Lead List</TableHead>
                  )}
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Last Contacted</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No contacts found matching your search." : "No contacts yet in this group."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead, index) => (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-border/50 hover:bg-muted/50 transition-smooth"
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedContacts.includes(lead.id)}
                          onCheckedChange={() => handleSelectContact(lead.id)}
                          disabled={lead.status !== 'ACTIVE'}
                        />
                      </TableCell>
                      {selectedGroupName === "All Leads" && (
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50/50 text-blue-600 border-blue-100">
                            {lead.leadListName || "Uncategorized"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleDeleteContact(lead)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={deleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          )}

          {/* Stats Summary */}
          {!loading && filteredLeads.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div 
                  className="text-center p-4 rounded-xl bg-primary/5 transition-smooth hover:bg-primary/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <p className="text-2xl font-bold text-primary">
                    {leads.filter((l) => l.status === "ACTIVE").length}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">Active</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {leads.length > 0 ? ((leads.filter((l) => l.status === "ACTIVE").length / leads.length) * 100).toFixed(0) : 0}% of group
                  </p>
                </motion.div>
                <motion.div 
                  className="text-center p-4 rounded-xl bg-secondary/5 transition-smooth hover:bg-secondary/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <p className="text-2xl font-bold text-secondary">
                    {leads.filter((l) => l.status === "UNSUBSCRIBED").length}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">Unsubscribed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {leads.length > 0 ? ((leads.filter((l) => l.status === "UNSUBSCRIBED").length / leads.length) * 100).toFixed(0) : 0}% of group
                  </p>
                </motion.div>
                <motion.div 
                  className="text-center p-4 rounded-xl bg-accent/5 transition-smooth hover:bg-accent/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <p className="text-2xl font-bold text-accent">
                    {leads.length}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">Group Contacts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leads in this specific list
                  </p>
                </motion.div>
              </div>
            </div>
          )}
        </motion.div>
      </>
    );
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
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-slate-900">Leads</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Manage your leads and enroll them in email sequences
              </p>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              {selectedContacts.length > 0 && (
                <Button
                  onClick={handleBulkDelete}
                  variant="destructive"
                  className="rounded-xl shadow-luxury h-10 w-full sm:w-auto"
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete ({selectedContacts.length})
                    </>
                  )}
                </Button>
              )}

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-xl border-primary/20 hover:border-primary h-10 flex-1 sm:flex-none"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newLead.email}
                        onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                        placeholder="contact@company.com"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={newLead.firstName}
                          onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })}
                          placeholder="John"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={newLead.lastName}
                          onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })}
                          placeholder="Doe"
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={newLead.company}
                        onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                        placeholder="Company Inc."
                        className="rounded-xl"
                      />
                    </div>
                     <div className="grid gap-2">
                      <Label htmlFor="leadListName">Lead List Name (e.g. Real Estate, Tech)</Label>
                      <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between rounded-xl font-normal h-10 px-3",
                              !newLead.leadListName && "text-muted-foreground"
                            )}
                          >
                            {newLead.leadListName || "Select or type a group..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search or type new group name..." 
                              onValueChange={(val) => setNewLead({ ...newLead, leadListName: val })}
                            />
                            <CommandList>
                              <CommandEmpty 
                                className="py-2 px-4 cursor-pointer hover:bg-accent text-sm" 
                                onClick={() => {
                                  setNewLead({ ...newLead, leadListName: newLead.leadListName });
                                  setIsAddPopoverOpen(false);
                                }}
                              >
                                Using new group: "{newLead.leadListName}"
                              </CommandEmpty>
                              <CommandGroup>
                                {groups.map((group) => (
                                  <CommandItem
                                    key={group.name}
                                    value={group.name}
                                    onSelect={(currentValue) => {
                                      setNewLead({ ...newLead, leadListName: currentValue });
                                      setIsAddPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        newLead.leadListName === group.name ? "opacity-100" : "opacity-0"
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
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddLead}
                      className="gradient-primary text-white rounded-xl"
                    >
                      Add Contact
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                onClick={handleUploadExcel}
                variant="outline"
                className="rounded-xl border-primary/20 hover:border-primary h-10 flex-1 sm:flex-none"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>

              <Button
                onClick={handleDownloadReport}
                className="gradient-primary text-white rounded-xl shadow-luxury h-10 w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Leads Content */}
        {renderLeadsContent()}

        {/* Individual Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{contactToDelete?.email}</strong>? 
                This action cannot be undone and will remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteContact}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Contact'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Multiple Contacts</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{selectedContacts.length} contact(s)</strong>? 
                This action cannot be undone and will remove all associated data for these contacts.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDelete}
                disabled={bulkDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {bulkDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  `Delete ${selectedContacts.length} Contact(s)`
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import Leads CSV Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-white rounded-t-lg border-b border-gray-100 p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Import Leads CSV file</h2>
              <button 
                onClick={() => setIsUploadDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Download sample employee CSV file</span>
                <Button 
                  onClick={downloadSampleCSV}
                  className="bg-[#0091d5] hover:bg-[#007bb5] text-white rounded-md h-9 px-4 flex items-center gap-2 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Select CSV File</Label>
                <div className="flex items-stretch border border-gray-300 rounded-md overflow-hidden h-11">
                  <label className="flex items-center justify-center px-4 bg-[#f8f9fa] border-r border-gray-300 cursor-pointer hover:bg-gray-100 text-gray-700 text-sm font-medium transition-colors">
                    Choose File
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <div className="flex items-center px-4 flex-1 bg-white text-gray-500 text-sm truncate">
                    {selectedFile ? selectedFile.name : "No file chosen"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Group Name</Label>
                <Popover open={isUploadPopoverOpen} onOpenChange={setIsUploadPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between rounded-md font-normal h-11 px-3 border-gray-300",
                        !uploadGroupName && "text-muted-foreground"
                      )}
                    >
                      {uploadGroupName || "Select a group..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <Command>
                      <CommandList>
                        <CommandGroup>
                          {groups.filter(g => g.name !== "All Leads").map((group) => (
                            <CommandItem
                              key={group.name}
                              value={group.name}
                              onSelect={(currentValue) => {
                                setUploadGroupName(currentValue);
                                setIsUploadPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  uploadGroupName === group.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {group.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex justify-end gap-3 rounded-b-lg">
              <Button
                variant="ghost"
                onClick={() => setIsUploadDialogOpen(false)}
                className="bg-[#6c757d] hover:bg-[#5a6268] text-white rounded-md h-11 px-6 font-medium"
              >
                Cancel
              </Button>
              <Button
                onClick={processFileUpload}
                disabled={uploading || !selectedFile}
                className="bg-[#0091d5] hover:bg-[#007bb5] text-white rounded-md h-11 px-8 font-medium shadow-sm transition-all active:scale-[0.98]"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );



};

export default Leads;
