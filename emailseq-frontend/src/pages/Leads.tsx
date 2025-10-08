import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Plus, Search, Loader2 } from "lucide-react";
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
  const [newLead, setNewLead] = useState({
    email: "",
    firstName: "",
    lastName: "",
    company: "",
    timezone: "UTC"
  });

  // Load contacts from API
  useEffect(() => {
    loadContacts();
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
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Last Contacted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                      <TableCell className="font-medium">
                        {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
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
      </main>
    </div>
  );
};

export default Leads;
