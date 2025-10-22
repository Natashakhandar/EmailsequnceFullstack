import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import { Mail, Eye, MessageSquare, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const Dashboard = () => {
  // Mock data for charts
  const dailyData = [
    { day: "Mon", emails: 45 },
    { day: "Tue", emails: 52 },
    { day: "Wed", emails: 48 },
    { day: "Thu", emails: 61 },
    { day: "Fri", emails: 55 },
    { day: "Sat", emails: 38 },
    { day: "Sun", emails: 42 },
  ];

  const weeklyData = [
    { week: "Week 1", sent: 240, opened: 156, replied: 42 },
    { week: "Week 2", sent: 280, opened: 198, replied: 58 },
    { week: "Week 3", sent: 320, opened: 224, replied: 67 },
    { week: "Week 4", sent: 310, opened: 217, replied: 71 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />
      
      <main className="container mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Track your email campaigns and performance</p>
        </motion.div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Emails Sent"
            value="1,150"
            icon={Mail}
            trend="+12% from last week"
            delay={0.1}
          />
          <MetricCard
            title="Open Rate"
            value="68.5%"
            icon={Eye}
            percentage="68.5%"
            total="788 of 1,150 opened"
            trend="+5.2% from last week"
            delay={0.2}
          />
          <MetricCard
            title="Reply Rate"
            value="22.8%"
            icon={MessageSquare}
            percentage="22.8%"
            total="262 of 1,150 replied"
            trend="+3.1% from last week"
            delay={0.3}
          />
          <MetricCard
            title="Bounce Rate"
            value="15.2%"
            icon={TrendingUp}
            percentage="15.2%"
            total="175 of 1,150 bounced"
            trend="+2.4% from last week"
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
