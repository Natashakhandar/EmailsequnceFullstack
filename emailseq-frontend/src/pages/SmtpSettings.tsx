import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";

type SmtpForm = {
  email: string;
  host: string;
  port: number | string;
  username: string;
  password: string;
  secure: boolean;
};

const SmtpSettings = () => {
  const [form, setForm] = useState<SmtpForm>({
    email: "",
    host: "",
    port: 587,
    username: "",
    password: "",
    secure: false,
  });
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<null | { connected: boolean; message?: string; smtp?: any }>(null);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<null | { success: boolean; message?: string; error?: string }>(null);

  useEffect(() => {
    const saved = localStorage.getItem("smtp_form");
    if (saved) {
      try {
        setForm({ ...form, ...JSON.parse(saved) });
      } catch {}
    }
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const next = { ...form, [name]: type === "checkbox" ? checked : value } as SmtpForm;
    setForm(next);
    localStorage.setItem("smtp_form", JSON.stringify(next));
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.getSmtpStatus();
      setVerifyResult({ connected: !!res.connected, smtp: res.smtp, message: res.connected ? "Connected" : "Not connected" });
    } catch (e: any) {
      setVerifyResult({ connected: false, message: e?.message || "Verification failed" });
    } finally {
      setVerifying(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.sendTestEmail({ to: testEmail });
      setTestResult({ success: true, message: res?.message || "Sent" });
    } catch (e: any) {
      setTestResult({ success: false, error: e?.message || "Failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />
      <main className="container mx-auto px-6 pt-24 pb-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">SMTP Settings</h1>
        <div className="glass rounded-2xl p-6 shadow-card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">From Email</label>
              <input name="email" value={form.email} onChange={onChange} placeholder="you@example.com" className="input bg-background border border-border rounded-md px-3 py-2" />
            </div>
            <div className="flex items-center gap-3 mt-6 md:mt-8">
              <input type="checkbox" name="secure" checked={form.secure} onChange={onChange} className="h-4 w-4" />
              <span className="text-sm">Use secure (TLS/SSL)</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">SMTP Host</label>
              <input name="host" value={form.host} onChange={onChange} placeholder="smtp.gmail.com" className="input bg-background border border-border rounded-md px-3 py-2" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Port</label>
              <input name="port" value={form.port} onChange={onChange} placeholder="587" className="input bg-background border border-border rounded-md px-3 py-2" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Username</label>
              <input name="username" value={form.username} onChange={onChange} placeholder="you@example.com" className="input bg-background border border-border rounded-md px-3 py-2" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Password</label>
              <input type="password" name="password" value={form.password} onChange={onChange} placeholder="••••••••" className="input bg-background border border-border rounded-md px-3 py-2" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleVerify} disabled={verifying} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
              {verifying ? "Verifying..." : "Verify connection"}
            </button>
            <div className="flex items-center gap-2">
              <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@recipient.com" className="input bg-background border border-border rounded-md px-3 py-2" />
              <button onClick={handleTest} disabled={testing || !testEmail} className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground disabled:opacity-50">
                {testing ? "Sending..." : "Send test"}
              </button>
            </div>
          </div>

          {verifyResult && (
            <div className={`rounded-md px-4 py-3 ${verifyResult.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
              <div className="font-medium">{verifyResult.message}</div>
              {verifyResult.smtp && (
                <div className="text-sm mt-1">{verifyResult.smtp.host}:{verifyResult.smtp.port} {verifyResult.smtp.secure ? "(secure)" : ""}</div>
              )}
            </div>
          )}

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
