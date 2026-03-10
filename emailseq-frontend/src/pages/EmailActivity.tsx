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
import { Loader2, RefreshCw, Eye, Filter, Calendar, Mail, User, Activity, Trash2, MessageCircle, Inbox } from "lucide-react";
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
}

const EmailActivity = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [filters, setFilters] = useState<EmailActivityFilters>({});
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

  // Auto-refresh every 30 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing && pagination.page === 1 && Object.keys(filters).length === 0) {
        loadEvents(false);
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
        }
      }
    });

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  useEffect(() => {
    loadEvents();
  }, [filters, pagination.page]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [contactsResponse, sequencesResponse] = await Promise.all([
        api.getContacts({ limit: 1000 }),
        api.getSequences({ limit: 100 })
      ]);
      
      setContacts(contactsResponse.contacts);
      setSequences(sequencesResponse.sequences);
      
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

      // Calculate stats from all events if possible, or just the current set
      // For a real app, this should come from a separate /stats endpoint
      if (pagination.page === 1) {
        const newStats = response.events.reduce((acc: any, curr: any) => {
          const type = curr.type.toLowerCase();
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, { sent: 0, opened: 0, replied: 0, bounced: 0 });
        setStats(newStats);
      }

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

  const handleFilterChange = (key: keyof EmailActivityFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value || undefined
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleCheckReplies = async () => {
    if (checkingReplies) return;
    
    try {
      setCheckingReplies(true);
      
      const response = await api.checkForReplies();
      
      if (response.success) {
        toast.success(`Found ${response.processedCount} new replies!`);
        // Refresh the events to show new replies
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
    if (deletingIds.has(eventId)) return; // Prevent double-clicking
    
    try {
      setDeletingIds(prev => new Set(prev).add(eventId));
      
      await api.deleteEmailActivity(eventId);
      
      // Remove the event from the frontend list
      setEvents(prev => prev.filter(event => event.id !== eventId));
      
      // Update pagination total
      setPagination(prev => ({
        ...prev,
        total: prev.total - 1
      }));
      
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

  const hasReplyContent = (event: Event) => {
    if (event.type !== 'REPLIED' || !event.details) return false;
    
    const details = safeJsonParse<any>(event.details, {});
    return !!(details.replyBody || details.replyContent || details.content);
  };

  const getStatusBadge = (event: Event) => {
    const type = event.type;
    const statusConfig = {
      SENT: { variant: "default" as const, color: "bg-blue-100 text-blue-800" },
      DELIVERED: { variant: "default" as const, color: "bg-green-100 text-green-800" },
      OPENED: { variant: "default" as const, color: "bg-purple-100 text-purple-800" },
      CLICKED: { variant: "default" as const, color: "bg-indigo-100 text-indigo-800" },
      REPLIED: { variant: "default" as const, color: "bg-emerald-100 text-emerald-800" },
      BOUNCED: { variant: "destructive" as const, color: "bg-red-100 text-red-800" },
      FAILED: { variant: "destructive" as const, color: "bg-red-100 text-red-800" },
      UNSUBSCRIBED: { variant: "secondary" as const, color: "bg-gray-100 text-gray-800" }
    };

    const config = statusConfig[type.toUpperCase() as keyof typeof statusConfig] || statusConfig.SENT;
    
    return (
      <Badge variant={config.variant} className={`${config.color} font-bold px-2.5 py-0.5 rounded-full border-none`}>
        {type.toUpperCase()}
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
    return event.enrollment?.sequence?.name || 'Unknown Sequence';
  };

  const getEmailSubject = (event: Event) => {
    // Try to get subject from event details or enrollment sequence steps
    if (event.details) {
      const details = safeJsonParse<{ subject?: string }>(event.details, {});
      if (details.subject) return details.subject;
    }
    
    // Fallback to sequence step template subject
    const sequence = event.enrollment?.sequence;
    if (sequence?.steps && sequence.steps.length > 0) {
      const currentStep = sequence.steps.find(step => 
        step.stepOrder === event.enrollment?.currentStep
      );
      return currentStep?.template?.subject || 'Email Subject';
    }
    
    return 'Email Subject';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-6 pt-20 pb-12">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading email activity...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-6 pt-20 pb-12">
        {/* Activity Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-blue-50 border-blue-100 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Sent</p>
                <h3 className="text-2xl font-bold text-blue-900">{stats.sent}</h3>
              </div>
              <Mail className="w-8 h-8 text-blue-200" />
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-100 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Total Opened</p>
                <h3 className="text-2xl font-bold text-purple-900">{stats.opened}</h3>
              </div>
              <Eye className="w-8 h-8 text-purple-200" />
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-100 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600">Total Replied</p>
                <h3 className="text-2xl font-bold text-emerald-900">{stats.replied}</h3>
              </div>
                <MessageCircle className="w-8 h-8 text-emerald-200" />
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-100 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <h3 className="text-2xl font-bold text-gray-900">{pagination.total}</h3>
              </div>
              <Activity className="w-8 h-8 text-gray-200" />
            </CardContent>
          </Card>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-600" />
                Email Activity
              </h1>
              <p className="text-gray-600">
                Track all sent and scheduled emails for each contact
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="border-gray-300"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              
              <Button
                onClick={handleCheckReplies}
                disabled={checkingReplies}
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                {checkingReplies ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Inbox className="w-4 h-4 mr-2" />
                )}
                Check Replies
              </Button>
              
              <Button
                onClick={() => loadEvents(true)}
                disabled={refreshing}
                variant="outline"
                className="border-gray-300"
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-lg border border-gray-200 p-6 mb-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="contactFilter" className="text-sm font-medium text-gray-700">
                    Contact
                  </Label>
                  <Select
                    value={filters.contactId || ""}
                    onValueChange={(value) => handleFilterChange('contactId', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All contacts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All contacts</SelectItem>
                      {contacts.map((contact) => {
                        if (!contact.id) {
                          console.warn('Skipping contact with missing ID:', contact);
                          return null;
                        }
                        return (
                          <SelectItem key={contact.id} value={String(contact.id)}>
                            {getContactName(contact.id)} ({contact.email})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sequenceFilter" className="text-sm font-medium text-gray-700">
                    Sequence
                  </Label>
                  <Select
                    value={filters.sequenceId || ""}
                    onValueChange={(value) => handleFilterChange('sequenceId', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All sequences" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sequences</SelectItem>
                      {sequences.map((sequence) => {
                        if (!sequence.id) {
                          console.warn('Skipping sequence with missing ID:', sequence);
                          return null;
                        }
                        return (
                          <SelectItem key={sequence.id} value={String(sequence.id)}>
                            {sequence.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="statusFilter" className="text-sm font-medium text-gray-700">
                    Status
                  </Label>
                  <Select
                    value={filters.type || ""}
                    onValueChange={(value) => handleFilterChange('type', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="SENT">Sent</SelectItem>
                      <SelectItem value="DELIVERED">Delivered</SelectItem>
                      <SelectItem value="OPENED">Opened</SelectItem>
                      <SelectItem value="CLICKED">Clicked</SelectItem>
                      <SelectItem value="REPLIED">Replied</SelectItem>
                      <SelectItem value="BOUNCED">Bounced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dateFilter" className="text-sm font-medium text-gray-700">
                    Date Range
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="date"
                      value={filters.startDate || ""}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      type="date"
                      value={filters.endDate || ""}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  size="sm"
                  className="border-gray-300"
                >
                  Clear Filters
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Email Activity Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Activity Log
            </CardTitle>
            <CardDescription>
              {pagination.total} total email activities
              {refreshing && " • Refreshing..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No email activity found</h3>
                <p className="text-gray-600">
                  {Object.keys(filters).length > 0 
                    ? "Try adjusting your filters to see more results."
                    : "Email activities will appear here once sequences start sending emails."
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
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
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">
                                {event.contact ? (
                                  <>
                                    <div className="font-semibold text-gray-900">
                                      {`${(event.contact.firstName || '')} ${(event.contact.lastName || '')}`.trim() || event.contact.email}
                                    </div>
                                    <div className="text-xs text-gray-400">{event.contact.email}</div>
                                  </>
                                ) : (
                                  getContactName(event.contactId)
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {event.contact?.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-900">
                            {getSequenceName(event)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">
                            {getEmailSubject(event)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(event)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {formatDate(event.timestamp)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => setSelectedEvent(event)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteActivity(event.id)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={deletingIds.has(event.id)}
                              title="Delete Activity"
                            >
                              {deletingIds.has(event.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <Button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.pages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Details Popup */}
        {selectedEvent && (
          <EmailDetailsPopup
            event={selectedEvent}
            isOpen={!!selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </main>
    </div>
  );
};

export default EmailActivity;
