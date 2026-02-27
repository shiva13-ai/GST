# Intelligent GST Reconciliation: Knowledge Graph-Based Fraud Detection

### 🚀 Overview
Traditional GST reconciliation relies on linear table matching, which often fails to detect complex fraud patterns like **Circular Trading** and **ITC Leakage**. Our solution leverages a **Knowledge Graph (Neo4j)** and **FastAPI** to model the entire tax ecosystem as an interconnected network of Taxpayers, Invoices, and Filings.

### 🎯 Key Features
* **Knowledge Graph Modeling**: Transforms flat GSTR-1 and GSTR-2B data into a multi-hop graph structure.
* **Circular Trading Detection**: Uses graph pathfinding to identify cycles (A → B → C → A) used for artificial tax credit inflation.
* **Real-Time Risk Scoring**: Dynamically calculates vendor risk based on compliance history and network connections.
* **Explainable AI (XAI)**: Provides a visual audit trail, showing exactly where a tax chain is broken.
* **Interactive Dashboard**: A high-performance React visualization built for real-time compliance monitoring.

### 🛠️ Tech Stack
* **Frontend**: React, TypeScript, React-Force-Graph, Axios.
* **Backend**: FastAPI (Python), Pandas, Pydantic.
* **Database**: Neo4j (Graph Database), Cypher Query Language.
* **Environment**: Uvicorn, Vite.

### 📂 Project Structure
```text
/HackWithAi
├── /glee-render-main     # Frontend (React + TS)
└── /backend              # Backend (FastAPI + Python)
