import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Loader2, RefreshCw, Eye, Filter, Calendar, Mail, User, Users,
  Activity, Trash2, MessageCircle, Inbox, AlertCircle, Search, X 
} from "lucide-react";
import { toast } from "sonner";
import io from "socket.io-client";
import { api, Event, Contact, Sequence, RAW_BASE } from "@/lib/api";
import { safeJsonParse } from "@/lib/utils";
import EmailDetailsPopup from "@/components/popups/EmailDetailsPopup";

interface EmailActivityFilters {
  contactId?: string;
  sequenceId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  leadListName?: string;
}

const EmailActivity = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [groups, setGroups] = useState<{name: string, count: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [filters, setFilters] = useState<EmailActivityFilters>({});
  const [searchInput, setSearchInput] = useState(''); 
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [socket, setSocket] = useState<any>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [stats, setStats] = useState({
    sent: 0,
    opened: 0,
    replied: 0,
    bounced: 0
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      search: debouncedSearch || undefined
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [debouncedSearch]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
  };

  // Auto-refresh every 30 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing && pagination.page === 1 && Object.keys(filters).length === 0) {
        loadEvents(false); // Don't show refresh loader for background refresh
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, refreshing, filters, pagination.page]);

  useEffect(() => {
    loadInitialData();

    // Set up socket connection for real-time updates
    const socketConnection = io(RAW_BASE);
    setSocket(socketConnection);

    // Listen for real-time events (sent, opened, replied)
    socketConnection.on('realTimeEvent', (data) => {
      console.log('📡 Real-time event received:', data);
      
      if (data && data.event) {
        // Map common fields for frontend consistency
        const rawEvent = data.event;
        const newEvent: Event = {
          id: rawEvent.id || `temp-${Date.now()}`,
          enrollmentId: rawEvent.enrollmentId,
          contactId: rawEvent.contactId,
          type: rawEvent.type,
          timestamp: rawEvent.timestamp || new Date().toISOString(),
          details: rawEvent.details || JSON.stringify({ to: rawEvent.to }),
          campaignId: rawEvent.campaignId,
          contact: rawEvent.contact || { 
            email: rawEvent.to || '', 
            id: rawEvent.contactId,
            firstName: rawEvent.firstName,
            lastName: rawEvent.lastName
          } as any,
          enrollment: rawEvent.enrollment || {
            id: rawEvent.enrollmentId,
            sequence: rawEvent.sequence || { name: rawEvent.sequenceName || 'Sequence' }
          } as any
        };
        
        // Add new event to the top of the list if it matches current filters
        setEvents(prev => {
          if (prev.some(e => e.id === newEvent.id)) return prev;
          
          if (filters.type && newEvent.type !== filters.type) return prev;
          if (filters.contactId && newEvent.contactId !== filters.contactId) return prev;
          
          return [newEvent, ...prev].slice(0, pagination.limit);
        });

        // Update local stats
        setStats(prev => ({
          ...prev,
          [newEvent.type.toLowerCase()]: (prev[newEvent.type.toLowerCase() as keyof typeof prev] || 0) + 1
        }));

        // Show toast for important events
        if (newEvent.type === 'OPENED') {
          toast.success(`Email opened! ${newEvent.contact?.email || ''}`, {
            description: `A recipient just opened your email.`,
            icon: <Eye className="w-4 h-4 text-purple-600" />
          });
        } else if (newEvent.type === 'REPLIED') {
          toast.success(`New reply! ${newEvent.contact?.email || ''}`, {
            description: `You've received a response.`,
            icon: <MessageCircle className="w-4 h-4 text-emerald-600" />
          });
        } else if (newEvent.type === 'BOUNCED') {
          toast.error(`Email Bounced: ${newEvent.contact?.email || ''}`, {
            description: `Message marked as undelivered. Contact status updated to BOUNCED.`,
            icon: <AlertCircle className="w-4 h-4 text-red-600" />
          });
        }
      }
    });

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [contactsResponse, sequencesResponse, groupsResponse] = await Promise.all([
        api.getContacts({ limit: 1000 }),
        api.getSequences({ limit: 100 }),
        api.getContactGroups()
      ]);
      
      setContacts(contactsResponse.contacts);
      setSequences(sequencesResponse.sequences);
      setGroups(groupsResponse);
      
      await loadEvents();
    } catch (error) {
      console.error("Error loading initial data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!loading) {
        setLoading(true);
      }

      console.log('🔍 Loading events with filters:', filters);
      
      const response = await api.getEvents({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });

      setEvents(response.events);
      setPagination(prev => ({
        ...prev,
        total: response.pagination.total,
        pages: response.pagination.pages
      }));

      // Update local stats from dash stats
      api.getDashboardStats().then(dashStats => {
        setStats({
          sent: dashStats.totalEmailsSent,
          opened: dashStats.openRate.count,
          replied: dashStats.replyRate.count,
          bounced: dashStats.bounceRate.count
        });
      }).catch(err => {
        console.log("Could not fetch dashboard stats for summary:", err);
      });

      if (isRefresh) {
        toast.success("Email activity refreshed");
      }
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error("Failed to load email activity");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [filters, pagination.page]);

  const handleFilterChange = (key: keyof EmailActivityFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value || undefined
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchInput('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleCheckReplies = async () => {
    if (checkingReplies) return;
    
    try {
      setCheckingReplies(true);
      const response = await api.checkForReplies();
      if (response.success) {
        toast.success(`Found ${response.processedCount} new replies!`);
        await loadEvents(true);
      } else {
        toast.error('Failed to check for replies');
      }
    } catch (error) {
      console.error('Error checking for replies:', error);
      toast.error('Failed to check for replies');
    } finally {
      setCheckingReplies(false);
    }
  };

  const handleDeleteActivity = async (eventId: string) => {
    if (deletingIds.has(eventId)) return;
    try {
      setDeletingIds(prev => new Set(prev).add(eventId));
      await api.deleteEmailActivity(eventId);
      setEvents(prev => prev.filter(event => event.id !== eventId));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
      toast.success("Email activity deleted.");
    } catch (error) {
      console.error("Error deleting email activity:", error);
      toast.error("Failed to delete email activity");
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (event: Event) => {
    const type = event.type;
    const statusConfig = {
      SENT: { variant: "default" as const, color: "bg-blue-100 text-blue-800" },
      DELIVERED: { variant: "default" as const, color: "bg-green-100 text-green-800" },
      OPENED: { variant: "default" as const, color: "bg-purple-100 text-purple-800" },
      CLICKED: { variant: "default" as const, color: "bg-indigo-100 text-indigo-800" },
      REPLIED: { variant: "default" as const, color: "bg-emerald-100 text-emerald-800" },
      BOUNCED: { variant: "default" as const, color: "bg-orange-100 text-orange-800" },
      FAILED: { variant: "destructive" as const, color: "bg-red-100 text-red-800" },
      UNSUBSCRIBED: { variant: "secondary" as const, color: "bg-gray-100 text-gray-800" }
    };

    const config = statusConfig[type.toUpperCase() as keyof typeof statusConfig] || statusConfig.SENT;
    let label = type.toUpperCase();
    if (type === 'REPLIED') label = "REPLY RECEIVED";

    return (
      <Badge variant={config.variant} className={`${config.color} font-bold px-2.5 py-0.5 rounded-full border-none whitespace-nowrap`}>
        {label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getContactName = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : 'Unknown';
  };

  const getSequenceName = (event: Event) => {
    return event.enrollment?.sequence?.name || event.campaign?.sequence?.name || 'Unknown Sequence';
  };

  const getEmailSubject = (event: Event) => {
    if (event.details) {
      const details = safeJsonParse<{ subject?: string }>(event.details, {});
      if (details.subject) return details.subject;
    }
    const sequence = event.enrollment?.sequence;
    if (sequence?.steps && sequence.steps.length > 0) {
      const currentStep = sequence.steps.find(step => step.stepOrder === event.enrollment?.currentStep);
      return currentStep?.template?.subject || 'Email Subject';
    }
    return 'Email Subject';
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <main className="container mx-auto px-6 pt-24 pb-12">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-600" />
                Email Activity
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Track all sent and scheduled emails for each contact
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:ml-auto">
              <Button onClick={() => setShowFilters(!showFilters)} variant="outline" className="border-gray-300 h-10 flex-1 sm:flex-none">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              
              <Button onClick={handleCheckReplies} disabled={checkingReplies} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-10 flex-1 sm:flex-none">
                {checkingReplies ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Inbox className="w-4 h-4 mr-2" />}
                <span className="hidden xs:inline">Check Replies</span>
              </Button>
              
              <Button onClick={() => loadEvents(true)} disabled={refreshing} variant="outline" className="border-gray-300 h-10 flex-1 sm:flex-none">
                {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
            </div>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by email, name, sequence, or date..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-8 w-full h-11 rounded-lg border border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 transition-all"
              autoComplete="off"
            />
            {searchInput && (
              <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1" type="button">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {(loading || refreshing) && (
            <div className="flex items-center justify-center mt-2 py-1 text-xs text-blue-600 animate-pulse">
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              Updating activity log...
            </div>
          )}
        </div>

        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Contact</Label>
                <Select value={filters.contactId || ""} onValueChange={(v) => handleFilterChange('contactId', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="All contacts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All contacts</SelectItem>
                    {contacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{getContactName(c.id)} ({c.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Sequence</Label>
                <Select value={filters.sequenceId || ""} onValueChange={(v) => handleFilterChange('sequenceId', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="All sequences" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sequences</SelectItem>
                    {sequences.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Status</Label>
                <Select value={filters.type || ""} onValueChange={(v) => handleFilterChange('type', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Date Range</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="date" value={filters.startDate || ""} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="text-sm" />
                  <Input type="date" value={filters.endDate || ""} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={clearFilters} variant="outline" size="sm" className="border-gray-300">Clear Filters</Button>
            </div>
          </motion.div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5" />
              Email Activity Log
            </CardTitle>
            <CardDescription>
              {pagination.total} total email activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No email activity found</h3>
                <p className="text-gray-600">Try adjusting your filters or wait for sequences to send emails.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group Name</TableHead>
                      <TableHead>Contact Email</TableHead>
                      <TableHead>Sequence</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/5 p-2 rounded-lg"><Users className="w-4 h-4 text-primary" /></div>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900 leading-tight">{event.contact?.leadListName || "Uncategorized"}</span>
                              <span className="text-[11px] text-gray-500 mt-0.5">{getContactName(event.contactId)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900 font-medium">{event.contact?.email || 'Unknown'}</span>
                            {event.contact?.company && <span className="text-[10px] text-gray-400">{event.contact.company}</span>}
                          </div>
                        </TableCell>
                        <TableCell><div className="font-medium text-gray-900">{getSequenceName(event)}</div></TableCell>
                        <TableCell><div className="max-w-xs truncate">{getEmailSubject(event)}</div></TableCell>
                        <TableCell>{getStatusBadge(event)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{formatDate(event.timestamp)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button onClick={() => setSelectedEvent(event)} variant="ghost" size="sm" className="h-8 w-8 p-0" title="View Details"><Eye className="w-4 h-4" /></Button>
                            <Button onClick={() => handleDeleteActivity(event.id)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" disabled={deletingIds.has(event.id)} title="Delete Activity">
                              {deletingIds.has(event.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results</div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))} disabled={pagination.page === 1} variant="outline" size="sm">Previous</Button>
                  <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.pages}</span>
                  <Button onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} disabled={pagination.page === pagination.pages} variant="outline" size="sm">Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedEvent && (
          <EmailDetailsPopup event={selectedEvent} isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}
      </main>
    </div>
  );
};

export default EmailActivity;
