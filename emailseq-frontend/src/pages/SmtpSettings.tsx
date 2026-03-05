import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";

const SmtpSettings = () => {
  const [config, setConfig] = useState({
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: "",
    smtpPass: "",
    fromEmail: "",
    fromName: "",
    imapHost: "",
    imapPort: 993,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [status, setStatus] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.getSmtpSettings();
        if (res) {
          setConfig({
            smtpHost: res.smtpHost || "",
            smtpPort: res.smtpPort || 465,
            smtpSecure: res.smtpSecure !== false,
            smtpUser: res.smtpUser || "",
            smtpPass: res.smtpPass || "",
            fromEmail: res.fromEmail || "",
            fromName: res.fromName || "",
            imapHost: res.imapHost || "",
            imapPort: res.imapPort || 993,
          });
        }
      } catch (e) {
        console.error("Failed to fetch SMTP settings:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setConfig(prev => ({
      ...prev,
      [name]: val
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await api.updateSmtpSettings(config);
      setStatus({ success: true, message: "Settings saved successfully!" });
    } catch (e: any) {
      setStatus({ success: false, error: e.message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setStatus(null);
    try {
      const res = await api.testSmtpSettings({
        ...config,
        testRecipient: testRecipient || undefined
      });
      setStatus({ success: true, message: res.message || "SMTP connection verified!" });
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
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Email Configuration</h1>
          <p className="text-muted-foreground">
            Configure your professional email account provided by Admin. These settings will be used to send your campaigns.
          </p>
        </header>

        {status && (
          <div className={`mb-6 p-4 rounded-xl border ${status.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
            <p className="font-medium flex items-center gap-2">
              {status.success ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              )}
              {status.message || status.error}
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SMTP Section */}
            <section className="glass rounded-2xl p-6 shadow-card space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                </div>
                Outgoing Server (SMTP)
              </h2>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">SMTP Host</label>
                  <input name="smtpHost" value={config.smtpHost} onChange={handleChange} placeholder="smtp.hostinger.com" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">Port</label>
                    <input name="smtpPort" type="number" value={config.smtpPort} onChange={handleChange} placeholder="465" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                  </div>
                  <div className="flex items-center gap-2 h-full mt-6">
                    <input type="checkbox" name="smtpSecure" id="smtpSecure" checked={config.smtpSecure} onChange={(e) => setConfig(prev => ({ ...prev, smtpSecure: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="smtpSecure" className="text-sm">SSL/TLS</label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">Username</label>
                  <input name="smtpUser" value={config.smtpUser} onChange={handleChange} placeholder="user@gmail.com" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">Password</label>
                  <input name="smtpPass" type="password" value={config.smtpPass} onChange={handleChange} placeholder="••••••••" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
              </div>
            </section>

            {/* Sender / IMAP Section */}
            <section className="glass rounded-2xl p-6 shadow-card space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-green-500/10 rounded-lg text-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
                Sender Identity & Incoming
              </h2>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">From Name</label>
                  <input name="fromName" value={config.fromName} onChange={handleChange} placeholder="John Doe" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">From Email</label>
                  <input name="fromEmail" value={config.fromEmail} onChange={handleChange} placeholder="user@gmail.com" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>

                <hr className="my-4 border-dashed border-border/50" />

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">IMAP Host (Optional)</label>
                  <input name="imapHost" value={config.imapHost} onChange={handleChange} placeholder="imap.hostinger.com" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase opacity-70">IMAP Port</label>
                  <input name="imapPort" type="number" value={config.imapPort} onChange={handleChange} placeholder="993" className="w-full bg-muted/30 border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
              </div>
            </section>
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
            <button type="submit" disabled={saving} className="w-full md:w-auto px-10 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold shadow-lg hover:shadow-primary/20 transform active:scale-95 transition-all disabled:opacity-50">
              {saving ? "Saving Settings..." : "Save All Settings"}
            </button>
          </div>
        </form>

        <section className="mt-8 p-6 bg-amber-500/5 rounded-2xl border border-amber-500/10">
          <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            Server Instructions
          </h3>
          <ul className="text-xs text-amber-700/80 space-y-1.5 list-disc pl-4">
            <li>Gmail users may need to generate an <strong>App Password</strong> if 2FA is enabled.</li>
            <li>For SSL connections (Hostinger/Bluehost), use port <strong>465</strong>. For TLS, use <strong>587</strong>.</li>
            <li>Ensure the "From Email" matches your SMTP Username to avoid being marked as spam.</li>
          </ul>
        </section>
      </main>
    </div>
  );
};

export default SmtpSettings;

