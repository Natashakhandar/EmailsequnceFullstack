import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "@/lib/api";

const REASONS = [
  "Your emails are not relevant to me",
  "Your emails are too frequent",
  "I don't remember signing up for this",
  "I no longer want to receive these emails",
  "The emails are spam and should be reported",
  "Others",
];

type PageStatus = "loading" | "ready" | "submitting" | "success" | "already" | "invalid" | "error";

const UnsubscribePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const fetchInfo = async () => {
      try {
        const url = `${API_BASE_URL}/unsubscribe/info/${encodeURIComponent(token)}`;
        console.log('🔗 API_BASE_URL:', API_BASE_URL);
        console.log('🔗 Full URL:', url);
        console.log('🔗 Token:', token);
        
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
        });
        
        console.log('📨 Response status:', res.status);
        console.log('📨 Response headers:', res.headers);
        
        // Check if response is JSON or HTML
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.error('❌ Backend returned HTML instead of JSON (possible server error)');
          setStatus("error");
          setErrorMsg("Backend server error. Please try again later.");
          return;
        }
        
        const data = await res.json();
        console.log('📨 Unsubscribe response:', { status: res.status, data });
        
        if (!res.ok) {
          if (data.alreadyUnsubscribed) {
            setStatus("already");
          } else {
            setStatus("invalid");
            setErrorMsg(data.error || "Invalid unsubscribe link. The token may have expired or already been used.");
          }
        } else {
          if (data.email) {
            setEmail(data.email);
            setStatus("ready");
          } else {
            setStatus("invalid");
            setErrorMsg("No email found in response.");
          }
        }
      } catch (error) {
        console.error('❌ Error fetching unsubscribe info:', error);
        console.error('❌ Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        setStatus("error");
        setErrorMsg(`Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    fetchInfo();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!reason) return;
    setStatus("submitting");

    try {
      const url = `${API_BASE_URL}/unsubscribe/complete`;
      console.log('📤 Submitting unsubscribe to:', url);
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason }),
        // Don't include credentials for public endpoint
      });
      const data = await res.json();
      console.log('✅ Unsubscribe response:', { status: res.status, data });
      
      if (res.ok && data.success) {
        setStatus("success");
      } else if (data.alreadyUnsubscribed) {
        setStatus("already");
      } else {
        setErrorMsg(data.error || "Failed to unsubscribe. Please try again.");
        setStatus("error");
      }
    } catch (error) {
      console.error('❌ Error during unsubscribe:', error);
      setErrorMsg(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus("error");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "8px",
          padding: "40px",
          maxWidth: "520px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        {/* Loading */}
        {status === "loading" && (
          <>
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "4px solid #e0e0e0",
                borderTop: "4px solid #1a73e8",
                borderRadius: "50%",
                margin: "0 auto 16px",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "#555" }}>Loading...</p>
          </>
        )}

        {/* Already unsubscribed */}
        {status === "already" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h2 style={{ color: "#2e7d32", marginBottom: "8px" }}>Already Unsubscribed</h2>
            <p style={{ color: "#555" }}>
              You have already been unsubscribed from our mailing list(s).
            </p>
          </>
        )}

        {/* Invalid / Error */}
        {(status === "invalid" || status === "error") && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>❌</div>
            <h2 style={{ color: "#d32f2f", marginBottom: "8px" }}>
              {status === "invalid" ? "Invalid Link" : "Something Went Wrong"}
            </h2>
            <p style={{ color: "#555" }}>
              {errorMsg || "This unsubscribe link is invalid or has expired."}
            </p>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <p style={{ fontWeight: "bold", marginBottom: "4px" }}>{email}</p>
            <p style={{ color: "#555", marginBottom: "24px" }}>
              has been unsubscribed from our mailing list(s).
            </p>
            <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "24px 0" }} />
            <h2 style={{ color: "#e53935", marginBottom: "8px" }}>
              Unsubscribed Successfully
            </h2>
            <p style={{ color: "#555" }}>You will no longer receive emails from us.</p>
          </>
        )}

        {/* Ready: show form */}
        {(status === "ready" || status === "submitting") && (
          <>
            <p style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "4px" }}>{email}</p>
            <p style={{ color: "#555", marginBottom: "24px" }}>
              is subscribed to our mailing list(s).
            </p>
            <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "20px 0" }} />
            <h2 style={{ color: "#e53935", marginBottom: "8px" }}>
              Unsubscribe from our mailing list
            </h2>
            <p style={{ color: "#555", marginBottom: "20px" }}>
              To help us improve our services, we would be grateful if you could tell us why:
            </p>

            {/* Custom styled select */}
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={status === "submitting"}
                style={{
                  width: "100%",
                  padding: "12px 40px 12px 14px",
                  fontSize: "14px",
                  border: "1px solid #bbb",
                  borderRadius: "4px",
                  appearance: "none",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  color: reason ? "#000" : "#666",
                }}
              >
                <option value="" disabled>
                  Please select reason
                </option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <div
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  fontSize: "12px",
                  color: "#555",
                }}
              >
                ▼
              </div>
            </div>

            <button
              onClick={handleUnsubscribe}
              disabled={!reason || status === "submitting"}
              style={{
                width: "100%",
                maxWidth: "200px",
                padding: "12px 24px",
                backgroundColor: !reason || status === "submitting" ? "#bbb" : "#00bcd4",
                color: "#fff",
                border: "none",
                borderRadius: "24px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: !reason || status === "submitting" ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {status === "submitting" ? "Processing..." : "Unsubscribe"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UnsubscribePage;
