import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import { TrendingUp, Users, Mail, Target } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const Reports = () => {
  const statusData = [
    { name: "Sent", value: 350, color: "hsl(var(--primary))" },
    { name: "Opened", value: 240, color: "hsl(var(--secondary))" },
    { name: "Replied", value: 80, color: "hsl(var(--accent))" },
  ];

  const performanceData = [
    { name: "Converted", value: 55, color: "hsl(var(--accent))" },
    { name: "In Progress", value: 185, color: "hsl(var(--secondary))" },
    { name: "No Response", value: 110, color: "hsl(220 20% 70%)" },
  ];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Campaigns"
            value="24"
            icon={Mail}
            trend="Active this month"
            delay={0.1}
          />
          <MetricCard
            title="Total Leads"
            value="1,280"
            icon={Users}
            trend="+156 this week"
            delay={0.2}
          />
          <MetricCard
            title="Avg. Response Rate"
            value="22.8%"
            icon={TrendingUp}
            percentage="22.8%"
            total="292 of 1,280 responded"
            trend="+3.2% from average"
            delay={0.3}
          />
          <MetricCard
            title="Goal Achievement"
            value="87%"
            icon={Target}
            percentage="87%"
            total="21 of 24 goals met"
            trend="On track for monthly"
            delay={0.4}
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
          <h3 className="text-xl font-semibold mb-6 text-foreground">Monthly Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              className="text-center p-6 rounded-xl bg-primary/5 transition-smooth hover:bg-primary/10"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-3xl font-bold text-primary mb-2">1,150</p>
              <p className="text-sm text-muted-foreground font-medium">Total Emails Sent</p>
              <p className="text-xs text-muted-foreground mt-1">100% of target</p>
            </motion.div>
            <motion.div 
              className="text-center p-6 rounded-xl bg-secondary/5 transition-smooth hover:bg-secondary/10"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-3xl font-bold text-secondary mb-2">788</p>
              <p className="text-sm text-muted-foreground font-medium">Emails Opened</p>
              <p className="text-xs text-muted-foreground mt-1">68.5% of sent</p>
            </motion.div>
            <motion.div 
              className="text-center p-6 rounded-xl bg-accent/5 transition-smooth hover:bg-accent/10"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-3xl font-bold text-accent mb-2">262</p>
              <p className="text-sm text-muted-foreground font-medium">Replies Received</p>
              <p className="text-xs text-muted-foreground mt-1">22.8% of sent</p>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Reports;
