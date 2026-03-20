import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, UserX, Download, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface UnsubscribedContact {
  id: string;
  name: string;
  email: string;
  reason: string;
  unsubscribedAt: string;
}

export default function UnsubscribedContacts() {
  const [contacts, setContacts] = useState<UnsubscribedContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<UnsubscribedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUnsubscribedContacts();
  }, []);

  const fetchUnsubscribedContacts = async () => {
    try {
      setLoading(true);
      const data = await api.getUnsubscribedContacts();
      setContacts(data || []);
      setFilteredContacts(data || []);
    } catch (error) {
      console.error('Error fetching unsubscribed contacts:', error);
      toast.error('Failed to load unsubscribed contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    const filtered = contacts.filter(
      (contact) =>
        contact.email.toLowerCase().includes(term) ||
        contact.name.toLowerCase().includes(term) ||
        (contact.reason || '').toLowerCase().includes(term)
    );
    setFilteredContacts(filtered);
  };

  const downloadCSV = () => {
    if (filteredContacts.length === 0) {
      toast.error('No contacts to download');
      return;
    }

    const headers = ['Name', 'Email', 'Reason', 'Unsubscribed Date'];
    const rows = filteredContacts.map((contact) => [
      contact.name,
      contact.email,
      contact.reason || '-',
      new Date(contact.unsubscribedAt).toLocaleDateString('en-GB'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unsubscribed-contacts-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold">Unsubscribed Contacts</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
                  View all recipients who have unsubscribed
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-4 sm:p-6 shadow-card mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, or reason..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 rounded-lg"
              />
            </div>
            <Button
              onClick={downloadCSV}
              disabled={filteredContacts.length === 0}
              variant="outline"
              className="gap-2 rounded-lg"
              size="sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl shadow-card overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Name</TableHead>
                    <TableHead className="text-xs sm:text-sm">Email</TableHead>
                    <TableHead className="text-xs sm:text-sm">Reason</TableHead>
                    <TableHead className="text-xs sm:text-sm">Unsubscribed Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <div className="flex flex-col items-center">
                          <UserX className="w-12 h-12 text-muted-foreground mb-3" />
                          <p className="text-sm sm:text-base font-medium">No unsubscribed contacts</p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {contacts.length === 0
                              ? 'No one has unsubscribed yet'
                              : 'Try adjusting your search'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContacts.map((contact) => (
                      <motion.tr
                        key={contact.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="text-xs sm:text-sm">{contact.name}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{contact.email}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{contact.reason || '-'}</TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {new Date(contact.unsubscribedAt).toLocaleDateString('en-GB')}
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Footer Stats */}
          {!loading && contacts.length > 0 && (
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-muted/50 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredContacts.length}</span> of{' '}
                <span className="font-semibold text-foreground">{contacts.length}</span> unsubscribed
                contacts
              </p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
