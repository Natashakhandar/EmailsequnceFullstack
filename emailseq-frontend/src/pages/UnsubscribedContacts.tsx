import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, UserX, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface UnsubscribedContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  reason: string;
  unsubscribedAt: string;
  sequenceName: string;
  totalUnsubscribeEvents: number;
}

const UnsubscribedContacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<UnsubscribedContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<UnsubscribedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUnsubscribedContacts();
  }, []);

  const fetchUnsubscribedContacts = async () => {
    try {
      setLoading(true);
      const data = await api.getMyUnsubscribedContacts();
      setContacts(data || []);
      setFilteredContacts(data || []);
    } catch (error) {
      console.error('Failed to fetch unsubscribed contacts:', error);
      setContacts([]);
      setFilteredContacts([]);
      toast.error('Failed to load unsubscribed contacts.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    const filtered = contacts.filter(contact =>
      contact.email.toLowerCase().includes(term) ||
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(term) ||
      contact.sequenceName.toLowerCase().includes(term) ||
      (contact.reason || '').toLowerCase().includes(term)
    );
    setFilteredContacts(filtered);
  };

  const downloadCSV = () => {
    const headers = ['Email', 'Name', 'Sequence', 'Company', 'Reason', 'Unsubscribed Date'];
    const csvContent = [
      headers.join(','),
      ...filteredContacts.map(contact =>
        [
          contact.email,
          `${contact.firstName} ${contact.lastName}`,
          contact.sequenceName,
          contact.company || '-',
          contact.reason || '-',
          new Date(contact.unsubscribedAt).toLocaleDateString('en-GB')
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unsubscribed-contacts.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />

      <main className="container mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-2">Unsubscribed Contacts</h1>
              <p className="text-muted-foreground">View all recipients who have unsubscribed from your sequences</p>
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 shadow-card mb-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, or sequence..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 rounded-xl"
              />
            </div>
            <Button
              onClick={downloadCSV}
              disabled={filteredContacts.length === 0}
              className="gap-2 rounded-xl"
              variant="outline"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl shadow-card overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading unsubscribed contacts...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Sequence</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Company</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Reason</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Unsubscribed Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16">
                        <div className="flex flex-col items-center justify-center">
                          <div className="bg-destructive/10 p-4 rounded-full mb-4">
                            <UserX className="w-8 h-8 text-destructive" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2">
                            {contacts.length === 0 ? 'No unsubscribed contacts' : 'No results found'}
                          </h3>
                          <p className="text-muted-foreground text-center">
                            {contacts.length === 0
                              ? 'Keep monitoring your email engagement!'
                              : 'Try adjusting your search criteria'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact, index) => (
                      <motion.tr
                        key={contact.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * index }}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-foreground">{contact.email}</td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {contact.firstName || contact.lastName
                            ? `${contact.firstName} ${contact.lastName}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">{contact.sequenceName}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{contact.company || '-'}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{contact.reason || '-'}</td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {new Date(contact.unsubscribedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Stats */}
          {!loading && contacts.length > 0 && (
            <div className="px-6 py-4 bg-muted/50 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredContacts.length}</span> of{' '}
                <span className="font-semibold text-foreground">{contacts.length}</span> unsubscribed contacts
              </p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default UnsubscribedContacts;
