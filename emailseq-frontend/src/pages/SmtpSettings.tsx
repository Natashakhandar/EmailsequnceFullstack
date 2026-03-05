import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";

const SmtpSettings = () => {
  const [smtpConfig, setSmtpConfig] = useState<any>(null);
  const [imapConfig, setImapConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [smtpConnected, setSmtpConnected] = useState(false);
  const [imapConnected, setImapConnected] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyingImap, setVerifyingImap] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<null | { success: boolean; message?: string; error?: string }>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.getSmtpStatus();
        if (res.smtp) {
          setSmtpConfig(res.smtp);
          setSmtpConnected(!!res.connected);
        }
        if (res.imap) {
          setImapConfig(res.imap);
        }
      } catch (e) {
        console.error("Failed to fetch config:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleVerifySmtp = async () => {
    setVerifying(true);
    try {
      const res = await api.getSmtpStatus();
      setSmtpConnected(!!res.connected);
    } catch {
      setSmtpConnected(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyImap = async () => {
    setVerifyingImap(true);
    try {
      const res = await api.testImapConnection();
      setImapConnected(!!res.success);
    } catch {
      setImapConnected(false);
    } finally {
      setVerifyingImap(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.sendTestEmail({ to: testEmail });
      setTestResult({ success: true, message: res?.message || "Test email sent!" });
    } catch (e: any) {
      setTestResult({ success: false, error: e?.message || "Failed to send test email" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-20 pb-12 max-w-4xl">
          <h1 className="text-3xl font-bold mb-6">Email Configuration</h1>
          <div className="glass rounded-2xl p-6 shadow-card flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading configuration...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />
      <main className="container mx-auto px-6 pt-20 pb-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Email Configuration</h1>
        <p className="text-muted-foreground mb-6">
          Configured via backend <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.env</code> file. Restart server after changes.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outgoing (SMTP) */}
          <div className="glass rounded-2xl p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                </div>
                <h2 className="text-lg font-semibold">Outgoing (SMTP)</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${smtpConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <span className={`text-xs font-medium ${smtpConnected ? 'text-emerald-600' : 'text-red-600'}`}>
                  {smtpConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Host</label>
                <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{smtpConfig?.host || '—'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Port</label>
                  <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{smtpConfig?.port || '—'}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Encryption</label>
                  <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{smtpConfig?.secure ? 'SSL/TLS' : 'None'}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Username</label>
                <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{smtpConfig?.user || '—'}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">From Email</label>
                <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{smtpConfig?.fromEmail || '—'}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">From Name</label>
                <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{smtpConfig?.fromName || '—'}</div>
              </div>
            </div>

            <button onClick={handleVerifySmtp} disabled={verifying} className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50 text-sm font-medium">
              {verifying ? "Verifying..." : "Verify SMTP Connection"}
            </button>
          </div>

          {/* Incoming (IMAP) */}
          <div className="glass rounded-2xl p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
                </div>
                <h2 className="text-lg font-semibold">Incoming (IMAP)</h2>
              </div>
              <div className="flex items-center gap-1.5">
                {imapConfig?.configured ? (
                  <>
                    <div className={`w-2.5 h-2.5 rounded-full ${imapConnected === true ? 'bg-emerald-500' : imapConnected === false ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                    <span className={`text-xs font-medium ${imapConnected === true ? 'text-emerald-600' : imapConnected === false ? 'text-red-600' : 'text-yellow-600'}`}>
                      {imapConnected === true ? 'Connected' : imapConnected === false ? 'Failed' : 'Not tested'}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div>
                    <span className="text-xs font-medium text-gray-500">Not configured</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Host</label>
                <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{imapConfig?.host || '—'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Port</label>
                  <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{imapConfig?.port || '—'}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Encryption</label>
                  <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{imapConfig?.tls ? 'SSL/TLS' : 'None'}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Username</label>
                <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">{imapConfig?.user || '—'}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Purpose</label>
                <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">Reply detection & email monitoring</div>
              </div>
            </div>

            <button onClick={handleVerifyImap} disabled={verifyingImap || !imapConfig?.configured} className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50 text-sm font-medium">
              {verifyingImap ? "Verifying..." : "Verify IMAP Connection"}
            </button>
          </div>
        </div>

        {/* Test Email Section */}
        <div className="glass rounded-2xl p-6 shadow-card mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Send Test Email</h2>
          <p className="text-sm text-muted-foreground">Send a test email to verify your outgoing SMTP configuration is working correctly.</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Recipient Email</label>
              <input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="input bg-background border border-border rounded-md px-3 py-2"
              />
            </div>
            <button
              onClick={handleTest}
              disabled={testing || !testEmail}
              className="px-6 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50 font-medium"
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

        {/* Server Info Table */}
        <div className="glass rounded-2xl p-6 shadow-card mt-6">
          <h2 className="text-lg font-semibold mb-4">Server Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Protocol</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Host</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Port</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Encryption</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 px-3 font-medium">Outgoing (SMTP)</td>
                  <td className="py-2.5 px-3">{smtpConfig?.host || '—'}</td>
                  <td className="py-2.5 px-3">{smtpConfig?.port || '—'}</td>
                  <td className="py-2.5 px-3">{smtpConfig?.secure ? 'SSL' : '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${smtpConnected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${smtpConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      {smtpConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Incoming (IMAP)</td>
                  <td className="py-2.5 px-3">{imapConfig?.host || '—'}</td>
                  <td className="py-2.5 px-3">{imapConfig?.port || '—'}</td>
                  <td className="py-2.5 px-3">{imapConfig?.tls ? 'SSL' : '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${imapConnected === true ? 'bg-emerald-500/10 text-emerald-600' :
                      imapConnected === false ? 'bg-red-500/10 text-red-600' :
                        imapConfig?.configured ? 'bg-yellow-500/10 text-yellow-600' : 'bg-gray-500/10 text-gray-500'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${imapConnected === true ? 'bg-emerald-500' :
                        imapConnected === false ? 'bg-red-500' :
                          imapConfig?.configured ? 'bg-yellow-500' : 'bg-gray-400'
                        }`}></span>
                      {imapConnected === true ? 'Connected' : imapConnected === false ? 'Failed' : imapConfig?.configured ? 'Not tested' : 'Not configured'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SmtpSettings;
