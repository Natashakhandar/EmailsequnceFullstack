import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import { TrendingUp, Users, Mail, Activity, Target, Eye, Reply, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import io from "socket.io-client";

const Reports = () => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [campaignPerformanceData, setCampaignPerformanceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Fetching reports data...');
      
      const [analyticsResponse, performanceResponse] = await Promise.all([
        api.getReportsAnalytics().catch(err => {
          console.warn('Analytics API failed:', err.message);
          return null;
        }),
        api.getReportsPerformanceTrends({ days: 30 }).catch(err => {
          console.warn('Performance trends API failed:', err.message);
          return null;
        })
      ]);
      
      console.log('📊 Analytics response:', analyticsResponse);
      console.log('📊 Performance response:', performanceResponse);
      
      // Validate and set analytics data
      if (analyticsResponse && typeof analyticsResponse === 'object') {
        setAnalyticsData(analyticsResponse);
      } else {
        console.warn('Invalid analytics response:', analyticsResponse);
        setAnalyticsData(null);
      }
      
      // Validate and set performance data
      if (performanceResponse && typeof performanceResponse === 'object') {
        setCampaignPerformanceData(performanceResponse);
      } else {
        console.warn('Invalid performance response:', performanceResponse);
        setCampaignPerformanceData(null);
      }
      
      // If all requests failed, show error
      if (!analyticsResponse && !performanceResponse) {
        setError('Unable to load reports data. Please check your connection and try again.');
      }
      
    } catch (err: any) {
      console.error('Failed to fetch analytics data:', err);
      const errorMessage = err?.message || 'Unknown error occurred';
      
      if (errorMessage.includes('404')) {
        setError('Reports API endpoint not found. Please contact support.');
      } else if (errorMessage.includes('500')) {
        setError('Server error occurred. Please try again later.');
      } else if (errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(`Failed to load analytics data: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    
    // Set up socket connection for real-time updates
    const socketConnection = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    setSocket(socketConnection);
    
    // Listen for analytics updates
    socketConnection.on('analyticsUpdate', (data) => {
      console.log('Received analytics update:', data);
      if (data && typeof data === 'object') {
        setAnalyticsData(prev => prev ? { ...prev, ...data } : data);
      }
    });
    
    // Listen for general stats updates
    socketConnection.on('statsUpdate', (data) => {
      console.log('Received stats update:', data);
      if (data && typeof data === 'object') {
        setAnalyticsData(prev => prev ? { ...prev, ...data } : data);
      }
    });
    
    // Handle socket connection errors
    socketConnection.on('connect_error', (error) => {
      console.warn('Socket connection error:', error);
    });
    
    socketConnection.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
    
    // Set up polling as fallback for real-time updates every 30 seconds
    const interval = setInterval(fetchAnalyticsData, 30000);
    
    return () => {
      clearInterval(interval);
      socketConnection.disconnect();
    };
  }, []);

  // Prepare chart data from API response with safe fallbacks
  const statusData = analyticsData?.emailStatusDistribution ? [
    { name: "Sent", value: analyticsData.emailStatusDistribution.sent || 0, color: "hsl(var(--primary))" },
    { name: "Opened", value: analyticsData.emailStatusDistribution.opened || 0, color: "hsl(var(--secondary))" },
    { name: "Replied", value: analyticsData.emailStatusDistribution.replied || 0, color: "hsl(var(--accent))" },
    { name: "Bounced", value: analyticsData.emailStatusDistribution.bounced || 0, color: "hsl(0 70% 60%)" },
  ] : [];

  // Prepare campaign analytics from /api/reports/analytics response
  const campaignAnalytics = analyticsData?.campaignBreakdown || [];
  
  // Add debug logging for campaign analytics as requested
  console.log("✅ Loaded campaign analytics:", analyticsData?.campaignBreakdown);
  console.log("📊 Analytics data structure:", {
    hasAnalyticsData: !!analyticsData,
    hasCampaignBreakdown: !!analyticsData?.campaignBreakdown,
    campaignBreakdownLength: analyticsData?.campaignBreakdown?.length || 0,
    analyticsDataKeys: analyticsData ? Object.keys(analyticsData) : []
  });
  
  // Enhanced debug logging for each campaign
  if (campaignAnalytics.length > 0) {
    console.log("📊 Individual campaign data:");
    campaignAnalytics.forEach((campaign, index) => {
      console.log(`Campaign ${index + 1}:`, {
        name: campaign.name,
        sent: campaign.sent,
        opened: campaign.opened,
        replied: campaign.replied,
        bounced: campaign.bounced,
        openRate: campaign.openRate,
        replyRate: campaign.replyRate
      });
    });
  } else {
    console.warn("⚠️ No campaign analytics found. Check if:");
    console.warn("- Backend /api/reports/analytics returns campaignBreakdown array");
    console.warn("- Campaign data has correct field names: name, sent, opened, replied, bounced");
  }
  
  // Prepare bar chart data for campaign performance using processed analytics
  const campaignBarData = campaignAnalytics.slice(0, 5).map((campaign: any) => ({
    name: campaign.name,
    Sent: campaign.sent,
    Opened: campaign.opened,
    Replied: campaign.replied,
    Bounced: campaign.bounced
  }));

  // Use processed campaign analytics for pie chart data
  const campaignPieData = campaignAnalytics.length > 0 ? [
    { name: "Sent", value: campaignAnalytics.reduce((sum: number, c: any) => sum + c.sent, 0), color: "hsl(var(--primary))" },
    { name: "Opened", value: campaignAnalytics.reduce((sum: number, c: any) => sum + c.opened, 0), color: "hsl(var(--secondary))" },
    { name: "Replied", value: campaignAnalytics.reduce((sum: number, c: any) => sum + c.replied, 0), color: "hsl(var(--accent))" },
    { name: "Bounced", value: campaignAnalytics.reduce((sum: number, c: any) => sum + c.bounced, 0), color: "hsl(0 70% 60%)" },
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-20 pb-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading analytics data...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-20 pb-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-destructive mb-2">Failed to Load Reports</h2>
                <p className="text-muted-foreground">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please check your internet connection and try again.
                </p>
              </div>
              <button 
                onClick={fetchAnalyticsData}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                disabled={loading}
              >
                {loading ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Check if we have any data to display
  const hasData = analyticsData;
  const hasAnalyticsData = analyticsData && Object.keys(analyticsData).length > 0;
  const hasCampaignData = campaignAnalytics.length > 0;
  
  // Debug logging for campaign data validation
  console.log('📊 Campaign Analytics Debug:', {
    rawCampaigns: analyticsData?.campaignBreakdown?.length || 0,
    processedCampaigns: campaignAnalytics.length,
    sampleCampaign: campaignAnalytics[0] || null,
    hasCampaignData
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />

      <main className="container mx-auto px-6 pt-20 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and performance insights
          </p>
        </motion.div>

        {/* No Data Message */}
        {!hasData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="glass rounded-2xl p-8 shadow-card">
              <h3 className="text-xl font-semibold mb-4">No Data Available</h3>
              <p className="text-muted-foreground mb-6">
                There's no analytics data to display yet. This could be because:
              </p>
              <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto mb-6 space-y-2">
                <li>• No campaigns have been created</li>
                <li>• No emails have been sent yet</li>
                <li>• The system is still collecting data</li>
              </ul>
              <button 
                onClick={fetchAnalyticsData}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </motion.div>
        )}

        {/* Metric Cards */}
        {hasAnalyticsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Campaigns"
              value={analyticsData?.totalCampaigns?.toString() || "0"}
              icon={Mail}
              trend="Active sequences"
              delay={0.1}
            />
            <MetricCard
              title="Total Emails"
              value={analyticsData?.emailStatusDistribution?.sent?.toLocaleString() || "0"}
              icon={Activity}
              trend="Emails sent"
              delay={0.15}
            />
            <MetricCard
              title="Opened"
              value={analyticsData?.emailStatusDistribution?.opened?.toLocaleString() || "0"}
              icon={Eye}
              trend={`${analyticsData?.emailStatusDistribution?.sent > 0 ? (((analyticsData?.emailStatusDistribution?.opened || 0) / analyticsData.emailStatusDistribution.sent * 100).toFixed(1)) : '0'}% open rate`}
              delay={0.2}
            />
            <MetricCard
              title="Replied"
              value={analyticsData?.emailStatusDistribution?.replied?.toLocaleString() || "0"}
              icon={Reply}
              trend={`${analyticsData?.avgResponseRate?.toFixed(1) || '0'}% reply rate`}
              delay={0.25}
            />
          </div>
        )}

        {/* Charts */}
        {hasAnalyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Status Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-6 shadow-card hover-lift"
          >
            <h3 className="text-lg font-semibold mb-4 text-foreground">Email Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}% (${value})`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  animationDuration={1000}
                  animationBegin={0}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    padding: "12px",
                    boxShadow: "var(--shadow-card)",
                  }}
                  formatter={(value: number, name: string, props: any) => {
                    const total = statusData.reduce((sum, item) => sum + item.value, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return [`${percentage}% – ${value} of ${total} emails`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Campaign Performance Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-2xl p-6 shadow-card hover-lift"
          >
            <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <Target className="w-5 h-5" />
              Campaign Performance
            </h3>
            {campaignBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={campaignBarData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      padding: "12px",
                      boxShadow: "var(--shadow-card)",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} emails`,
                      name
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
                  <Bar dataKey="Sent" fill="hsl(var(--primary))" name="Sent" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Opened" fill="hsl(var(--secondary))" name="Opened" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Replied" fill="hsl(var(--accent))" name="Replied" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Bounced" fill="hsl(0 70% 60%)" name="Bounced" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No campaign data yet</p>
                  <p className="text-sm">Create and run campaigns to see performance metrics</p>
                </div>
              </div>
            )}
          </motion.div>
          </div>
        )}

        {/* Campaign Stats Table */}
        {hasCampaignData ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6 glass rounded-2xl p-6 shadow-card hover-lift"
          >
            <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <Target className="w-5 h-5" />
              Campaign Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Campaign</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Sent</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Opened</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Replied</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Bounced</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Open Rate</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Reply Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignAnalytics.slice(0, 10).map((campaign: any, index: number) => {
                    return (
                      <motion.tr
                        key={campaign.campaignId || `campaign-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + index * 0.05 }}
                        className="border-b border-border/30 hover:bg-muted/30 transition-all duration-200 cursor-pointer group"
                        title={`Click for ${campaign.name} details`}
                      >
                        <td className="py-3 px-2 font-medium group-hover:text-primary transition-colors">
                          {campaign.name || 'Unknown Campaign'}
                        </td>
                        <td className="py-3 px-2 text-center font-medium">
                          {campaign.sent ?? 0}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={(campaign.opened ?? 0) > 0 ? 'text-secondary font-medium' : ''}>
                            {campaign.opened ?? 0}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={(campaign.replied ?? 0) > 0 ? 'text-accent font-medium' : ''}>
                            {campaign.replied ?? 0}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={(campaign.bounced ?? 0) > 0 ? 'text-destructive font-medium' : ''}>
                            {campaign.bounced ?? 0}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-medium">
                          <span className={(campaign.openRate ?? 0) > 0 ? 'text-secondary' : 'text-muted-foreground'}>
                            {(campaign.openRate ?? 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-medium">
                          <span className={(campaign.replyRate ?? 0) > 0 ? 'text-accent' : 'text-muted-foreground'}>
                            {(campaign.replyRate ?? 0).toFixed(1)}%
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : hasAnalyticsData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6 glass rounded-2xl p-6 shadow-card"
          >
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No campaign data yet</h3>
              <p className="text-muted-foreground mb-4">
                Create and run campaigns to see detailed performance breakdown
              </p>
              <button 
                onClick={fetchAnalyticsData}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </motion.div>
        )}

        {/* Summary Stats */}
        {hasAnalyticsData && (
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6 glass rounded-2xl p-8 shadow-card hover-lift"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-foreground">Monthly Summary</h3>
            <div className="flex items-center text-xs text-muted-foreground">
              <Activity className="w-3 h-3 mr-1" />
              Last updated: {analyticsData?.lastUpdated ? new Date(analyticsData.lastUpdated).toLocaleTimeString() : 'Never'}
              {socket?.connected && <span className="ml-2 text-green-600">● Live</span>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              className="text-center p-6 rounded-xl bg-primary/5 transition-smooth hover:bg-primary/10"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-3xl font-bold text-primary mb-2">{analyticsData?.monthlySummary?.totalEmailsSent?.toLocaleString() || '0'}</p>
              <p className="text-sm text-muted-foreground font-medium">Total Emails Sent</p>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </motion.div>
            <motion.div 
              className="text-center p-6 rounded-xl bg-secondary/5 transition-smooth hover:bg-secondary/10"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-3xl font-bold text-secondary mb-2">{analyticsData?.monthlySummary?.emailsOpened?.toLocaleString() || '0'}</p>
              <p className="text-sm text-muted-foreground font-medium">Emails Opened</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(analyticsData?.monthlySummary?.totalEmailsSent || 0) > 0 
                  ? `${(((analyticsData?.monthlySummary?.emailsOpened || 0) / (analyticsData?.monthlySummary?.totalEmailsSent || 1)) * 100).toFixed(1)}% of sent`
                  : '0% of sent'
                }
              </p>
            </motion.div>
            <motion.div 
              className="text-center p-6 rounded-xl bg-accent/5 transition-smooth hover:bg-accent/10"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-3xl font-bold text-accent mb-2">{analyticsData?.monthlySummary?.repliesReceived?.toLocaleString() || '0'}</p>
              <p className="text-sm text-muted-foreground font-medium">Replies Received</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(analyticsData?.monthlySummary?.totalEmailsSent || 0) > 0 
                  ? `${(((analyticsData?.monthlySummary?.repliesReceived || 0) / (analyticsData?.monthlySummary?.totalEmailsSent || 1)) * 100).toFixed(1)}% of sent`
                  : '0% of sent'
                }
              </p>
            </motion.div>
          </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Reports;
