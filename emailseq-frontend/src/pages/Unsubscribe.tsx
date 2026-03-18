import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';
import { toast } from 'sonner';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('contactId');
  const enrollmentId = searchParams.get('enrollmentId');
  const token = searchParams.get('token');
  const alreadyUnsubscribedParam = searchParams.get('alreadyUnsubscribed') === 'true';

  const [loading, setLoading] = useState(Boolean(token || (contactId && enrollmentId)));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyUnsubscribed, setAlreadyUnsubscribed] = useState(alreadyUnsubscribedParam);
  const [showConfirmPopup, setShowConfirmPopup] = useState(Boolean(token));

  const [contactInfo, setContactInfo] = useState({
    email: '',
    firstName: '',
    lastName: '',
  });

  const [unsubscribeData, setUnsubscribeData] = useState({
    reason: '',
    customReason: '',
  });

  const reasons = [
    'Too many emails',
    'Irrelevant content',
    'Already subscribed elsewhere',
    'No longer interested',
    'Other',
  ];

  useEffect(() => {
    if (token) {
      processAutomaticUnsubscribeToken();
    } else if (contactId && enrollmentId) {
      loadContactInfo();
    }
  }, [token, contactId, enrollmentId]);

  const processAutomaticUnsubscribeToken = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/unsubscribe/${token}?json=true`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Invalid unsubscribe link');
      }

      setContactInfo({
        email: data?.contact?.email || '',
        firstName: data?.contact?.firstName || '',
        lastName: data?.contact?.lastName || '',
      });

      setAlreadyUnsubscribed(Boolean(data?.alreadyUnsubscribed));
    } catch (err) {
      console.error('Error processing unsubscribe token:', err);
      setError((err as Error)?.message || 'Failed to validate unsubscribe link');
    } finally {
      setLoading(false);
    }
  };

  const loadContactInfo = async () => {
    try {
      setLoading(true);
      // Public unsubscribe pages should work without authenticated contact lookup.
      setContactInfo({
        email: '',
        firstName: '',
        lastName: '',
      });
    } catch (err) {
      console.error('Error loading contact info:', err);
      // Not fatal, we'll just not show the email
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unsubscribeData.reason) {
      toast.error('Please select a reason');
      return;
    }

    if (unsubscribeData.reason === 'Other' && !unsubscribeData.customReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      setSubmitting(true);
      const finalReason = unsubscribeData.reason === 'Other' 
        ? unsubscribeData.customReason 
        : unsubscribeData.reason;

      // New backend route for submitting reason with token
      if (token) {
        const response = await fetch(`${API_BASE_URL}/unsubscribe/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, reason: finalReason }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to submit feedback');
        }
      } else if (contactId && enrollmentId) {
        await api.unsubscribeFromEmail({
          contactId: contactId!,
          enrollmentId: enrollmentId!,
          reason: finalReason,
        });
      }

      setSubmitted(true);
      toast.success('Successfully unsubscribed');
    } catch (err: any) {
      console.error('Error unsubscribing:', err);
      setError(err.message || 'Failed to unsubscribe. Please try again.');
      toast.error(err.message || 'Failed to unsubscribe');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token && (!contactId || !enrollmentId)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
            <p className="text-gray-600">
              This unsubscribe link is missing required information. Please check your email and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed Successfully</h1>
            <p className="text-gray-600 mb-6">
              You have been unsubscribed from this mailing list. We've noted your feedback and it will help us improve.
            </p>
            <p className="text-sm text-gray-500">
              You can close this page now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <Mail className="w-8 h-8 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Unsubscribe
          </h1>
          <p className="text-gray-600 text-center text-sm mb-8">
            {alreadyUnsubscribed
              ? "You've already been unsubscribed. Please share your reason so we can improve."
              : "We're sorry to see you go. Please let us know why you're unsubscribing so we can improve."}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">Email Address</Label>
              <Input
                type="email"
                value={contactInfo.email}
                disabled
                placeholder="your@email.com"
                className="bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-500">
                This is the email you'll be unsubscribed from
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-gray-700 font-medium">
                Reason for Unsubscribing *
              </Label>
              <Select value={unsubscribeData.reason} onValueChange={(value) => 
                setUnsubscribeData(prev => ({ ...prev, reason: value }))
              }>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {unsubscribeData.reason === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor="customReason" className="text-gray-700 font-medium">
                  Please tell us more *
                </Label>
                <Textarea
                  id="customReason"
                  placeholder="Your feedback helps us improve..."
                  value={unsubscribeData.customReason}
                  onChange={(e) => 
                    setUnsubscribeData(prev => ({ ...prev, customReason: e.target.value }))
                  }
                  className="rounded-lg resize-none"
                  rows={4}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={() => window.history.back()}
              >
                Go Back
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                {submitting ? 'Processing...' : 'Unsubscribe'}
              </Button>
            </div>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Your privacy is important to us. View our privacy policy for more information.
          </p>
        </div>

        {showConfirmPopup && token && (
          <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Unsubscribe</h2>
              <p className="text-gray-600 mb-8 text-base leading-relaxed">
                Do you want to stop getting messages from this mailing list?
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => window.history.back()}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setShowConfirmPopup(false)}
                >
                  Unsubscribe
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
