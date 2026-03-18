import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';

export default function EmailSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingSmtp, setVerifyingSmtp] = useState(false);
  const [verifyingImap, setVerifyingImap] = useState(false);
  const [config, setConfig] = useState({
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
    imapHost: '',
    imapPort: 993,
    imapTls: true,
    imapUser: '',
    imapPassword: '',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getEmailConfig();
      setConfig(prev => ({
        ...prev,
        ...data,
        smtpPassword: prev.smtpPassword,
        imapPassword: prev.imapPassword,
      }));
    } catch (error) {
      console.log('No existing configuration found');
      // Use defaults if not found
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name.includes('Port') ? parseInt(value) : value)
    }));
  };

  const handleSave = async () => {
    if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPassword || !config.fromEmail) {
      toast.error('Please fill in all required SMTP fields');
      return;
    }

    try {
      setSaving(true);
      const response = await api.saveEmailConfig(config);
      toast.success(response.message || 'Email configuration saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save email configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPassword) {
      toast.error('Please fill in all SMTP fields to verify');
      return;
    }

    try {
      setVerifyingSmtp(true);
      await api.verifySMTPConnection({
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpPassword: config.smtpPassword,
      });
      toast.success('SMTP connection verified successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify SMTP connection');
    } finally {
      setVerifyingSmtp(false);
    }
  };

  const handleVerifyImap = async () => {
    if (!config.imapHost || !config.imapPort || !config.imapUser || !config.imapPassword) {
      toast.error('Please fill in all IMAP fields to verify');
      return;
    }

    try {
      setVerifyingImap(true);
      await api.verifyIMAPConnection({
        imapHost: config.imapHost,
        imapPort: config.imapPort,
        imapTls: config.imapTls,
        imapUser: config.imapUser,
        imapPassword: config.imapPassword,
      });
      toast.success('IMAP connection verified successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify IMAP connection');
    } finally {
      setVerifyingImap(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Email Configuration</p>
          <p>Add your SMTP and IMAP credentials to send and receive emails through your email sequencing system.</p>
        </div>
      </div>

      {/* SMTP Configuration */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Outgoing Email (SMTP)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtpHost">SMTP Host *</Label>
              <Input
                id="smtpHost"
                name="smtpHost"
                placeholder="e.g. smtp.hostinger.com"
                value={config.smtpHost}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="smtpPort">SMTP Port *</Label>
              <Input
                id="smtpPort"
                name="smtpPort"
                type="number"
                placeholder="465 or 587"
                value={config.smtpPort}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="smtpUser">SMTP Username *</Label>
              <Input
                id="smtpUser"
                name="smtpUser"
                placeholder="Your email address"
                value={config.smtpUser}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="smtpPassword">SMTP Password *</Label>
              <Input
                id="smtpPassword"
                name="smtpPassword"
                type="password"
                placeholder="Your SMTP password or app password"
                value={config.smtpPassword}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fromEmail">From Email Address *</Label>
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                placeholder="noreply@yourdomain.com"
                value={config.fromEmail}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                name="fromName"
                placeholder="Your Company Name"
                value={config.fromName}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="smtpSecure"
                name="smtpSecure"
                checked={config.smtpSecure}
                onChange={handleChange}
              />
              <Label htmlFor="smtpSecure" className="cursor-pointer">
                Use SSL/TLS Encryption
              </Label>
            </div>
          </div>

          <Button
            onClick={handleVerify}
            disabled={verifyingSmtp || !config.smtpHost || !config.smtpPort}
            variant="outline"
            className="mt-4"
          >
            {verifyingSmtp ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify SMTP Connection'
            )}
          </Button>
        </div>
      </div>

      {/* IMAP Configuration */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Incoming Email (IMAP)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Optional: Required only if you want to receive and monitor replies
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="imapHost">IMAP Host</Label>
              <Input
                id="imapHost"
                name="imapHost"
                placeholder="e.g. imap.hostinger.com"
                value={config.imapHost}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="imapPort">IMAP Port</Label>
              <Input
                id="imapPort"
                name="imapPort"
                type="number"
                placeholder="993"
                value={config.imapPort}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="imapUser">IMAP Username</Label>
              <Input
                id="imapUser"
                name="imapUser"
                placeholder="Your email address"
                value={config.imapUser}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="imapPassword">IMAP Password</Label>
              <Input
                id="imapPassword"
                name="imapPassword"
                type="password"
                placeholder="Your IMAP password"
                value={config.imapPassword}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="imapTls"
                name="imapTls"
                checked={config.imapTls}
                onChange={handleChange}
              />
              <Label htmlFor="imapTls" className="cursor-pointer">
                Use TLS Encryption
              </Label>
            </div>
          </div>

          <Button
            onClick={handleVerifyImap}
            disabled={verifyingImap || !config.imapHost || !config.imapPort}
            variant="outline"
            className="mt-4"
          >
            {verifyingImap ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify IMAP Connection'
            )}
          </Button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>

      {/* Helper Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900">
          <strong>Need help?</strong> Contact your email provider (Hostinger, Gmail, etc.) to get your SMTP credentials.
          For Gmail, you'll need to generate an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">App Password</a>.
        </p>
      </div>
    </motion.div>
  );
}
