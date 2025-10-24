import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import { TrendingUp, Users, Mail, Activity } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const Reports = () => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const data = await api.getReportsAnalytics();
      setAnalyticsData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    
    // Set up polling for real-time updates every 30 seconds
    const interval = setInterval(fetchAnalyticsData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Prepare chart data from API response
  const statusData = analyticsData ? [
    { name: "Sent", value: analyticsData.emailStatusDistribution.sent, color: "hsl(var(--primary))" },
    { name: "Opened", value: analyticsData.emailStatusDistribution.opened, color: "hsl(var(--secondary))" },
    { name: "Replied", value: analyticsData.emailStatusDistribution.replied, color: "hsl(var(--accent))" },
    { name: "Bounced", value: analyticsData.emailStatusDistribution.bounced, color: "hsl(0 70% 60%)" },
  ] : [];

  const performanceData = analyticsData ? [
    { name: "Replied", value: analyticsData.leadPerformance.replied, color: "hsl(var(--accent))" },
    { name: "In Progress", value: analyticsData.leadPerformance.inProgress, color: "hsl(var(--secondary))" },
    { name: "No Response", value: analyticsData.leadPerformance.noResponse, color: "hsl(220 20% 70%)" },
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-12">
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
        <main className="container mx-auto px-6 pt-24 pb-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-destructive mb-4">{error}</p>
              <button 
                onClick={fetchAnalyticsData}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />

      <main className="container mx-auto px-6 pt-24 pb-12">
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

        {/* Metric Cards */}
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

        {/* Charts */}
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

          {/* Lead Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-2xl p-6 shadow-card hover-lift"
          >
            <h3 className="text-lg font-semibold mb-4 text-foreground">Lead Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={performanceData}
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
                  {performanceData.map((entry, index) => (
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
                    const total = performanceData.reduce((sum, item) => sum + item.value, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return [`${percentage}% – ${value} of ${total} leads`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Summary Stats */}
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
                {analyticsData?.monthlySummary?.totalEmailsSent > 0 
                  ? `${((analyticsData?.monthlySummary?.emailsOpened / analyticsData?.monthlySummary?.totalEmailsSent) * 100).toFixed(1)}% of sent`
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
                {analyticsData?.monthlySummary?.totalEmailsSent > 0 
                  ? `${((analyticsData?.monthlySummary?.repliesReceived / analyticsData?.monthlySummary?.totalEmailsSent) * 100).toFixed(1)}% of sent`
                  : '0% of sent'
                }
              </p>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Reports;
