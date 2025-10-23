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
import { Upload, Download, Plus, Search, Loader2, Mail, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { api, Contact, Sequence } from "@/lib/api";

interface Lead extends Contact {
  lastContacted?: string;
}

const Leads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState("");
  const [startImmediately, setStartImmediately] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [newLead, setNewLead] = useState({
    email: "",
    firstName: "",
    lastName: "",
    company: "",
    timezone: "UTC"
  });

  // Delete functionality state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Load contacts and sequences from API
  useEffect(() => {
    loadContacts();
    loadSequences();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await api.getContacts({ limit: 100 });
      setLeads(response.contacts);
    } catch (error) {
      toast.error("Failed to load contacts");
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load sequences from backend API
   * Uses the proper API client with JWT authorization
   * Filters for active sequences only
   */
  const loadSequences = async () => {
    try {
      setLoadingSequences(true);
      console.log("Loading sequences from backend using API client...");
      
      // Use the proper API client which includes JWT authorization
      const response = await api.getSequences({ isActive: true });
      console.log("API response received:", response);
      
      const allSequences = response.sequences || [];
      console.log(`Total sequences from API: ${allSequences.length}`);
      
      // Filter for active sequences (double-check in case backend doesn't filter properly)
      const activeSequences = allSequences.filter(seq => seq.isActive === true);
      console.log(`Active sequences after filtering: ${activeSequences.length}`);
      
      setSequences(activeSequences);
      
      if (activeSequences.length === 0) {
        console.warn("No active sequences found");
        toast.info("No active sequences available. Please create and activate sequences first.");
      } else {
        console.log("Active sequences loaded:", activeSequences.map(s => ({ id: s.id, name: s.name, isActive: s.isActive })));
      }
    } catch (error) {
      console.error("Error loading sequences:", error);
      toast.error("Failed to load sequences. Please check your connection and try again.");
      setSequences([]); // Clear sequences on error
    } finally {
      setLoadingSequences(false);
    }
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

  /**
   * Enroll selected contacts in the chosen sequence
   * Uses the proper API client with JWT authorization
   */
  const handleEnrollContacts = async () => {
    if (!selectedSequence || selectedContacts.length === 0) {
      toast.error("Please select a sequence and at least one contact");
      return;
    }

    try {
      setEnrolling(true);
      console.log(`Enrolling ${selectedContacts.length} contacts in sequence ${selectedSequence}`);
      
      // Use the proper API client which includes JWT authorization
      const result = await api.bulkEnrollContacts({
        contactIds: selectedContacts,
        sequenceId: selectedSequence,
        startImmediately
      });
      
      console.log("Enrollment result:", result);
      toast.success(`Successfully enrolled ${result.enrolled} contacts in sequence`);
      
      if (result.skipped > 0) {
        toast.info(`${result.skipped} contacts were skipped (already enrolled or inactive)`);
      }
      
      // Reset form state
      setSelectedContacts([]);
      setIsEnrollDialogOpen(false);
      setSelectedSequence("");
    } catch (error: any) {
      console.error("Error enrolling contacts:", error);
      toast.error(error.message || "Failed to enroll contacts");
    } finally {
      setEnrolling(false);
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
        timezone: newLead.timezone,
        status: "ACTIVE"
      });
      
      setLeads([contact, ...leads]);
      setIsAddDialogOpen(false);
      setNewLead({ email: "", firstName: "", lastName: "", company: "", timezone: "UTC" });
      toast.success("Contact added successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to add contact");
    }
  };

  const handleUploadExcel = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const contacts = jsonData.map((row: any) => ({
          email: row.email || row.Email,
          firstName: row.firstName || row.FirstName || row.first_name,
          lastName: row.lastName || row.LastName || row.last_name,
          company: row.company || row.Company,
          timezone: "UTC",
          status: "ACTIVE" as const
        })).filter(contact => contact.email);

        if (contacts.length === 0) {
          toast.error("No valid contacts found in file");
          return;
        }

        const result = await api.bulkImportContacts(contacts);
        toast.success(`Imported ${result.created} contacts, skipped ${result.skipped}`);
        loadContacts();
      } catch (error) {
        toast.error("Failed to import contacts");
      }
    };
    input.click();
  };

  const handleDownloadReport = () => {
    const exportData = leads.map(lead => ({
      Name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email,
      Email: lead.email,
      Company: lead.company || '',
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
              <h1 className="text-4xl font-bold mb-2">Leads</h1>
              <p className="text-muted-foreground">
                Manage your leads and track their status
              </p>
            </div>

            <div className="flex gap-3">
              {selectedContacts.length > 0 && (
                <>
                  <Button
                    onClick={handleBulkDelete}
                    variant="destructive"
                    className="rounded-xl shadow-luxury"
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
                        Delete Selected ({selectedContacts.length})
                      </>
                    )}
                  </Button>
                  <Dialog open={isEnrollDialogOpen} onOpenChange={(open) => {
                    setIsEnrollDialogOpen(open);
                    // Refresh sequences when dialog opens to ensure latest data
                    if (open) {
                      loadSequences();
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        className="gradient-primary text-white rounded-xl shadow-luxury"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Enroll in Sequence ({selectedContacts.length})
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Enroll Contacts in Sequence</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="sequence">Select Sequence *</Label>
                        <Select value={selectedSequence} onValueChange={setSelectedSequence} disabled={loadingSequences || sequences.length === 0}>
                          <SelectTrigger className="rounded-xl">
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
                              sequences.map((sequence) => (
                                <SelectItem key={sequence.id} value={sequence.id}>
                                  {sequence.name} ({sequence.steps?.length || 0} steps)
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>
                                {loadingSequences ? "Loading..." : "No sequences available"}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {!loadingSequences && sequences.length === 0 && (
                          <div className="text-xs text-muted-foreground bg-yellow-50 p-2 rounded border">
                            <strong>No active sequences found.</strong><br />
                            Please create and activate sequences in the Sequences page first.
                          </div>
                        )}
                        {loadingSequences && (
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading sequences...
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="startImmediately" 
                            checked={startImmediately}
                            onCheckedChange={(checked) => setStartImmediately(checked === true)}
                          />
                          <Label htmlFor="startImmediately" className="text-sm">
                            Start sending immediately
                          </Label>
                        </div>
                        <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded border">
                          <strong>Timing Options:</strong>
                          <br />
                          ✅ <strong>Immediate:</strong> First email sends right away, then follows sequence delays
                          <br />
                          ⏰ <strong>Scheduled:</strong> Follows sequence timing from the start (respects all delays)
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedContacts.length} contact(s) selected for enrollment
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsEnrollDialogOpen(false)}
                        className="rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleEnrollContacts}
                        disabled={enrolling || !selectedSequence || sequences.length === 0 || loadingSequences}
                        className="gradient-primary text-white rounded-xl"
                      >
                        {enrolling ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enrolling...
                          </>
                        ) : (
                          <>
                            <Users className="w-4 h-4 mr-2" />
                            Enroll Contacts
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </>
              )}

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-xl border-primary/20 hover:border-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
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
                className="rounded-xl border-primary/20 hover:border-primary"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Excel
              </Button>

              <Button
                onClick={handleDownloadReport}
                className="gradient-primary text-white rounded-xl shadow-luxury"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>
          </div>
        </motion.div>

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
              placeholder="Search contacts by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl glass"
            />
          </div>
        </motion.div>

        {/* Instructions */}
        {leads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-primary mb-1">Start Email Sequences</h3>
                <p className="text-sm text-muted-foreground">
                  Select contacts below and click "Enroll in Sequence" to start sending automated email sequences. 
                  Only active contacts can be enrolled.
                </p>
              </div>
            </div>
          </motion.div>
        )}

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
                      {searchTerm ? "No contacts found matching your search." : "No contacts yet. Add your first contact!"}
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
                    {leads.length > 0 ? ((leads.filter((l) => l.status === "ACTIVE").length / leads.length) * 100).toFixed(0) : 0}% of total
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
                    {leads.length > 0 ? ((leads.filter((l) => l.status === "UNSUBSCRIBED").length / leads.length) * 100).toFixed(0) : 0}% of total
                  </p>
                </motion.div>
                <motion.div 
                  className="text-center p-4 rounded-xl bg-accent/5 transition-smooth hover:bg-accent/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <p className="text-2xl font-bold text-accent">
                    {leads.length}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">Total Contacts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All contacts in database
                  </p>
                </motion.div>
              </div>
            </div>
          )}
        </motion.div>

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
      </main>
    </div>
  );
};

export default Leads;
