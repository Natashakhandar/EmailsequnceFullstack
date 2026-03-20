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

type PageStatus = "loading" | "ready" | "submitting" | "success" | "resubscribed" | "already" | "invalid" | "error";

const UnsubscribePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isResubscribing, setIsResubscribing] = useState(false);

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

  const handleResubscribe = async () => {
    setIsResubscribing(true);
    try {
      const url = `${API_BASE_URL}/unsubscribe/resubscribe`;
      console.log('📤 Submitting resubscribe to:', url);
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      console.log('✅ Resubscribe response:', { status: res.status, data });
      
      if (res.ok && data.success) {
        setStatus("resubscribed");
        setEmail(data.email || email);
      } else {
        setErrorMsg(data.error || "Failed to resubscribe. Please try again.");
        setStatus("error");
      }
    } catch (error) {
      console.error('❌ Error during resubscribe:', error);
      setErrorMsg(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus("error");
    } finally {
      setIsResubscribing(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
        padding: "20px",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "48px 40px",
          maxWidth: "540px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          animation: "slideIn 0.5s ease-out",
        }}
      >
        {/* Loading */}
        {status === "loading" && (
          <>
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "3px solid #f0f0f0",
                borderTop: "3px solid #667eea",
                borderRadius: "50%",
                margin: "0 auto 24px",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <h2 style={{ color: "#333", marginBottom: "8px", fontSize: "24px", fontWeight: "600" }}>Loading</h2>
            <p style={{ color: "#888", fontSize: "15px" }}>Please wait while we verify your link...</p>
          </>
        )}

        {/* Already unsubscribed */}
        {status === "already" && (
          <>
            <div style={{ fontSize: "64px", marginBottom: "20px", animation: "pulse 2s ease-in-out infinite" }}>✅</div>
            <h2 style={{ color: "#2e7d32", marginBottom: "12px", fontSize: "28px", fontWeight: "600" }}>
              Already Unsubscribed
            </h2>
            <p style={{ color: "#666", fontSize: "15px", lineHeight: "1.6", marginBottom: "28px" }}>
              You have already been unsubscribed from our mailing list(s). No further action is needed.
            </p>
            
            <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "24px" }}>
              <p style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>
                Changed your mind?
              </p>
              <button
                onClick={handleResubscribe}
                disabled={isResubscribing}
                style={{
                  width: "100%",
                  padding: "12px 28px",
                  fontSize: "15px",
                  fontWeight: "600",
                  border: "2px solid #667eea",
                  borderRadius: "8px",
                  cursor: isResubscribing ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  background: isResubscribing ? "#f5f5f5" : "#fff",
                  color: isResubscribing ? "#999" : "#667eea",
                  opacity: isResubscribing ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isResubscribing) {
                    e.currentTarget.style.background = "#667eea";
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isResubscribing) {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.color = "#667eea";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                {isResubscribing ? "Processing..." : "Yes, Re-subscribe Me"}
              </button>
              <p style={{ color: "#999", fontSize: "13px", marginTop: "12px", margin: "12px 0 0 0" }}>
                We'll add your email back to our mailing list
              </p>
            </div>
          </>
        )}

        {/* Invalid / Error */}
        {(status === "invalid" || status === "error") && (
          <>
            <div style={{ fontSize: "64px", marginBottom: "20px" }}>❌</div>
            <h2 style={{ color: "#d32f2f", marginBottom: "12px", fontSize: "28px", fontWeight: "600" }}>
              {status === "invalid" ? "Invalid Link" : "Something Went Wrong"}
            </h2>
            <p style={{ color: "#666", fontSize: "15px", lineHeight: "1.6" }}>
              {errorMsg || "This unsubscribe link is invalid or has expired. Please try requesting a new unsubscribe link."}
            </p>
            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e0e0e0" }}>
              <p style={{ color: "#888", fontSize: "14px" }}>
                Need help? Contact our support team for assistance.
              </p>
            </div>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <div style={{ fontSize: "64px", marginBottom: "20px", animation: "pulse 2s ease-in-out infinite" }}>✅</div>
            <h2 style={{ color: "#2e7d32", marginBottom: "8px", fontSize: "28px", fontWeight: "600" }}>
              Unsubscribed Successfully
            </h2>
            <div
              style={{
                background: "#f0f8f0",
                padding: "16px",
                borderRadius: "8px",
                margin: "20px 0",
                borderLeft: "4px solid #2e7d32",
              }}
            >
              <p style={{ color: "#1b5e20", fontWeight: "600", fontSize: "16px", margin: "0 0 4px 0" }}>
                {email}
              </p>
              <p style={{ color: "#388e3c", fontSize: "14px", margin: "0" }}>
                has been unsubscribed from our mailing list(s)
              </p>
            </div>
            <p style={{ color: "#666", fontSize: "15px", lineHeight: "1.6" }}>
              You will no longer receive emails from us. Thank you for letting us know your preferences.
            </p>
          </>
        )}

        {/* Re-subscribed */}
        {status === "resubscribed" && (
          <>
            <div style={{ fontSize: "64px", marginBottom: "20px", animation: "pulse 2s ease-in-out infinite" }}>✅</div>
            <h2 style={{ color: "#2e7d32", marginBottom: "8px", fontSize: "28px", fontWeight: "600" }}>
              Re-subscribed Successfully
            </h2>
            <div
              style={{
                background: "#f0f8f0",
                padding: "16px",
                borderRadius: "8px",
                margin: "20px 0",
                borderLeft: "4px solid #2e7d32",
              }}
            >
              <p style={{ color: "#1b5e20", fontWeight: "600", fontSize: "16px", margin: "0 0 4px 0" }}>
                {email}
              </p>
              <p style={{ color: "#388e3c", fontSize: "14px", margin: "0" }}>
                has been re-subscribed to our mailing list
              </p>
            </div>
            <p style={{ color: "#666", fontSize: "15px", lineHeight: "1.6" }}>
              Welcome back! You will now receive emails from us again.
            </p>
          </>
        )}

        {/* Ready: show form */}
        {(status === "ready" || status === "submitting") && (
          <>
            <div
              style={{
                background: "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)",
                padding: "16px",
                borderRadius: "12px",
                marginBottom: "28px",
                border: "1px solid #667eea30",
              }}
            >
              <p style={{ color: "#667eea", fontWeight: "600", fontSize: "16px", margin: "0" }}>
                {email}
              </p>
              <p style={{ color: "#888", fontSize: "14px", margin: "4px 0 0 0" }}>
                is subscribed to our mailing list(s)
              </p>
            </div>

            <div style={{ marginBottom: "28px" }}>
              <h3 style={{ color: "#333", marginBottom: "8px", fontSize: "20px", fontWeight: "600" }}>
                Unsubscribe from our mailing list
              </h3>
              <p style={{ color: "#666", fontSize: "15px", lineHeight: "1.6", margin: "0" }}>
                To help us improve our services, please let us know why you're unsubscribing:
              </p>
            </div>

            {/* Custom styled select */}
            <div style={{ position: "relative", marginBottom: "28px" }}>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={status === "submitting"}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  fontSize: "15px",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  appearance: "none",
                  backgroundColor: "#fff",
                  cursor: status === "submitting" ? "not-allowed" : "pointer",
                  color: reason ? "#333" : "#999",
                  fontWeight: "500",
                  transition: "all 0.3s ease",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#667eea";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#e0e0e0";
                  e.currentTarget.style.boxShadow = "none";
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
                  right: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#667eea",
                  fontSize: "14px",
                  fontWeight: "600",
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
                padding: "14px 28px",
                fontSize: "16px",
                fontWeight: "600",
                border: "none",
                borderRadius: "8px",
                cursor: !reason || status === "submitting" ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                background:
                  !reason || status === "submitting"
                    ? "#ccc"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "#fff",
                boxShadow:
                  !reason || status === "submitting"
                    ? "none"
                    : "0 4px 15px rgba(102, 126, 234, 0.4)",
                textShadow: !reason || status === "submitting" ? "none" : "0 1px 2px rgba(0,0,0,0.1)",
              }}
              onMouseEnter={(e) => {
                if (reason && status !== "submitting") {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.5)";
                }
              }}
              onMouseLeave={(e) => {
                if (reason && status !== "submitting") {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
                }
              }}
            >
              {status === "submitting" ? "Processing..." : "Unsubscribe"}
            </button>

            {reason && (
              <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #e0e0e0" }}>
                <p style={{ color: "#888", fontSize: "13px", margin: "0" }}>
                  ✓ We've noted your reason and will use your feedback to improve our service
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UnsubscribePage;
