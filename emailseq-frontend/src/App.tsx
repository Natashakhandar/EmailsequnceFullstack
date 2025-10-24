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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sequences" element={<SequencesNEW />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/create" element={<CampaignCreate />} />
          <Route path="/email-activity" element={<EmailActivity />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/smtp-settings" element={<SmtpSettings />} />
          <Route path="/sequences-simplified" element={<SimplifiedSequences />} />
          <Route path="/admin-management" element={<AdminManagement />} />
          <Route path="/reports" element={<Reports />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
