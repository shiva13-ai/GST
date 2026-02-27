import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GitBranch, ArrowRight, AlertTriangle, CheckCircle2,
  Clock, FileText, RefreshCw, Loader2, WifiOff, Play,
} from "lucide-react";
import axios, { AxiosError } from "axios";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface AuditEntry {
  id: string;
  inv_no: string;
  supplier_gstin: string;
  buyer_gstin: string;
  mismatch_type: string;
  severity: "high" | "medium" | "low";
  status: "flagged" | "reviewed" | "cleared";
  amount: number;
  period: string;
  description: string;
  root_cause: string;
  traversal_path: string[];
}

const SEV = {
  high:   { color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
  medium: { color: "text-accent",      bg: "bg-accent/10",      icon: Clock },
  low:    { color: "text-info",        bg: "bg-info/10",        icon: FileText },
};

const AuditTrail = () => {
  const [entries, setEntries]           = useState<AuditEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [reconciling, setReconciling]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [severityFilter, setSeverity]   = useState("all");
  const [statusFilter, setStatus]       = useState("all");
  const { toast } = useToast();

  const fetchAuditTrail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (severityFilter !== "all") params.severity = severityFilter;
      if (statusFilter   !== "all") params.status   = statusFilter;
      const res = await axios.get(`${API_BASE}/api/v1/audit-trail`, { params });
      setEntries(res.data.entries ?? []);
    } catch (err) {
      const e = err as AxiosError;
      setError(e.code === "ERR_NETWORK"
        ? "Cannot reach the backend. Make sure it is running on port 8000."
        : "Failed to load audit trail.");
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => { fetchAuditTrail(); }, [fetchAuditTrail]);

  const triggerReconciliation = async () => {
    try {
      setReconciling(true);
      await axios.post(`${API_BASE}/api/v1/reconcile`);
      toast({
        title: "AI Reconciliation started ✓",
        description: "Analysing your graph — refreshing in 5 seconds...",
      });
      setTimeout(() => { fetchAuditTrail(); setReconciling(false); }, 5000);
    } catch {
      toast({ title: "Failed to start reconciliation", variant: "destructive" });
      setReconciling(false);
    }
  };

  const updateStatus = async (inv_no: string, newStatus: string) => {
    try {
      await axios.patch(`${API_BASE}/api/v1/audit-trail/${encodeURIComponent(inv_no)}/status?new_status=${newStatus}`);
      setEntries(prev => prev.map(e => e.inv_no === inv_no ? { ...e, status: newStatus as AuditEntry["status"] } : e));
      toast({ title: `Status updated to "${newStatus}"` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated natural-language audit logs with graph traversal paths
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAuditTrail} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm" onClick={triggerReconciliation} disabled={reconciling}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {reconciling
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Running...</>
              : <><Play    className="h-4 w-4 mr-1.5" />Run AI Reconciliation</>}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={severityFilter} onValueChange={setSeverity}>
          <SelectTrigger className="w-[145px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-[145px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
          </SelectContent>
        </Select>
        {entries.length > 0 && (
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">{entries.length}</strong> entries ·{" "}
            <span className="text-destructive font-medium">
              {entries.filter(e => e.severity === "high").length} high severity
            </span>
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" />
            <p className="text-sm text-muted-foreground">Loading audit entries...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="p-6 border-destructive/50 text-center space-y-3">
          <WifiOff className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAuditTrail}>Try Again</Button>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <Card className="p-10 text-center space-y-3 border-dashed">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">No audit entries yet</p>
          <p className="text-xs text-muted-foreground">
            Upload a GSTR CSV on the Reconciliation page, then click{" "}
            <strong>Run AI Reconciliation</strong> to generate audit logs.
          </p>
          <Button size="sm" onClick={triggerReconciliation} disabled={reconciling}
            className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Play className="h-4 w-4 mr-1.5" /> Run AI Reconciliation
          </Button>
        </Card>
      )}

      {/* Timeline */}
      {!loading && !error && entries.length > 0 && (
        <div className="space-y-4">
          {entries.map((entry, i) => {
            const cfg  = SEV[entry.severity] ?? SEV.medium;
            const Icon = cfg.icon;
            return (
              <Card key={entry.id} className="p-5 shadow-card border-border animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}>

                {/* Card header */}
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">{entry.mismatch_type}</span>
                        <Badge variant={entry.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">
                          {entry.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{entry.status}</Badge>
                        {entry.amount > 0 && (
                          <span className="text-xs font-semibold text-destructive">
                            ₹{entry.amount.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {entry.id} · {entry.inv_no}{entry.period ? ` · ${entry.period}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Status dropdown */}
                  <Select value={entry.status} onValueChange={v => updateStatus(entry.inv_no, v)}>
                    <SelectTrigger className="w-[120px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flagged">Flagged</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="cleared">Cleared</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="my-3" />

                {/* Description */}
                <p className="text-sm text-foreground leading-relaxed mb-4">{entry.description}</p>

                {/* Graph traversal path */}
                <div className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <GitBranch className="h-3.5 w-3.5 text-accent" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      Graph Traversal Path
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {entry.traversal_path.map((step, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <span className="text-xs px-2 py-1 rounded-md bg-muted font-mono text-foreground">
                          {step}
                        </span>
                        {j < entry.traversal_path.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Root cause */}
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      AI Root Cause Analysis
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{entry.root_cause}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AuditTrail;