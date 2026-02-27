import os
import io
import json
import re
import logging
from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
import httpx
import networkx as nx
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError
from dotenv import load_dotenv

# ── Env ───────────────────────────────────────────────────────────────────────
load_dotenv()

NEO4J_URI       = os.getenv("NEO4J_URI",       "neo4j+s://5eeeeeeee.databases.neo4j.io")
NEO4J_USER      = os.getenv("NEO4J_USER",      "neo4j")
NEO4J_PASSWORD  = os.getenv("NEO4J_PASSWORD",  "x-59XlSxxxxxxxxxxxxxxxxxx")
GEMINI_KEY      = os.getenv("GEMINI_API_KEY", "AIzaSyDwKD2Ixxxxxxxxxxxxxxxxxx")      # optional — falls back to rule-based
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Neo4j lifecycle ───────────────────────────────────────────────────────────
driver = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global driver
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        driver.verify_connectivity()
        logger.info("✅ Connected to Neo4j at %s", NEO4J_URI)
    except (ServiceUnavailable, AuthError) as e:
        logger.error("❌ Neo4j connection failed: %s", e)
        driver = None
    yield
    if driver:
        driver.close()

app = FastAPI(title="GST Reconciliation API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_driver():
    if driver is None:
        raise HTTPException(status_code=503, detail="Database unavailable. Please try again later.")
    return driver


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — HEALTH & GRAPH VISUALIZATION
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def read_root():
    return {"status": "GST Reconciliation Backend Active", "version": "2.0.0"}


@app.get("/api/v1/graph")
async def get_graph_data():
    """Returns nodes + links for the force-graph visualization."""
    query = """
    MATCH (s:Taxpayer)-[:ISSUED]->(i:Invoice)-[:BILLED_TO]->(b:Taxpayer)
    RETURN s.gstin AS source, b.gstin AS target,
           i.inv_no AS label, i.status AS status
    """
    try:
        with get_driver().session() as session:
            result = session.run(query)
            nodes, links = set(), []
            for r in result:
                nodes.add(r["source"])
                nodes.add(r["target"])
                links.append({
                    "source": r["source"],
                    "target": r["target"],
                    "label":  r["label"],
                    "color":  "red" if r["status"] == "mismatch" else "green",
                })
        return {"nodes": [{"id": n, "label": n} for n in nodes], "links": links}
    except ServiceUnavailable:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    except Exception as e:
        logger.error("/graph error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error.")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — CSV UPLOAD & NEO4J INGESTION
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/upload")
async def upload_gst_data(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Accepts a GSTR CSV file, validates it, stores every row in Neo4j,
    then triggers the reconciliation pipeline in the background.

    Required CSV columns:
        supplier_gstin, buyer_gstin, inv_no, amount, status

    Optional CSV columns:
        hsn_code, tax_rate, period, invoice_date
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    required = {"supplier_gstin", "buyer_gstin", "inv_no", "amount", "status"}
    missing  = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing columns: {missing}")

    # Normalise
    df["supplier_gstin"] = df["supplier_gstin"].astype(str).str.strip().str.upper()
    df["buyer_gstin"]    = df["buyer_gstin"].astype(str).str.strip().str.upper()
    df["inv_no"]         = df["inv_no"].astype(str).str.strip()
    df["status"]         = df["status"].astype(str).str.strip().str.lower()

    insert_q = """
    MERGE (s:Taxpayer {gstin: $supplier_gstin})
    MERGE (b:Taxpayer {gstin: $buyer_gstin})
    MERGE (i:Invoice  {inv_no: $inv_no})
      ON CREATE SET i.amount=$amount, i.status=$status,
                    i.hsn_code=$hsn_code, i.tax_rate=$tax_rate,
                    i.period=$period, i.invoice_date=$invoice_date
      ON MATCH  SET i.amount=$amount, i.status=$status,
                    i.hsn_code=$hsn_code, i.tax_rate=$tax_rate,
                    i.period=$period, i.invoice_date=$invoice_date
    MERGE (s)-[:ISSUED]->(i)
    MERGE (i)-[:BILLED_TO]->(b)
    """
    try:
        with get_driver().session() as session:
            for _, row in df.iterrows():
                session.run(insert_q, {
                    "supplier_gstin": row["supplier_gstin"],
                    "buyer_gstin":    row["buyer_gstin"],
                    "inv_no":         row["inv_no"],
                    "amount":         float(row["amount"]),
                    "status":         row["status"],
                    "hsn_code":       str(row.get("hsn_code", "")),
                    "tax_rate":       float(row.get("tax_rate", 0) or 0),
                    "period":         str(row.get("period", "")),
                    "invoice_date":   str(row.get("invoice_date", "")),
                })
    except ServiceUnavailable:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    except Exception as e:
        logger.error("Neo4j write error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to store data.")

    # Run reconciliation + AI audit generation in the background
    background_tasks.add_task(run_reconciliation_pipeline)

    logger.info("Uploaded %d rows from %s", len(df), file.filename)
    return {
        "message": f"✅ Uploaded {file.filename} successfully.",
        "rows":    len(df),
        "columns": list(df.columns),
        "note":    "AI reconciliation running in background — check /api/v1/audit-trail in ~5s.",
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — GRAPH LOGIC ENGINE (NetworkX)
# ══════════════════════════════════════════════════════════════════════════════

def build_networkx_graph() -> nx.DiGraph:
    """Pulls all invoice data from Neo4j → builds an in-memory NetworkX DiGraph."""
    query = """
    MATCH (s:Taxpayer)-[:ISSUED]->(i:Invoice)-[:BILLED_TO]->(b:Taxpayer)
    RETURN s.gstin AS supplier, b.gstin AS buyer,
           i.inv_no AS inv_no, i.amount AS amount,
           i.status AS status, i.hsn_code AS hsn_code,
           i.tax_rate AS tax_rate, i.period AS period
    """
    G = nx.DiGraph()
    with get_driver().session() as session:
        for r in session.run(query):
            G.add_node(r["supplier"], type="Taxpayer")
            G.add_node(r["buyer"],    type="Taxpayer")
            G.add_node(r["inv_no"],   type="Invoice",
                       amount=r["amount"], status=r["status"],
                       hsn_code=r["hsn_code"], tax_rate=r["tax_rate"],
                       period=r["period"])
            G.add_edge(r["supplier"], r["inv_no"], rel="ISSUED")
            G.add_edge(r["inv_no"],   r["buyer"],  rel="BILLED_TO")
    return G


def detect_mismatches(G: nx.DiGraph) -> list[dict]:
    """
    Traverses the graph and detects 5 types of issues:
      1. Amount / status mismatch
      2. Missing invoice in GSTR-2B
      3. Invalid HSN code format
      4. Non-standard GST tax rate
      5. Circular transaction pattern (fraud indicator)
    """
    mismatches = []
    VALID_TAX_RATES = {0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 9, 12, 14, 18, 28}

    for node, data in G.nodes(data=True):
        if data.get("type") != "Invoice":
            continue

        status   = data.get("status", "")
        amount   = float(data.get("amount") or 0)
        hsn      = str(data.get("hsn_code") or "")
        tax_rate = float(data.get("tax_rate") or 0)
        period   = data.get("period", "")
        supplier = next(iter(G.predecessors(node)), "UNKNOWN")
        buyer    = next(iter(G.successors(node)),   "UNKNOWN")

        base = dict(
            inv_no=node, supplier_gstin=supplier, buyer_gstin=buyer,
            amount=amount, period=period,
        )

        # ── Check 1: Mismatch ──────────────────────────────────────────────
        if status == "mismatch":
            mismatches.append({**base,
                "mismatch_type":  "Amount Mismatch",
                "severity":       "high",
                "traversal_path": ["Invoice Node", "GSTR-1 Filing",
                                   "Supplier GSTIN", "GSTR-2B Cross-Ref", "Buyer GSTIN"],
                "raw": {"status": status, "hsn": hsn, "tax_rate": tax_rate},
            })

        # ── Check 2: Missing ───────────────────────────────────────────────
        elif status == "missing":
            mismatches.append({**base,
                "mismatch_type":  "Missing in GSTR-2B",
                "severity":       "high",
                "traversal_path": ["Invoice Node", "GSTR-1 Filing",
                                   "GSTIN Lookup", "GSTR-2B (NOT FOUND)"],
                "raw": {"status": status, "hsn": hsn, "tax_rate": tax_rate},
            })

        # ── Check 3: Bad HSN ───────────────────────────────────────────────
        if hsn and hsn not in ("", "nan") and len(hsn) not in [4, 6, 8]:
            mismatches.append({**base,
                "mismatch_type":  "Invalid HSN Code",
                "severity":       "medium",
                "traversal_path": ["Invoice Node", "Product Description",
                                   "HSN Master Lookup", "Category Validation"],
                "raw": {"status": status, "hsn": hsn, "tax_rate": tax_rate},
            })

        # ── Check 4: Bad tax rate ──────────────────────────────────────────
        if tax_rate and tax_rate not in VALID_TAX_RATES:
            mismatches.append({**base,
                "mismatch_type":  "Invalid Tax Rate",
                "severity":       "medium",
                "traversal_path": ["Invoice Node", "HSN Code Lookup",
                                   "Tax Rate Validation", "Rate Schedule Cross-Ref"],
                "raw": {"status": status, "hsn": hsn, "tax_rate": tax_rate},
            })

    # ── Check 5: Circular transactions ────────────────────────────────────
    try:
        for cycle in nx.simple_cycles(G):
            taxpayers = [n for n in cycle if G.nodes[n].get("type") == "Taxpayer"]
            if len(taxpayers) >= 2:
                mismatches.append({
                    "inv_no":         "CIRCULAR-PATTERN",
                    "supplier_gstin": taxpayers[0],
                    "buyer_gstin":    taxpayers[-1],
                    "amount":         0,
                    "period":         "N/A",
                    "mismatch_type":  "Circular Transaction Pattern",
                    "severity":       "high",
                    "traversal_path": taxpayers,
                    "raw":            {"cycle": taxpayers},
                })
    except Exception:
        pass

    return mismatches


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — LLM AUDIT GENERATION (Claude)
# ══════════════════════════════════════════════════════════════════════════════

def rule_based_audit(m: dict) -> dict:
    """Fallback: generates audit description without LLM."""
    t   = m["mismatch_type"]
    inv = m["inv_no"]
    sup = m["supplier_gstin"]
    buy = m["buyer_gstin"]
    amt = m["amount"]
    raw = m.get("raw", {})

    desc = {
        "Amount Mismatch":
            f"Invoice {inv} has an amount discrepancy between GSTR-1 filed by {sup} and GSTR-2B of {buy}. Reported amount: ₹{amt:,.0f}.",
        "Missing in GSTR-2B":
            f"Invoice {inv} reported by supplier {sup} in GSTR-1 is completely absent in buyer {buy}'s GSTR-2B auto-population.",
        "Invalid HSN Code":
            f"Invoice {inv} contains HSN code '{raw.get('hsn')}' which does not conform to the 4/6/8-digit standard format.",
        "Invalid Tax Rate":
            f"Invoice {inv} applies a tax rate of {raw.get('tax_rate')}% which is not a valid GST slab (0/5/12/18/28%).",
        "Circular Transaction Pattern":
            f"A circular transaction loop was detected involving GSTINs: {' → '.join(m['traversal_path'])}. Potential fraudulent ITC claim.",
    }.get(t, f"Mismatch of type '{t}' detected on invoice {inv}.")

    cause = {
        "Amount Mismatch":
            "Supplier likely made a manual data entry error in GSTR-1. The e-Invoice amount typically matches GSTR-2B.",
        "Missing in GSTR-2B":
            "Buyer GSTIN was likely entered incorrectly by the supplier, preventing auto-population in GSTR-2B.",
        "Invalid HSN Code":
            "Incorrect HSN mapping in supplier's ERP or accounting software. Requires correction and revised GSTR-1 filing.",
        "Invalid Tax Rate":
            "Product was miscategorised in the supplier's system. Verify the correct HSN sub-category and applicable GST slab.",
        "Circular Transaction Pattern":
            "Multiple taxpayers are issuing invoices to each other in a closed loop — a common pattern for fraudulent ITC claims.",
    }.get(t, "Manual investigation required to determine root cause.")

    return {**m, "description": desc, "root_cause": cause}


async def llm_audit(m: dict) -> dict:
    """
    Calls Google Gemini Flash to generate a natural-language audit explanation.
    Falls back to rule_based_audit() if API key is missing or call fails.
    Get a free key at: https://aistudio.google.com
    """
    if not GEMINI_KEY:
        return rule_based_audit(m)

    prompt = f"""You are a senior GST compliance auditor for India.
A graph traversal engine detected the following mismatch:

Invoice     : {m['inv_no']}
Supplier    : {m['supplier_gstin']}
Buyer       : {m['buyer_gstin']}
Type        : {m['mismatch_type']}
Severity    : {m['severity']}
Amount      : ₹{m['amount']:,.0f}
Period      : {m['period']}
Graph path  : {' → '.join(m['traversal_path'])}
Raw data    : {m['raw']}

Return ONLY a JSON object with exactly two keys:
  "description" – one sentence describing what the mismatch is
  "root_cause"  – one sentence explaining the most likely reason

Example: {{"description": "...", "root_cause": "..."}}"""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature":     0.2,
                        "maxOutputTokens": 256,
                    },
                },
            )
            text  = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                parsed = json.loads(match.group())
                return {**m, **parsed}
    except Exception as e:
        logger.warning("Gemini call failed (%s) — using rule-based fallback.", e)

    return rule_based_audit(m)


def store_audit_entry(audit: dict):
    """Writes one AuditEntry node to Neo4j."""
    q = """
    MERGE (a:AuditEntry {inv_no: $inv_no, mismatch_type: $mismatch_type})
    SET a.supplier_gstin  = $supplier_gstin,
        a.buyer_gstin     = $buyer_gstin,
        a.severity        = $severity,
        a.amount          = $amount,
        a.period          = $period,
        a.description     = $description,
        a.root_cause      = $root_cause,
        a.traversal_path  = $traversal_path,
        a.status          = 'flagged',
        a.created_at      = timestamp()
    """
    try:
        with get_driver().session() as session:
            session.run(q, {
                "inv_no":         audit["inv_no"],
                "mismatch_type":  audit["mismatch_type"],
                "supplier_gstin": audit["supplier_gstin"],
                "buyer_gstin":    audit["buyer_gstin"],
                "severity":       audit["severity"],
                "amount":         float(audit["amount"]),
                "period":         audit["period"],
                "description":    audit.get("description", ""),
                "root_cause":     audit.get("root_cause", ""),
                "traversal_path": " → ".join(audit["traversal_path"]),
            })
    except Exception as e:
        logger.error("store_audit_entry error: %s", e)


async def run_reconciliation_pipeline():
    """
    Full pipeline:
      1. Build NetworkX graph from Neo4j
      2. Detect mismatches via graph traversal
      3. Generate AI audit entries (LLM or rule-based)
      4. Persist AuditEntry nodes back to Neo4j
    """
    logger.info("🔄 Reconciliation pipeline started...")
    try:
        G          = build_networkx_graph()
        mismatches = detect_mismatches(G)
        logger.info("Detected %d mismatches", len(mismatches))
        for m in mismatches:
            audit = await llm_audit(m)
            store_audit_entry(audit)
        logger.info("✅ Pipeline complete — %d audit entries saved.", len(mismatches))
    except Exception as e:
        logger.error("Pipeline error: %s", e)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — AUDIT TRAIL ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/audit-trail")
async def get_audit_trail(
    severity: Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
):
    """Returns all AI-generated AuditEntry nodes from Neo4j."""
    where, params = "WHERE 1=1", {}
    if severity: where += " AND a.severity = $severity"; params["severity"] = severity
    if status:   where += " AND a.status   = $status";   params["status"]   = status

    q = f"""
    MATCH (a:AuditEntry)
    {where}
    RETURN a ORDER BY a.created_at DESC
    """
    try:
        with get_driver().session() as session:
            entries = []
            for i, record in enumerate(session.run(q, params)):
                a = record["a"]
                entries.append({
                    "id":             f"AUD-{str(i+1).zfill(3)}",
                    "inv_no":         a.get("inv_no", ""),
                    "supplier_gstin": a.get("supplier_gstin", ""),
                    "buyer_gstin":    a.get("buyer_gstin", ""),
                    "mismatch_type":  a.get("mismatch_type", ""),
                    "severity":       a.get("severity", "medium"),
                    "status":         a.get("status", "flagged"),
                    "amount":         a.get("amount", 0),
                    "period":         a.get("period", ""),
                    "description":    a.get("description", ""),
                    "root_cause":     a.get("root_cause", ""),
                    "traversal_path": a.get("traversal_path", "").split(" → "),
                })
        return {"total": len(entries), "entries": entries}
    except Exception as e:
        logger.error("audit-trail error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch audit trail.")


@app.post("/api/v1/reconcile")
async def trigger_reconciliation(background_tasks: BackgroundTasks):
    """Manually trigger the reconciliation + AI audit pipeline."""
    background_tasks.add_task(run_reconciliation_pipeline)
    return {"message": "Reconciliation started. Check /api/v1/audit-trail in ~5 seconds."}


@app.patch("/api/v1/audit-trail/{inv_no}/status")
async def update_audit_status(inv_no: str, new_status: str = Query(...)):
    """Update an audit entry status: flagged → reviewed → cleared."""
    if new_status not in {"flagged", "reviewed", "cleared"}:
        raise HTTPException(status_code=400, detail="Status must be: flagged / reviewed / cleared")
    try:
        with get_driver().session() as session:
            r = session.run(
                "MATCH (a:AuditEntry {inv_no: $inv_no}) SET a.status = $s RETURN a",
                {"inv_no": inv_no, "s": new_status}
            )
            if not r.single():
                raise HTTPException(status_code=404, detail=f"{inv_no} not found.")
        return {"message": f"{inv_no} updated to '{new_status}'"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("status update error: %s", e)
        raise HTTPException(status_code=500, detail="Update failed.")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — RECONCILIATION TABLE ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/reconciliation")
async def get_reconciliation_data():
    """Returns mismatch records for the Reconciliation table page."""
    q = """
    MATCH (s:Taxpayer)-[:ISSUED]->(i:Invoice)-[:BILLED_TO]->(b:Taxpayer)
    WHERE i.status IN ['mismatch', 'missing']
    OPTIONAL MATCH (a:AuditEntry {inv_no: i.inv_no})
    RETURN s.gstin AS supplier, b.gstin AS buyer,
           i.inv_no AS inv_no, i.amount AS amount,
           i.status AS status, i.period AS period,
           a.mismatch_type AS mismatch_type,
           a.severity AS severity
    ORDER BY i.amount DESC
    """
    try:
        with get_driver().session() as session:
            records = []
            for i, r in enumerate(session.run(q)):
                amt = float(r["amount"] or 0)
                st  = r["status"] or "mismatch"
                sev = r["severity"] or ("high" if amt > 100000 else "medium" if amt > 50000 else "low")
                records.append({
                    "id":            str(i + 1),
                    "invoiceNo":     r["inv_no"],
                    "supplierGstin": r["supplier"],
                    "supplierName":  r["supplier"],
                    "buyerGstin":    r["buyer"],
                    "gstr1Amount":   amt if st != "missing" else 0,
                    "gstr2bAmount":  0   if st == "missing" else amt,
                    "difference":    amt,
                    "mismatchType":  r["mismatch_type"] or st.title(),
                    "riskLevel":     sev.title(),
                    "status":        "Unresolved",
                    "period":        r["period"] or "",
                })
        return {"total": len(records), "records": records}
    except Exception as e:
        logger.error("reconciliation error: %s", e)

        raise HTTPException(status_code=500, detail="Failed to fetch reconciliation data.")
