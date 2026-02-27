import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldAlert, ShieldCheck, TrendingUp, TrendingDown } from "lucide-react";

interface Vendor {
  name: string;
  gstin: string;
  complianceScore: number;
  filingRegularity: number;
  mismatchRate: number;
  totalTransactions: number;
  itcAtRisk: string;
  trend: "improving" | "declining" | "stable";
  riskCategory: "High" | "Medium" | "Low";
}

const vendors: Vendor[] = [
  { name: "Rajesh Traders", gstin: "27AABCT1332L1ZZ", complianceScore: 32, filingRegularity: 45, mismatchRate: 28, totalTransactions: 234, itcAtRisk: "₹4.2L", trend: "declining", riskCategory: "High" },
  { name: "Sharma & Sons", gstin: "09AABCS1234N1ZP", complianceScore: 41, filingRegularity: 55, mismatchRate: 22, totalTransactions: 189, itcAtRisk: "₹12.3L", trend: "declining", riskCategory: "High" },
  { name: "Das Trading Co", gstin: "19AABCD9876K1Z1", complianceScore: 38, filingRegularity: 40, mismatchRate: 35, totalTransactions: 156, itcAtRisk: "₹8.5L", trend: "declining", riskCategory: "High" },
  { name: "Patel Industries", gstin: "24AABCP5765F1Z5", complianceScore: 62, filingRegularity: 70, mismatchRate: 12, totalTransactions: 412, itcAtRisk: "₹8.7L", trend: "stable", riskCategory: "Medium" },
  { name: "Reddy Supplies", gstin: "07AABCR3456T1Z6", complianceScore: 58, filingRegularity: 65, mismatchRate: 15, totalTransactions: 298, itcAtRisk: "₹3.2L", trend: "improving", riskCategory: "Medium" },
  { name: "Mehta Corp", gstin: "06AABCM7890R1Z3", complianceScore: 55, filingRegularity: 60, mismatchRate: 18, totalTransactions: 345, itcAtRisk: "₹5.1L", trend: "stable", riskCategory: "Medium" },
  { name: "Kumar Exports", gstin: "33AABCK2546M1ZB", complianceScore: 78, filingRegularity: 85, mismatchRate: 5, totalTransactions: 567, itcAtRisk: "₹2.1L", trend: "improving", riskCategory: "Low" },
  { name: "Gupta Enterprises", gstin: "29AABCG4567H1Z8", complianceScore: 88, filingRegularity: 92, mismatchRate: 3, totalTransactions: 890, itcAtRisk: "₹0.8L", trend: "improving", riskCategory: "Low" },
];

const getScoreColor = (score: number) => {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-accent";
  return "text-destructive";
};

const VendorRisk = () => {
  const highRisk = vendors.filter((v) => v.riskCategory === "High").length;
  const medRisk = vendors.filter((v) => v.riskCategory === "Medium").length;
  const lowRisk = vendors.filter((v) => v.riskCategory === "Low").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vendor Risk Assessment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Predictive compliance scoring using historical graph patterns
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 shadow-card border-border border-l-4 border-l-destructive">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-foreground">{highRisk}</p>
              <p className="text-xs text-muted-foreground">High Risk Vendors</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-card border-border border-l-4 border-l-accent">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-accent" />
            <div>
              <p className="text-2xl font-bold text-foreground">{medRisk}</p>
              <p className="text-xs text-muted-foreground">Medium Risk Vendors</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-card border-border border-l-4 border-l-success">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold text-foreground">{lowRisk}</p>
              <p className="text-xs text-muted-foreground">Low Risk Vendors</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Vendor Table */}
      <Card className="shadow-card border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Vendor</TableHead>
              <TableHead className="font-semibold">Compliance Score</TableHead>
              <TableHead className="font-semibold">Filing Regularity</TableHead>
              <TableHead className="font-semibold">Mismatch Rate</TableHead>
              <TableHead className="font-semibold">ITC at Risk</TableHead>
              <TableHead className="font-semibold">Trend</TableHead>
              <TableHead className="font-semibold">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v, i) => (
              <TableRow
                key={v.gstin}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <TableCell>
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{v.gstin}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={v.complianceScore} className="w-16 h-1.5" />
                    <span className={`text-sm font-bold ${getScoreColor(v.complianceScore)}`}>
                      {v.complianceScore}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={v.filingRegularity} className="w-16 h-1.5" />
                    <span className="text-sm text-muted-foreground">{v.filingRegularity}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-sm font-medium ${v.mismatchRate > 20 ? "text-destructive" : v.mismatchRate > 10 ? "text-accent" : "text-success"}`}>
                    {v.mismatchRate}%
                  </span>
                </TableCell>
                <TableCell className="font-semibold text-sm">{v.itcAtRisk}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {v.trend === "improving" ? (
                      <TrendingDown className="h-3 w-3 text-success" />
                    ) : v.trend === "declining" ? (
                      <TrendingUp className="h-3 w-3 text-destructive" />
                    ) : (
                      <span className="h-3 w-3 text-muted-foreground">—</span>
                    )}
                    <span className="text-xs text-muted-foreground capitalize">{v.trend}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={v.riskCategory === "High" ? "destructive" : v.riskCategory === "Medium" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {v.riskCategory}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default VendorRisk;
