import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  FileWarning,
  Users,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const stats = [
  {
    label: "Total Invoices Processed",
    value: "1,24,567",
    change: "+12.4%",
    trend: "up" as const,
    icon: FileWarning,
  },
  {
    label: "ITC Mismatches Found",
    value: "3,428",
    change: "-8.2%",
    trend: "down" as const,
    icon: AlertTriangle,
  },
  {
    label: "Revenue at Risk",
    value: "₹18.4 Cr",
    change: "+5.1%",
    trend: "up" as const,
    icon: IndianRupee,
  },
  {
    label: "Vendors Flagged",
    value: "142",
    change: "+23",
    trend: "up" as const,
    icon: Users,
  },
];

const mismatchByType = [
  { name: "Amount", value: 1245, fill: "hsl(38, 92%, 50%)" },
  { name: "GSTIN", value: 834, fill: "hsl(199, 89%, 48%)" },
  { name: "Invoice No", value: 567, fill: "hsl(142, 71%, 45%)" },
  { name: "Tax Rate", value: 412, fill: "hsl(0, 84%, 60%)" },
  { name: "HSN Code", value: 370, fill: "hsl(262, 83%, 58%)" },
];

const monthlyTrend = [
  { month: "Aug", matched: 18200, mismatched: 2400 },
  { month: "Sep", matched: 19800, mismatched: 2100 },
  { month: "Oct", matched: 21400, mismatched: 3200 },
  { month: "Nov", matched: 20100, mismatched: 2800 },
  { month: "Dec", matched: 22600, mismatched: 2300 },
  { month: "Jan", matched: 24100, mismatched: 3400 },
];

const riskTrend = [
  { month: "Aug", score: 72 },
  { month: "Sep", score: 68 },
  { month: "Oct", score: 75 },
  { month: "Nov", score: 71 },
  { month: "Dec", score: 64 },
  { month: "Jan", score: 58 },
];

const recentAlerts = [
  { vendor: "Rajesh Traders", gstin: "27AABCT1332L1ZZ", type: "High Risk", amount: "₹4.2L" },
  { vendor: "Patel Industries", gstin: "24AABCP5765F1Z5", type: "Mismatch", amount: "₹8.7L" },
  { vendor: "Kumar Exports", gstin: "33AABCK2546M1ZB", type: "Missing", amount: "₹2.1L" },
  { vendor: "Sharma & Sons", gstin: "09AABCS1234N1ZP", type: "High Risk", amount: "₹12.3L" },
];

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          GST Reconciliation Overview — FY 2024-25
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4 shadow-card border-border">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <stat.icon className="h-5 w-5 text-accent" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {stat.trend === "up" ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-success" />
              )}
              <span className="text-xs font-medium text-success">{stat.change}</span>
              <span className="text-xs text-muted-foreground ml-1">vs last month</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Trend */}
        <Card className="col-span-2 p-5 shadow-card border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Monthly Reconciliation Trend
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyTrend} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(214, 32%, 91%)",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="matched" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="Matched" />
              <Bar dataKey="mismatched" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} name="Mismatched" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Mismatch Types */}
        <Card className="p-5 shadow-card border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Mismatch Categories
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={mismatchByType}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                stroke="none"
              >
                {mismatchByType.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {mismatchByType.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="text-[10px] text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk Trend */}
        <Card className="p-5 shadow-card border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Overall Risk Score Trend
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={riskTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
              <YAxis domain={[40, 100]} tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(38, 92%, 50%)"
                strokeWidth={2}
                dot={{ fill: "hsl(38, 92%, 50%)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Recent Alerts */}
        <Card className="col-span-2 p-5 shadow-card border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Alerts</h3>
            <Activity className="h-4 w-4 text-accent animate-pulse-glow" />
          </div>
          <div className="space-y-3">
            {recentAlerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      alert.type === "High Risk"
                        ? "bg-destructive/10"
                        : alert.type === "Mismatch"
                        ? "bg-warning/10"
                        : "bg-info/10"
                    }`}
                  >
                    {alert.type === "High Risk" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{alert.vendor}</p>
                    <p className="text-xs font-mono text-muted-foreground">{alert.gstin}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={alert.type === "High Risk" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {alert.type}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{alert.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
