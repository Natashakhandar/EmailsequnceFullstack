// API configuration and utilities for the email sequencing backend

// Prefer VITE_API_URL, fallback to VITE_API_BASE_URL, then localhost
const RAW_BASE = (import.meta as any).env?.VITE_API_URL
  || (import.meta as any).env?.VITE_API_BASE_URL
  || 'http://localhost:3001';

// Ensure exactly one '/api' suffix
const API_BASE_URL = RAW_BASE.endsWith('/api')
  ? RAW_BASE
  : `${RAW_BASE.replace(/\/$/, '')}/api`;

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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
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
    
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', {
        method: 'POST',
      });
    } finally {
      // Always remove token from localStorage
      localStorage.removeItem('auth_token');
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

  async sendTestEmail(data: { to: string; subject?: string; body?: string }) {
    return this.request<any>('/scheduler/test-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

<<<<<<< HEAD
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
=======
  // Email Monitoring API
  async testImapConnection() {
    return this.request<any>('/email-monitoring/test');
  }

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
>>>>>>> 032fc5b2794f9c4bad54c53f65ec8c0185d11707
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);
