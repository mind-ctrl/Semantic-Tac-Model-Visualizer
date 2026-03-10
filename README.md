# Semantic Visualizer

A web-based tool for visualizing Power BI semantic models. Upload a TMDL zip or .bim file and instantly explore interactive diagrams of your data model — entirely in the browser.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React Flow](https://img.shields.io/badge/React%20Flow-12-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Entity Relationship Diagram (ERD)** — Full table/column view with relationship keys, data types, and cardinality
- **Star Schema View** — Automatic classification of tables into Fact, Dimension, Bridge, Measure, and Utility roles with radial layout
- **Data Sources Diagram** — Visualize the data pipeline from sources to tables (Direct Lake vs Import)
- **RLS Flow Diagram** — Map Row-Level Security roles to filtered tables and downstream propagation
- **Calculation Groups** — View calculation groups and their items with expressions and precedence
- **Health Dashboard** — DAX complexity analysis with measure-level scoring
- **100% Client-Side** — No data leaves your browser. All parsing and rendering happens locally.

## Supported File Formats

### TMDL Zip
A `.zip` file containing the TMDL folder structure:
```
*.SemanticModel/
  definition/
    model.tmdl
    relationships.tmdl
    tables/
      *.tmdl (at least one)
```

### BIM / JSON
A `.bim` or `.json` file in the Power BI model schema format (the serialized `model.bim` from Tabular Editor, Visual Studio, etc.)

## Diagram Interactions

- **Pan & Zoom** — Scroll to zoom, click and drag to pan
- **Node Selection** — Click a node to highlight its connections (ERD & Star Schema)
- **Node Resize** — Click a node to select it, then drag the corner handles to resize
- **MiniMap** — Use the interactive minimap in the bottom-right to navigate large models
- **Collapsible Sidebar** — Toggle the sidebar to maximize diagram space
- **Export** — Save any diagram as PNG or SVG

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Diagrams**: React Flow (@xyflow/react)
- **Styling**: Tailwind CSS v4
- **Parsing**: Custom TMDL/BIM parsers with JSZip
- **Language**: TypeScript

## License

MIT
