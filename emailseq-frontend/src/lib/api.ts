// API configuration and utilities for the email sequencing backend

const getApiBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE_URL;

  if (import.meta.env.DEV) {
    if (envUrl && !envUrl.includes('placeholder')) return envUrl;
    return '';
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // REDIRECT API: If on main boostnow domain, talk to the silver-tapir backend
    // Since email.boostnow.in is a different host, we check for main domain specifically
    if (hostname === 'boostnow.in' || hostname === 'www.boostnow.in') {
      return 'https://silver-tapir-929419.hostingersite.com';
    }

    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return window.location.origin;
    }
  }

  return envUrl || window.location.origin;
};

export const RAW_BASE = getApiBaseUrl();

export const API_BASE_URL = RAW_BASE.endsWith('/api')
  ? RAW_BASE
  : `${RAW_BASE.replace(/\/$/, '')}/api`;

console.log('🌐 API_BASE_URL:', API_BASE_URL);

// API response types
export interface Contact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  timezone: string;
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  steps: SequenceStep[];
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  templateId?: string | null;
  stepOrder: number;
  subject?: string;
  body?: string;
  delayDays: number;
  delayHours: number;
  triggerType: 'delay' | 'opened' | 'not_opened' | 'replied' | 'skip';
  triggerStepId?: string | null;
  scheduleType: 'delay' | 'weekly' | 'monthly';
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  isActive: boolean;
  template?: Template;
}

export interface Enrollment {
  id: string;
  contactId: string;
  sequenceId: string;
  currentStep: number;
  nextSendAt?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'UNSUBSCRIBED';
  startedAt: string;
  completedAt?: string;
  contact?: Contact;
  sequence?: Sequence;
}

export interface Event {
  id: string;
  enrollmentId: string;
  contactId: string;
  type: 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'BOUNCED' | 'UNSUBSCRIBED' | 'FAILED';
  details?: string;
  timestamp: string;
  emailId?: string;
  contact?: Contact;
  enrollment?: Enrollment;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  campaignName: string;
  description?: string;
  sequenceId: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sequence?: Sequence;
  leads?: Contact[];
  stats?: {
    totalLeads: number;
    emailsSent: number;
    emailsOpened: number;
    emailsReplied: number;
    emailsBounced: number;
  };
}


export interface LoginResponse {
  message: string;
  user: User;
  token: string;
}

// API utility class
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getAuthToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          if (typeof window !== 'undefined' &&
            window.location.pathname !== '/login' &&
            window.location.pathname !== '/signup') {
            window.location.href = '/login';
          }
        }

        const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Authentication API
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Store token in localStorage
    localStorage.setItem('auth_token', response.token);
    // Clear any previous impersonation session
    localStorage.removeItem('original_auth_token');

    return response;
  }

  async signup(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    // Store token in localStorage
    localStorage.setItem('auth_token', response.token);
    // Clear any previous impersonation session
    localStorage.removeItem('original_auth_token');

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', {
        method: 'POST',
      });
    } finally {
      // Always remove token and impersonation state from localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('original_auth_token');
    }
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  async getUsers(): Promise<{ users: User[] }> {
    return this.request<{ users: User[] }>('/auth/users');
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: 'USER' | 'ADMIN' | 'SUPERADMIN';
  }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, updates: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: 'USER' | 'ADMIN' | 'SUPERADMIN';
    isActive?: boolean;
  }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/auth/users/${id}`, {
      method: 'DELETE',
    });
  }

  async changeUserPassword(id: string, password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/auth/users/${id}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async impersonateUser(userId: string): Promise<LoginResponse> {
    // Store current token as original before switching
    const currentToken = this.getAuthToken();
    if (currentToken && !localStorage.getItem('original_auth_token')) {
      localStorage.setItem('original_auth_token', currentToken);
    }

    const response = await this.request<LoginResponse>(`/auth/impersonate/${userId}`, {
      method: 'POST',
    });

    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }

    return response;
  }

  stopImpersonating(): void {
    const originalToken = localStorage.getItem('original_auth_token');
    if (originalToken) {
      localStorage.setItem('auth_token', originalToken);
      localStorage.removeItem('original_auth_token');
    }
  }

  isImpersonating(): boolean {
    return !!localStorage.getItem('original_auth_token');
  }

  // Helper method to check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }

  // Contacts API
  async getContacts(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);

    const query = searchParams.toString();
    return this.request<{ contacts: Contact[]; pagination: any }>(`/contacts${query ? `?${query}` : ''}`);
  }

  async createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.request<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  }

  async updateContact(id: string, updates: Partial<Contact>) {
    return this.request<Contact>(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteContact(id: string) {
    return this.request<void>(`/contacts/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkImportContacts(contacts: Array<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>) {
    return this.request<{ created: number; skipped: number; errors: any[] }>('/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify({ contacts }),
    });
  }

  async bulkDeleteContacts(ids: string[]) {
    return this.request<{ message: string; deleted: number }>('/contacts/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }


  // Templates API
  async getTemplates(params?: { page?: number; limit?: number; isActive?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());

    const query = searchParams.toString();
    return this.request<{ templates: Template[]; pagination: any }>(`/templates${query ? `?${query}` : ''}`);
  }

  async createTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.request<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async updateTemplate(id: string, updates: Partial<Template>) {
    return this.request<Template>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTemplate(id: string) {
    return this.request<void>(`/templates/${id}`, {
      method: 'DELETE',
    });
  }

  // Sequences API
  async getSequences(params?: { page?: number; limit?: number; isActive?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());

    const query = searchParams.toString();
    return this.request<{ sequences: Sequence[]; pagination: any }>(`/sequences${query ? `?${query}` : ''}`);
  }

  async createSequence(sequence: {
    name: string;
    description?: string;
    steps?: Array<{
      stepOrder: number;
      subject?: string;
      body?: string;
      triggerType: 'delay' | 'opened' | 'not_opened' | 'replied' | 'skip';
      triggerStepId?: string | null;
      delayDays: number;
      delayHours: number;
      templateId?: string | null;
    }>
  }) {
    return this.request<Sequence>('/sequences', {
      method: 'POST',
      body: JSON.stringify(sequence),
    });
  }

  async updateSequence(id: string, updates: {
    name?: string;
    description?: string;
    steps?: Array<{
      stepOrder: number;
      subject?: string;
      body?: string;
      triggerType: 'delay' | 'opened' | 'not_opened' | 'replied' | 'skip';
      triggerStepId?: string | null;
      delayDays: number;
      delayHours: number;
      templateId?: string | null;
    }>
  }) {
    return this.request<Sequence>(`/sequences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSequence(id: string) {
    return this.request<void>(`/sequences/${id}`, {
      method: 'DELETE',
    });
  }

  async addSequenceStep(sequenceId: string, step: Omit<SequenceStep, 'id' | 'sequenceId'>) {
    return this.request<SequenceStep>(`/sequences/${sequenceId}/steps`, {
      method: 'POST',
      body: JSON.stringify(step),
    });
  }

  // Enrollments API
  async getEnrollments(params?: { page?: number; limit?: number; status?: string; sequenceId?: string; contactId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.sequenceId) searchParams.append('sequenceId', params.sequenceId);
    if (params?.contactId) searchParams.append('contactId', params.contactId);

    const query = searchParams.toString();
    return this.request<{ enrollments: Enrollment[]; pagination: any }>(`/enrollments${query ? `?${query}` : ''}`);
  }

  async createEnrollment(enrollment: { contactId: string; sequenceId: string; startImmediately?: boolean }) {
    return this.request<Enrollment>('/enrollments', {
      method: 'POST',
      body: JSON.stringify(enrollment),
    });
  }

  async bulkEnrollContacts(data: { contactIds: string[]; sequenceId: string; startImmediately?: boolean }) {
    return this.request<{ enrolled: number; skipped: number; errors: any[] }>('/enrollments/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Events API
  async getEvents(params?: {
    page?: number;
    limit?: number;
    type?: string;
    enrollmentId?: string;
    contactId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.type) searchParams.append('type', params.type);
    if (params?.enrollmentId) searchParams.append('enrollmentId', params.enrollmentId);
    if (params?.contactId) searchParams.append('contactId', params.contactId);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);

    const query = searchParams.toString();
    return this.request<{ events: Event[]; pagination: any }>(`/events${query ? `?${query}` : ''}`);
  }

  async getEvent(id: string) {
    return this.request<Event>(`/events/${id}`);
  }

  async deleteEmailActivity(id: string) {
    return this.request<void>(`/email-activity/${id}`, {
      method: 'DELETE',
    });
  }

  async getAnalyticsSummary(params?: { startDate?: string; endDate?: string; sequenceId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.sequenceId) searchParams.append('sequenceId', params.sequenceId);

    const query = searchParams.toString();
    return this.request<any>(`/events/analytics/summary${query ? `?${query}` : ''}`);
  }

  // Scheduler API
  async getSchedulerStatus() {
    return this.request<any>('/scheduler/status');
  }

  async triggerEmailProcessing() {
    return this.request<any>('/scheduler/trigger', {
      method: 'POST',
    });
  }

  // SMTP utilities
  async getSmtpStatus() {
    return this.request<any>('/scheduler/smtp-status');
  }

  async saveSmtpConfig(data: any) {
    return this.request<any>('/scheduler/smtp-config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async testImapConnection() {
    return this.request<any>('/scheduler/imap-test', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async testImapWithConfig(config: any) {
    return this.request<any>('/scheduler/imap-test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async testSmtpConnection(config: any) {
    return this.request<any>('/scheduler/smtp-test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async sendTestEmail(data: { to: string; subject?: string; body?: string }) {
    return this.request<any>('/scheduler/test-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Profile Signature API
  async getProfileSignature(): Promise<{ signature: string }> {
    return this.request<{ signature: string }>('/profile/signature');
  }

  async updateProfileSignature(signature: string): Promise<{ signature: string }> {
    return this.request<{ signature: string }>('/profile/signature', {
      method: 'POST',
      body: JSON.stringify({ signature }),
    });
  }

  // Email Monitoring API
  async checkForReplies() {
    return this.request<any>('/email-monitoring/check-replies', {
      method: 'POST',
    });
  }

  async getEmailMonitoringStatus() {
    return this.request<any>('/email-monitoring/status');
  }

  async getRecentEmails(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<any>(`/email-monitoring/recent-emails${query}`);
  }

  // Dashboard API
  async getDashboardStats(params?: { startDate?: string; endDate?: string; sequenceId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.sequenceId) searchParams.append('sequenceId', params.sequenceId);

    const query = searchParams.toString();
    return this.request<{
      totalEmailsSent: number;
      openRate: { percentage: number; count: number };
      replyRate: { percentage: number; count: number };
      bounceRate: { percentage: number; count: number };
      dailyActivity: number[];
      weeklyPerformance: number[];
      additionalMetrics: {
        totalSequences: number;
        totalContacts: number;
        activeEnrollments: number;
        totalDelivered: number;
        totalClicked: number;
        totalUnsubscribed: number;
        totalFailed: number;
      };
      eventBreakdown: Record<string, number>;
      dateRange: {
        startDate: string;
        endDate: string;
        sequenceId: string;
      };
    }>(`/dashboard/stats${query ? `?${query}` : ''}`);
  }

  async getDashboardRecentActivity(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<{
      recentActivity: Array<{
        id: string;
        type: string;
        timestamp: string;
        contact: {
          email: string;
          name: string;
        };
        sequence: string;
      }>;
      count: number;
    }>(`/dashboard/recent-activity${query}`);
  }

  async getDashboardPerformanceTrends(params?: { days?: number; sequenceId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.days) searchParams.append('days', params.days.toString());
    if (params?.sequenceId) searchParams.append('sequenceId', params.sequenceId);

    const query = searchParams.toString();
    return this.request<{
      trends: Array<{
        date: string;
        sent: number;
        opened: number;
        replied: number;
        bounced: number;
        clicked: number;
        delivered: number;
        openRate: string;
        replyRate: string;
        bounceRate: string;
      }>;
      period: string;
      totalDays: number;
    }>(`/dashboard/performance-trends${query ? `?${query}` : ''}`);
  }

  // Reports API
  async getReportsAnalytics(params?: { startDate?: string; endDate?: string; sequenceId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.sequenceId) searchParams.append('sequenceId', params.sequenceId);

    const query = searchParams.toString();
    return this.request<{
      totalCampaigns: number;
      totalLeads: number;
      avgResponseRate: number;
      bounceRate: number;
      emailStatusDistribution: {
        sent: number;
        opened: number;
        replied: number;
        bounced: number;
      };
      campaignBreakdown: Array<{
        name: string;
        sent: number;
        opened: number;
        replied: number;
        bounced: number;
        openRate: number;
        replyRate: number;
        bounceRate: number;
      }>;
      leadPerformance: {
        replied: number;
        inProgress: number;
        noResponse: number;
      };
      monthlySummary: {
        totalEmailsSent: number;
        emailsOpened: number;
        repliesReceived: number;
      };
      lastUpdated: string;
    }>(`/reports/analytics${query ? `?${query}` : ''}`);
  }

  async getReportsPerformanceTrends(params?: { days?: number; sequenceId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.days) searchParams.append('days', params.days.toString());
    if (params?.sequenceId) searchParams.append('sequenceId', params.sequenceId);

    const query = searchParams.toString();
    return this.request<{
      trends: Array<{
        date: string;
        sent: number;
        opened: number;
        replied: number;
        bounced: number;
        openRate: number;
        replyRate: number;
        bounceRate: number;
      }>;
      period: string;
      totalDays: number;
    }>(`/reports/performance-trends${query ? `?${query}` : ''}`);
  }

  async getReportsCampaignPerformance(params?: { limit?: number; sequenceId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.sequenceId) searchParams.append('sequenceId', params.sequenceId);

    const query = searchParams.toString();
    return this.request<{
      campaigns: Array<{
        sequenceId: string;
        sequenceName: string;
        enrollments: number;
        emailsSent: number;
        emailsOpened: number;
        emailsReplied: number;
        openRate: number;
        replyRate: number;
      }>;
      totalCampaigns: number;
    }>(`/reports/campaign-performance${query ? `?${query}` : ''}`);
  }

  async getReportsRealTimeStats() {
    return this.request<{
      last24Hours: {
        emailsSent: number;
        emailsOpened: number;
        emailsReplied: number;
        newEnrollments: number;
      };
      activeEnrollments: number;
      recentActivity: Array<{
        id: string;
        type: string;
        timestamp: string;
        contactEmail: string;
        sequenceName: string;
      }>;
      lastUpdated: string;
    }>('/reports/real-time-stats');
  }

  // Campaign Management API
  async getCampaigns(params?: { page?: number; limit?: number; isActive?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());

    const query = searchParams.toString();
    return this.request<{ campaigns: Campaign[]; pagination: any }>(`/campaigns${query ? `?${query}` : ''}`);
  }

  async createCampaign(campaign: {
    campaign_name: string;
    description?: string;
    sequence_id: string;
    lead_ids: string[];
    start_date?: string;
    end_date?: string;
  }) {
    return this.request<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaign),
    });
  }

  async getCampaign(id: string) {
    return this.request<Campaign>(`/campaigns/${id}`);
  }

  async updateCampaign(id: string, updates: {
    campaignName?: string;
    description?: string;
    leadIds?: string[];
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  }) {
    return this.request<Campaign>(`/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteCampaign(id: string) {
    return this.request<void>(`/campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  async getCampaignStats(params?: { campaignId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.campaignId) searchParams.append('campaignId', params.campaignId);

    const query = searchParams.toString();
    return this.request<{
      campaigns: Array<{
        campaignId: string;
        campaignName: string;
        emailsSent: number;
        emailsOpened: number;
        emailsReplied: number;
        emailsBounced: number;
        openRate: number;
        replyRate: number;
        bounceRate: number;
      }>;
      totalCampaigns: number;
    }>(`/reports/campaign-analytics${query ? `?${query}` : ''}`);
  }

}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);
