import React, { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import axios, { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RefreshCw, Upload, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface GSTNode {
  id: string;
  label: string;
  val?: number;
  color?: string;
}

interface GSTLink {
  source: string;
  target: string;
  label: string;
  color: string;
}

interface GraphData {
  nodes: GSTNode[];
  links: GSTLink[];
}

// ── Read backend URL from Vite env — falls back to localhost for dev ───────────
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Component ─────────────────────────────────────────────────────────────────
const GraphView: React.FC = () => {
  const fgRef = useRef<ForceGraphMethods>();
  const [data, setData]           = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading]     = useState<boolean>(true);
  const [error, setError]         = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(true);
  const { toast } = useToast();

  // ── Fetch Graph ─────────────────────────────────────────────────────────────
  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<GraphData>(`${API_BASE}/api/v1/graph`);
      setData(response.data);
      setConnected(true);
    } catch (err) {
      const axiosErr = err as AxiosError;
      setConnected(false);
      if (axiosErr.code === 'ERR_NETWORK') {
        setError('Cannot reach the backend server. Make sure it is running on port 8000.');
      } else if (axiosErr.response?.status === 503) {
        setError('Database is unavailable. Check your Neo4j connection.');
      } else {
        setError('Failed to load graph data. Please try refreshing.');
      }
      console.error('Graph fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // ── CSV Upload ───────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Invalid file', description: 'Please upload a CSV file.', variant: 'destructive' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await axios.post(`${API_BASE}/api/v1/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast({
        title: 'Upload successful',
        description: `${res.data.rows} rows imported. Refreshing graph...`,
      });
      // Re-fetch graph after upload so new data shows immediately
      await fetchGraph();
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail: string }>;
      toast({
        title: 'Upload failed',
        description: axiosErr.response?.data?.detail ?? 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      e.target.value = ''; // reset input so same file can be re-uploaded
    }
  }, [fetchGraph, toast]);

  // ── Custom Node Paint ────────────────────────────────────────────────────────
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label    = node.label as string;
    const fontSize = 14 / globalScale;
    ctx.font       = `${fontSize}px 'JetBrains Mono', monospace`;

    const textWidth      = ctx.measureText(label).width;
    const pad            = fontSize * 0.4;
    const bckgDimensions = [textWidth + pad, fontSize + pad] as [number, number];

    // Background pill
    ctx.fillStyle    = 'rgba(10, 25, 47, 0.85)';
    ctx.strokeStyle  = node.color ?? '#3182ce';
    ctx.lineWidth    = 1.5 / globalScale;
    const rx = 4 / globalScale;
    const x  = node.x - bckgDimensions[0] / 2;
    const y  = node.y - bckgDimensions[1] / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, bckgDimensions[0], bckgDimensions[1], rx);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#e2e8f0';
    ctx.fillText(label, node.x, node.y);

    node.__bckgDimensions = bckgDimensions;
  }, []);

  const paintNodePointer = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    const dims    = node.__bckgDimensions as [number, number] | undefined;
    if (dims) {
      ctx.fillRect(node.x - dims[0] / 2, node.y - dims[1] / 2, dims[0], dims[1]);
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-screen bg-[#0a192f] overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between gap-3 flex-wrap">

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant={connected ? 'secondary' : 'destructive'}
            className="flex items-center gap-1.5 px-3 py-1 text-xs"
          >
            {connected
              ? <><Wifi className="h-3 w-3" /> Live</>
              : <><WifiOff className="h-3 w-3" /> Offline</>
            }
          </Badge>
          {data.nodes.length > 0 && (
            <Badge variant="outline" className="text-xs text-slate-300 border-slate-600">
              {data.nodes.length} nodes · {data.links.length} links
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Upload CSV */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 pointer-events-none"
              disabled={uploading}
              asChild={false}
            >
              <span className="flex items-center gap-1.5">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload CSV'}
              </span>
            </Button>
          </label>

          {/* Refresh */}
          <Button
            size="sm"
            onClick={fetchGraph}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-10">
        <Card className="bg-slate-900/90 border-slate-700 p-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-xs text-slate-300">Matched Invoice</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-slate-300">Mismatch Detected</span>
          </div>
        </Card>
      </div>

      {/* ── Loading overlay ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#0a192f]/80">
          <div className="text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mx-auto" />
            <p className="text-slate-300 text-sm">Synchronizing Knowledge Graph...</p>
          </div>
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Card className="bg-slate-900 border-red-800 p-6 max-w-md text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
            <p className="text-slate-200 text-sm">{error}</p>
            <Button onClick={fetchGraph} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" /> Try Again
            </Button>
          </Card>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!loading && !error && data.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Card className="bg-slate-900 border-slate-700 p-6 max-w-sm text-center space-y-3">
            <Upload className="h-10 w-10 text-slate-400 mx-auto" />
            <p className="text-slate-200 font-medium">No graph data yet</p>
            <p className="text-slate-400 text-sm">Upload a GSTR CSV file to populate the knowledge graph.</p>
          </Card>
        </div>
      )}

      {/* ── Graph ────────────────────────────────────────────────────────────── */}
      {!error && (
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          backgroundColor="#0a192f"
          nodeLabel="id"
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintNodePointer}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.25}
          linkColor={(link: any) => link.color ?? '#cbd5e0'}
          linkLabel="label"
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={(d: any) =>
            d.color === 'red' ? 0.01 : 0.003
          }
        />
      )}
    </div>
  );
};

export default GraphView;