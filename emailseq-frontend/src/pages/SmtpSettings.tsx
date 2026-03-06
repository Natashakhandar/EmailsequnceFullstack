import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";

const SmtpSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Save status states
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Connection mapping state
  const [smtpConnected, setSmtpConnected] = useState<boolean | null>(null);
  const [imapConnected, setImapConnected] = useState<boolean | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [verifyingImap, setVerifyingImap] = useState(false);
  const [testing, setTesting] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<null | { success: boolean; message?: string; error?: string }>(null);

  // Form State
  const [formData, setFormData] = useState({
    smtpHost: '',
    smtpPort: '',
    smtpSecure: true,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
    imapHost: '',
    imapPort: '',
    imapTls: true,
    imapUser: '',
    imapPassword: '',
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.getSmtpStatus();
        if (res.smtp) {
          setSmtpConnected(!!res.connected);

          setFormData(prev => ({
            ...prev,
            smtpHost: res.smtp.host || '',
            smtpPort: res.smtp.port ? res.smtp.port.toString() : '',
            smtpSecure: res.smtp.secure ?? true,
            smtpUser: res.smtp.user || '',
            smtpPassword: res.smtp.password || '',
            fromEmail: res.smtp.fromEmail || '',
            fromName: res.smtp.fromName || '',
          }));
        }
        if (res.imap) {
          setImapConnected(!!res.imapConnected);

          setFormData(prev => ({
            ...prev,
            imapHost: res.imap.host || '',
            imapPort: res.imap.port ? res.imap.port.toString() : '',
            imapTls: res.imap.tls ?? true,
            imapUser: res.imap.user || '',
            imapPassword: res.imap.password || '',
          }));
        }
      } catch (e) {
        console.error("Failed to fetch SMTP settings:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      await api.saveSmtpConfig(formData);
      setSaveSuccess("Settings saved successfully!");
      // reverify
      handleVerifySmtp();
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifySmtp = async () => {
    setVerifying(true);
    setSaveError(null);
    try {
      // Test with CURRENT form data
      const res = await api.testSmtpConnection(formData);
      setSmtpConnected(!!res.success);
      if (res.success) {
        setSaveSuccess("SMTP connection verified successfully!");
      }
    } catch (e: any) {
      setSmtpConnected(false);
      setSaveError(e?.message || "SMTP connection failed. Check your host, port, and credentials.");
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyImap = async () => {
    setVerifyingImap(true);
    setSaveError(null);
    try {
      // Test with CURRENT form data
      const res = await api.testImapWithConfig(formData);
      setImapConnected(!!res.success);
      if (res.success) {
        setSaveSuccess("IMAP connection verified successfully!");
      }
    } catch (e: any) {
      setImapConnected(false);
      setSaveError(e?.message || "IMAP connection failed. Check your host, port, and credentials.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const trimmedEmail = testEmail.trim();
    if (!trimmedEmail) return;

    setTesting(true);
    setTestResult(null);
    try {
      // Pass the CURRENT form data + the recipient email
      const res = await api.sendTestEmail({
        to: trimmedEmail,
        ...formData
      });
      setTestResult({ success: true, message: `Test email sent to ${trimmedEmail} using current form settings!` });
    } catch (e: any) {
      setStatus({ success: false, error: e.message || "SMTP verification failed" });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-20 pb-12 max-w-4xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading SMTP settings...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />
      <main className="container mx-auto px-6 pt-20 pb-12 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Email Configuration</h1>
            <p className="text-muted-foreground">
              Configure your specific SMTP and IMAP settings to send and monitor emails.
            </p>
          </div>
          <div>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50 text-sm font-medium">
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-4 rounded-md px-4 py-3 bg-emerald-500/10 text-emerald-600 font-medium">
            {saveSuccess}
          </div>
        )}

        {saveError && (
          <div className="mb-4 rounded-md px-4 py-3 bg-red-500/10 text-red-600 font-medium">
            {saveError}
          </div>
        )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">SMTP Host</label>
                  <input name="smtpHost" value={config.smtpHost} onChange={handleChange} placeholder="smtp.hostinger.com" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Host</label>
                <input name="smtpHost" value={formData.smtpHost} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="smtp.example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Port</label>
                  <input name="smtpPort" value={formData.smtpPort} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="465" />
                </div>
                <div className="flex flex-col gap-1 justify-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="smtpSecure" checked={formData.smtpSecure} onChange={handleInputChange} className="rounded border-border" />
                    <span className="text-sm font-medium">SSL/TLS</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Username</label>
                <input name="smtpUser" value={formData.smtpUser} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="you@example.com" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Password</label>
                <input name="smtpPassword" type="password" value={formData.smtpPassword} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="••••••••" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">From Email</label>
                <input name="fromEmail" value={formData.fromEmail} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="you@example.com" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">From Name</label>
                <input name="fromName" value={formData.fromName} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="Your Name" />
              </div>
            </div>

            <button onClick={handleVerifySmtp} disabled={verifying} className="w-full px-4 py-2 mt-4 rounded-md bg-muted text-foreground border border-border disabled:opacity-50 text-sm font-medium hover:bg-muted/80">
              {verifying ? "Verifying..." : "Verify SMTP Connection"}
            </button>
          </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">From Name</label>
                  <input name="fromName" value={config.fromName} onChange={handleChange} placeholder="John Doe" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
                <h2 className="text-lg font-semibold">Incoming (IMAP)</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <>
                  <div className={`w-2.5 h-2.5 rounded-full ${imapConnected === true ? 'bg-emerald-500' : imapConnected === false ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                  <span className={`text-xs font-medium ${imapConnected === true ? 'text-emerald-600' : imapConnected === false ? 'text-red-600' : 'text-yellow-600'}`}>
                    {imapConnected === true ? 'Connected' : imapConnected === false ? 'Failed' : 'Not tested'}
                  </span>
                </>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Host</label>
                <input name="imapHost" value={formData.imapHost} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="imap.example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Port</label>
                  <input name="imapPort" value={formData.imapPort} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="993" />
                </div>
                <div className="flex flex-col gap-1 justify-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="imapTls" checked={formData.imapTls} onChange={handleInputChange} className="rounded border-border" />
                    <span className="text-sm font-medium">SSL/TLS</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Username</label>
                <input name="imapUser" value={formData.imapUser} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="you@example.com" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Password</label>
                <input name="imapPassword" type="password" value={formData.imapPassword} onChange={handleInputChange} className="input bg-background border border-border rounded-md px-3 py-2" placeholder="••••••••" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Purpose</label>
                <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">Reply detection & email monitoring</div>
              </div>
            </div>

            <button onClick={handleVerifyImap} disabled={verifyingImap} className="w-full px-4 py-2 mt-4 rounded-md bg-muted text-foreground border border-border disabled:opacity-50 text-sm font-medium hover:bg-muted/80">
              {verifyingImap ? "Verifying..." : "Verify IMAP Connection"}
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-muted/10 p-6 rounded-2xl border border-border/50">
            <div className="flex-1 w-full max-w-sm">
              <label className="text-xs font-medium text-muted-foreground uppercase opacity-70 block mb-1">Verify with Test Recipient</label>
              <div className="flex gap-2">
                <input value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder="someone@example.com" className="flex-1 bg-background border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                <button type="button" onClick={handleVerify} disabled={verifying} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50">
                  {verifying ? "Verifying..." : "Verify Connection"}
                </button>
              </div>
            </div>
            <button
              onClick={handleTest}
              disabled={testing || !testEmail}
              className="px-6 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50 font-medium hover:bg-blue-700 transition-colors"
            >
              {testing ? "Sending..." : "Send Test"}
            </button>
          </div>

          {testResult && (
            <div className={`rounded-md px-4 py-3 ${testResult.success ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
              <div className="font-medium">{testResult.success ? testResult.message : testResult.error}</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SmtpSettings;

