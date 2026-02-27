import { useState, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Filter, Download, Eye, Upload, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axios, { AxiosError } from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface MismatchRecord {
  id: string;
  invoiceNo: string;
  supplierGstin: string;
  supplierName: string;
  buyerGstin: string;
  gstr1Amount: number;
  gstr2bAmount: number;
  difference: number;
  mismatchType: string;
  riskLevel: "High" | "Medium" | "Low";
  status: "Unresolved" | "Under Review" | "Resolved";
  period: string;
}

const DetailField = ({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
    <p className={`text-sm font-medium ${mono ? "font-mono" : ""} ${highlight ? "text-destructive font-bold" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

const Reconciliation = () => {
  const [records, setRecords]               = useState<MismatchRecord[]>([]);
  const [loading, setLoading]               = useState(true);
  const [uploading, setUploading]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [search, setSearch]                 = useState("");
  const [riskFilter, setRiskFilter]         = useState("all");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<MismatchRecord | null>(null);
  const { toast } = useToast();

  // ── Fetch live data from backend ───────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE}/api/v1/reconciliation`);
      setRecords(res.data.records ?? []);
    } catch (err) {
      const e = err as AxiosError;
      if (e.code === "ERR_NETWORK") setError("Cannot reach the backend server.");
      else setError("Failed to load reconciliation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── CSV Upload ─────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Only CSV files are accepted.", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploading(true);
      const res = await axios.post(`${API_BASE}/api/v1/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast({
        title: "Upload successful ✓",
        description: `${res.data.rows} rows imported. AI reconciliation running in background...`,
      });
      // Refresh table after background pipeline completes (~5s)
      setTimeout(fetchRecords, 5000);
    } catch (err) {
      const e = err as AxiosError<{ detail: string }>;
      toast({
        title: "Upload failed",
        description: e.response?.data?.detail ?? "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [toast, fetchRecords]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const headers = ["Invoice No","Supplier GSTIN","Buyer GSTIN","GSTR-1","GSTR-2B","Difference","Type","Risk","Status","Period"];
    const rows = filtered.map(r => [
      r.invoiceNo, r.supplierGstin, r.buyerGstin,
      r.gstr1Amount, r.gstr2bAmount, r.difference,
      r.mismatchType, r.riskLevel, r.status, r.period,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "gst_reconciliation.csv",
    }).click();
  }, []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (
      ((r.invoiceNo    ?? "").toLowerCase().includes(q) ||
       (r.supplierGstin ?? "").toLowerCase().includes(q) ||
       (r.buyerGstin    ?? "").toLowerCase().includes(q)) &&
      (riskFilter   === "all" || (r.riskLevel ?? "") === riskFilter) &&
      (statusFilter === "all" || (r.status    ?? "") === statusFilter)
    );
  });

  const fmt = (n: number) => n === 0 ? "—" : `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reconciliation Engine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live GSTR-1 vs GSTR-2B mismatch data from Neo4j knowledge graph
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchRecords} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <label className="cursor-pointer">
            <input
              type="file" accept=".csv" className="hidden"
              onChange={handleUpload} disabled={uploading}
            />
            <Button
              variant="default" size="sm"
              disabled={uploading}
              className="pointer-events-none bg-accent text-accent-foreground hover:bg-accent/90"
              asChild={false}
            >
              <span className="flex items-center gap-1.5">
                {uploading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>
                  : <><Upload  className="h-4 w-4" />Upload GSTR CSV</>}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-card border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoice, supplier, GSTIN..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risks</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Unresolved">Unresolved</SelectItem>
              <SelectItem value="Under Review">Under Review</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" />
            <p className="text-sm text-muted-foreground">Loading reconciliation data...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="p-6 border-destructive/50 text-center space-y-3">
          <WifiOff className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchRecords}>Try Again</Button>
        </Card>
      )}

      {/* Summary row */}
      {!loading && !error && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filtered.length}</strong> of {records.length} records
          </span>
          <span>·</span>
          <span className="text-destructive font-medium">
            {filtered.filter(r => r.riskLevel === "High").length} High Risk
          </span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <Card className="shadow-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Invoice No</TableHead>
                <TableHead className="font-semibold">Supplier / Buyer GSTIN</TableHead>
                <TableHead className="font-semibold text-right">GSTR-1</TableHead>
                <TableHead className="font-semibold text-right">GSTR-2B</TableHead>
                <TableHead className="font-semibold text-right">Diff</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Risk</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    {records.length === 0
                      ? "No mismatches found. Upload a GSTR CSV to begin."
                      : "No records match your current filters."}
                  </TableCell>
                </TableRow>
              ) : filtered.map((r, i) => (
                <TableRow
                  key={r.id}
                  className="animate-fade-in cursor-pointer hover:bg-muted/30"
                  style={{ animationDelay: `${i * 40}ms` }}
                  onClick={() => setSelectedRecord(r)}
                >
                  <TableCell className="font-mono text-xs">{r.invoiceNo}</TableCell>
                  <TableCell>
                    <p className="text-xs font-mono">{r.supplierGstin}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">→ {r.buyerGstin}</p>
                  </TableCell>
                  <TableCell className="text-right text-sm">{fmt(r.gstr1Amount)}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(r.gstr2bAmount)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-destructive">
                    {r.difference > 0 ? fmt(r.difference) : "—"}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.mismatchType}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={r.riskLevel === "High" ? "destructive" : "secondary"} className="text-[10px]">
                      {r.riskLevel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${
                      r.status === "Resolved" ? "text-success"
                      : r.status === "Unresolved" ? "text-destructive"
                      : "text-accent"
                    }`}>{r.status}</span>
                  </TableCell>
                  <TableCell><Eye className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Invoice Detail
              {selectedRecord && (
                <Badge variant={selectedRecord.riskLevel === "High" ? "destructive" : "secondary"}>
                  {selectedRecord.riskLevel} Risk
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Invoice No"     value={selectedRecord.invoiceNo}           mono />
                <DetailField label="Period"         value={selectedRecord.period || "N/A"} />
                <DetailField label="Supplier GSTIN" value={selectedRecord.supplierGstin}       mono />
                <DetailField label="Buyer GSTIN"    value={selectedRecord.buyerGstin || "N/A"} mono />
                <DetailField label="GSTR-1 Amount"  value={fmt(selectedRecord.gstr1Amount)} />
                <DetailField label="GSTR-2B Amount" value={fmt(selectedRecord.gstr2bAmount)} />
                <DetailField label="Mismatch Type"  value={selectedRecord.mismatchType} />
                <DetailField label="Difference"     value={fmt(selectedRecord.difference)}     highlight />
              </div>
              <Card className="p-3 bg-muted/50 border-border">
                <p className="text-xs font-semibold text-foreground mb-1">Graph Traversal Audit</p>
                <p className="text-xs text-muted-foreground">
                  Detected via: Invoice Node → GSTR-1 Filing → Supplier GSTIN → GSTR-2B Cross-Ref → Buyer GSTIN.
                  Root cause: {selectedRecord.mismatchType} discrepancy in supplier's return.
                </p>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reconciliation;