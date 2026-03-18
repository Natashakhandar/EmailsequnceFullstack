import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import SimplifiedSequences from "./pages/SimplifiedSequences";
import Leads from "./pages/Leads";
import EmailActivity from "./pages/EmailActivity";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import SequencesNEW from "./pages/Sequences.NEW";
import TemplatesPage from "./pages/TemplatesPage";
import AdminManagement from "./pages/AdminManagement";
import SmtpSettings from "./pages/SmtpSettings";
import CampaignCreate from "./pages/CampaignCreate";
import Campaigns from "./pages/Campaigns";

import { api } from "@/lib/api";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!api.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/sequences" element={<ProtectedRoute><SequencesNEW /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
          <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
          <Route path="/campaigns/create" element={<ProtectedRoute><CampaignCreate /></ProtectedRoute>} />
          <Route path="/email-activity" element={<ProtectedRoute><EmailActivity /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/smtp-settings" element={<ProtectedRoute><SmtpSettings /></ProtectedRoute>} />
          <Route path="/sequences-simplified" element={<ProtectedRoute><SimplifiedSequences /></ProtectedRoute>} />
          <Route path="/admin-management" element={<ProtectedRoute><AdminManagement /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
