import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import { Mail, Eye, MessageSquare, TrendingUp, RefreshCw, Calendar } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api, RAW_BASE } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import io from "socket.io-client";

interface DashboardStats {
  totalEmailsSent: number;
  openRate: { percentage: number; count: number };
  replyRate: { percentage: number; count: number };
  bounceRate: { percentage: number; count: number };
  dailyActivity: number[];
  weeklyPerformance: number[];
  additionalMetrics: {
    totalSequences: number;
    totalContacts: number;
    activeEnrollments: number;
    totalDelivered: number;
    totalClicked: number;
    totalUnsubscribed: number;
    totalFailed: number;
  };
  eventBreakdown: Record<string, number>;
  dateRange: {
    startDate: string;
    endDate: string;
    sequenceId: string;
  };
}

const Dashboard = () => {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("all");
  const [socket, setSocket] = useState<any>(null);

  const getTimeRangeParams = (range: string) => {
    const now = new Date();
    const startDate = new Date();
    
    switch (range) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        return { startDate: startDate.toISOString() };
      case "week":
        startDate.setDate(now.getDate() - 7);
        return { startDate: startDate.toISOString() };
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        return { startDate: startDate.toISOString() };
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        return { startDate: startDate.toISOString() };
      case "all":
      default:
        return {};
    }
  };

  const fetchDashboardData = async (isRefreshing = false, range = timeRange) => {
    try {
      if (!isRefreshing) setLoading(true);
      setError(null);

      console.log(`🔄 Fetching dashboard statistics for range: ${range}...`);
      const params = getTimeRangeParams(range);
      const stats = await api.getDashboardStats(params);
      setDashboardStats(stats);
    } catch (err) {
      console.error('❌ Error fetching dashboard data:', err);
      let errorMessage = 'Failed to load dashboard data';
      if (err instanceof Error) {
        errorMessage = err.message.includes('fetch') 
          ? 'Cannot connect to backend server.' 
          : err.message;
      }
      setError(errorMessage);
    } finally {
      if (!isRefreshing) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(false, timeRange);
  }, [timeRange]);

  // Fetch dashboard data on component mount
  useEffect(() => {
    // fetchDashboardData is now called via the timeRange useEffect above
    
    // Set up socket connection for real-time updates
    // Set up socket connection for real-time updates
    const socketConnection = io(RAW_BASE);
    setSocket(socketConnection);

    // When ANY real-time event happens (SENT, OPENED, REPLIED), refresh the dashboard stats
    socketConnection.on('realTimeEvent', (data) => {
      console.log('📡 Dashboard received real-time event, refreshing stats...', data.type);
      fetchDashboardData(true); // Silent refresh
    });

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  // Transform daily activity data for chart (Sunday=0 to Saturday=6)
  const dailyData = dashboardStats ? [
    { day: "Sun", emails: dashboardStats.dailyActivity[0] || 0 },
    { day: "Mon", emails: dashboardStats.dailyActivity[1] || 0 },
    { day: "Tue", emails: dashboardStats.dailyActivity[2] || 0 },
    { day: "Wed", emails: dashboardStats.dailyActivity[3] || 0 },
    { day: "Thu", emails: dashboardStats.dailyActivity[4] || 0 },
    { day: "Fri", emails: dashboardStats.dailyActivity[5] || 0 },
    { day: "Sat", emails: dashboardStats.dailyActivity[6] || 0 },
  ] : [];

  // Transform weekly performance data for chart
  const weeklyData = dashboardStats ? dashboardStats.weeklyPerformance.map((total, index) => {
    // Calculate proportional distribution based on overall stats
    const sentRatio = dashboardStats.totalEmailsSent > 0 ? 1 : 0;
    const openRatio = dashboardStats.totalEmailsSent > 0 ? dashboardStats.openRate.percentage / 100 : 0;
    const replyRatio = dashboardStats.totalEmailsSent > 0 ? dashboardStats.replyRate.percentage / 100 : 0;

    return {
      week: `Week ${index + 1}`,
      sent: Math.floor(total * sentRatio),
      opened: Math.floor(total * openRatio),
      replied: Math.floor(total * replyRatio),
    };
  }) : [];

  // Refresh dashboard data
  const refreshDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Refreshing dashboard statistics...');
      const stats = await api.getDashboardStats();
      console.log('✅ Dashboard statistics refreshed:', stats);

      setDashboardStats(stats);
    } catch (err) {
      console.error('❌ Error refreshing dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading dashboard statistics...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-500 text-xl mb-4">⚠️</div>
              <p className="text-muted-foreground mb-4">Failed to load dashboard data</p>
              <p className="text-sm text-red-500">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show dashboard with real data
  if (!dashboardStats) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />

      <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-6"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">Track your email campaigns and performance</p>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
              Data range: {dashboardStats.dateRange.startDate === 'All time' ? 'Start' : new Date(dashboardStats.dateRange.startDate).toLocaleDateString()} to {dashboardStats.dateRange.endDate === 'All time' ? 'Today' : new Date(dashboardStats.dateRange.endDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background border-border/40 shadow-sm rounded-xl">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">1 Week</SelectItem>
                <SelectItem value="month">1 Month</SelectItem>
                <SelectItem value="year">1 Year</SelectItem>
                <SelectItem value="all">Overall</SelectItem>
              </SelectContent>
            </Select>

            <motion.button
              onClick={() => fetchDashboardData(true)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-luxury shadow-primary/20 w-full sm:w-auto"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </motion.button>
          </div>
        </motion.div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Emails Sent"
            value={dashboardStats.totalEmailsSent.toLocaleString()}
            icon={Mail}
            trend={`${dashboardStats.additionalMetrics.totalSequences} active sequences`}
            delay={0.1}
          />
          <MetricCard
            title="Open Rate"
            value={`${dashboardStats.openRate.percentage.toFixed(1)}%`}
            icon={Eye}
            percentage={`${dashboardStats.openRate.percentage.toFixed(1)}%`}
            total={`${dashboardStats.openRate.count.toLocaleString()} of ${dashboardStats.totalEmailsSent.toLocaleString()} opened`}
            trend={`${dashboardStats.additionalMetrics.totalContacts} total contacts`}
            delay={0.2}
          />
          <MetricCard
            title="Reply Rate"
            value={`${dashboardStats.replyRate.percentage.toFixed(1)}%`}
            icon={MessageSquare}
            percentage={`${dashboardStats.replyRate.percentage.toFixed(1)}%`}
            total={`${dashboardStats.replyRate.count.toLocaleString()} of ${dashboardStats.totalEmailsSent.toLocaleString()} replied`}
            trend={`${dashboardStats.additionalMetrics.activeEnrollments} active enrollments`}
            delay={0.3}
          />
          <MetricCard
            title="Bounce Rate"
            value={`${dashboardStats.bounceRate.percentage.toFixed(1)}%`}
            icon={TrendingUp}
            percentage={`${dashboardStats.bounceRate.percentage.toFixed(1)}%`}
            total={`${dashboardStats.bounceRate.count.toLocaleString()} of ${dashboardStats.totalEmailsSent.toLocaleString()} bounced`}
            trend={`${dashboardStats.additionalMetrics.totalDelivered} delivered`}
            delay={0.4}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="glass rounded-2xl p-6 shadow-card hover-lift"
          >
            <h3 className="text-lg font-semibold mb-4 text-foreground">Daily Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="day"
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px', fontWeight: 500 }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px', fontWeight: 500 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    padding: "12px",
                    boxShadow: "var(--shadow-card)",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                  formatter={(value: number) => [`${value} emails`, 'Sent']}
                />
                <Line
                  type="monotone"
                  dataKey="emails"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", r: 5, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7, strokeWidth: 2 }}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Weekly Performance Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="glass rounded-2xl p-6 shadow-card hover-lift"
          >
            <h3 className="text-lg font-semibold mb-4 text-foreground">Weekly Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="week"
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px', fontWeight: 500 }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px', fontWeight: 500 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    padding: "12px",
                    boxShadow: "var(--shadow-card)",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                  formatter={(value: number, name: string) => {
                    const labels = { sent: 'Sent', opened: 'Opened', replied: 'Replied' };
                    return [value, labels[name as keyof typeof labels] || name];
                  }}
                />
                <Bar dataKey="sent" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} animationDuration={1000} />
                <Bar dataKey="opened" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} animationDuration={1000} animationBegin={200} />
                <Bar dataKey="replied" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} animationDuration={1000} animationBegin={400} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
