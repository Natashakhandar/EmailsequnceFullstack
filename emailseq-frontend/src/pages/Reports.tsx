import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import { TrendingUp, Users, Mail, Activity, Target } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import io from "socket.io-client";

const Reports = () => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [campaignStats, setCampaignStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Fetching reports data...');
      
      const [analyticsResponse, campaignResponse] = await Promise.all([
        api.getReportsAnalytics().catch(err => {
          console.warn('Analytics API failed:', err.message);
          return null;
        }),
        api.getCampaignStats().catch(err => {
          console.warn('Campaign stats API failed:', err.message);
          return null;
        })
      ]);
      
      console.log('📊 Analytics response:', analyticsResponse);
      console.log('📊 Campaign stats response:', campaignResponse);
      
      // Validate and set analytics data
      if (analyticsResponse && typeof analyticsResponse === 'object') {
        setAnalyticsData(analyticsResponse);
      } else {
        console.warn('Invalid analytics response:', analyticsResponse);
        setAnalyticsData(null);
      }
      
      // Validate and set campaign stats
      if (campaignResponse && typeof campaignResponse === 'object') {
        setCampaignStats(campaignResponse);
      } else {
        console.warn('Invalid campaign stats response:', campaignResponse);
        setCampaignStats(null);
      }
      
      // If both requests failed, show error
      if (!analyticsResponse && !campaignResponse) {
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
    
    // Listen for campaign stats updates
    socketConnection.on('campaignStatsUpdate', (data) => {
      console.log('Received campaign stats update:', data);
      if (data && typeof data === 'object') {
        setCampaignStats(data);
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

  const campaignPerformanceData = campaignStats?.campaigns ? campaignStats.campaigns.slice(0, 5).map((campaign: any, index: number) => ({
    name: campaign.campaignName || 'Unknown Campaign',
    emailsSent: campaign.emailsSent || 0,
    emailsOpened: campaign.emailsOpened || 0,
    emailsReplied: campaign.emailsReplied || 0,
    emailsBounced: campaign.emailsBounced || 0,
    color: `hsl(${(index * 72) % 360} 70% 60%)`
  })) : [];

  const campaignPieData = campaignStats?.campaigns ? [
    { name: "Sent", value: campaignStats.campaigns.reduce((sum: number, c: any) => sum + (c.emailsSent || 0), 0), color: "hsl(var(--primary))" },
    { name: "Opened", value: campaignStats.campaigns.reduce((sum: number, c: any) => sum + (c.emailsOpened || 0), 0), color: "hsl(var(--secondary))" },
    { name: "Replied", value: campaignStats.campaigns.reduce((sum: number, c: any) => sum + (c.emailsReplied || 0), 0), color: "hsl(var(--accent))" },
    { name: "Bounced", value: campaignStats.campaigns.reduce((sum: number, c: any) => sum + (c.emailsBounced || 0), 0), color: "hsl(0 70% 60%)" },
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
  const hasData = analyticsData || campaignStats;
  const hasAnalyticsData = analyticsData && Object.keys(analyticsData).length > 0;
  const hasCampaignData = campaignStats?.campaigns && campaignStats.campaigns.length > 0;

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <MetricCard
              title="Total Campaigns"
              value={analyticsData?.totalCampaigns?.toString() || "0"}
              icon={Mail}
              trend="Active sequences"
              delay={0.1}
            />
            <MetricCard
              title="Total Leads"
              value={analyticsData?.totalLeads?.toLocaleString() || "0"}
              icon={Users}
              trend="Total contacts enrolled"
              delay={0.2}
            />
            <MetricCard
              title="Avg. Response Rate"
              value={`${analyticsData?.avgResponseRate?.toFixed(1) || '0'}%`}
              icon={TrendingUp}
              percentage={`${analyticsData?.avgResponseRate?.toFixed(1) || '0'}%`}
              total={`${analyticsData?.emailStatusDistribution?.replied || 0} of ${analyticsData?.emailStatusDistribution?.sent || 0} responded`}
              trend={`Bounce rate: ${analyticsData?.bounceRate?.toFixed(1) || '0'}%`}
              delay={0.3}
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

          {/* Campaign Performance */}
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
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={campaignPieData}
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
                  {campaignPieData.map((entry, index) => (
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
                    const total = campaignPieData.reduce((sum, item) => sum + item.value, 0);
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                    return [`${percentage}% – ${value} of ${total} emails`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
          </div>
        )}

        {/* Campaign Stats Table */}
        {hasCampaignData && (
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
                  {campaignStats.campaigns.slice(0, 10).map((campaign: any, index: number) => (
                    <motion.tr
                      key={campaign.campaignId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + index * 0.05 }}
                      className="border-b border-border/30 hover:bg-muted/30 transition-smooth"
                    >
                      <td className="py-3 px-2 font-medium">{campaign.campaignName || 'Unknown Campaign'}</td>
                      <td className="py-3 px-2 text-center">{campaign.emailsSent || 0}</td>
                      <td className="py-3 px-2 text-center">{campaign.emailsOpened || 0}</td>
                      <td className="py-3 px-2 text-center">{campaign.emailsReplied || 0}</td>
                      <td className="py-3 px-2 text-center">{campaign.emailsBounced || 0}</td>
                      <td className="py-3 px-2 text-center">{campaign.openRate?.toFixed(1) || '0.0'}%</td>
                      <td className="py-3 px-2 text-center">{campaign.replyRate?.toFixed(1) || '0.0'}%</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
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
