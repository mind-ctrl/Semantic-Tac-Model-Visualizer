"use client";

import { useState, useCallback } from "react";
import { useModel } from "@/lib/model-context";
import { parseTmdlZip } from "@/lib/tmdl-parser";
import { parseBimJson } from "@/lib/bim-parser";
import type { SemanticModel } from "@/lib/types";
import ModelViewer from "@/components/ModelViewer";

export default function Home() {
  const { model, setModel } = useModel();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsedModel, setParsedModel] = useState<SemanticModel | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      setParsedModel(null);
      try {
        const fileName = file.name.toLowerCase();
        let parsed;

        if (fileName.endsWith(".bim") || fileName.endsWith(".json")) {
          const text = await file.text();
          parsed = parseBimJson(text);
        } else {
          parsed = await parseTmdlZip(file);
        }

        if (parsed.tables.length === 0) {
          setError("No tables found in the uploaded file.");
          return;
        }
        setParsedModel(parsed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to parse file");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleGenerate = useCallback(() => {
    if (parsedModel) {
      setModel(parsedModel);
    }
  }, [parsedModel, setModel]);

  if (model) {
    return <ModelViewer />;
  }

  const totalMeasures = parsedModel ? parsedModel.tables.reduce((sum, t) => sum + t.measures.length, 0) : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-150 h-150 rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, var(--color-primary) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-125 h-125 rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)" }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-border flex items-center justify-center bg-(--color-surface)">
            <svg className="w-4 h-4 text-(--color-primary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-gradient">Semantic-tac</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-(--color-text-muted)">
          <span>Power BI Semantic Model Explorer</span>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex items-center px-8 pb-16">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left - copy */}
          <div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight mb-6">
              Understand your
              <br />
              <span className="text-gradient">semantic model</span>
              <br />
              at a glance
            </h1>
            <p className="text-lg text-(--color-text-muted) mb-10 leading-relaxed max-w-lg">
              Drop in your TMDL or .bim file and instantly explore interactive diagrams,
              health scores, and best practice analysis. Everything runs locally in your browser.
            </p>

            {/* Upload zone */}
            {!parsedModel && (
              <>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  className={`
                    rounded-2xl p-8 transition-all cursor-pointer
                    ${dragOver
                      ? "glow-teal bg-(--color-primary)/5 border-(--color-primary)/40"
                      : "glass-card hover:border-(--color-primary)/30"
                    }
                  `}
                  onClick={() => document.getElementById("file-input")?.click()}
                  style={{ border: dragOver ? "1px solid" : undefined }}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".zip,.bim,.json"
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  {loading ? (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-(--color-primary)/10 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
                      </div>
                      <div>
                        <p className="font-medium">Parsing model...</p>
                        <p className="text-sm text-(--color-text-muted)">Analyzing tables, relationships, and measures</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-(--color-primary)/10 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-(--color-primary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">Drop your model file or click to browse</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-(--color-primary)/10 text-(--color-primary-light) font-mono">.zip</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-(--color-accent)/10 text-(--color-accent-light) font-mono">.bim</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent-purple/10 text-(--color-accent-purple) font-mono">.json</span>
                          <span className="text-xs text-(--color-text-dim) ml-1">TMDL, Tabular Editor, pbi-tools</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Zip structure requirements */}
                <div className="mt-4 px-4 py-3 rounded-xl bg-(--color-surface)/60 border border-(--color-border-subtle) text-xs text-(--color-text-muted)">
                  <p className="font-medium text-(--color-text) mb-1.5">TMDL zip must contain:</p>
                  <ul className="space-y-0.5 font-mono text-[11px]">
                    <li>*.SemanticModel/ directory</li>
                    <li>definition/model.tmdl</li>
                    <li>definition/relationships.tmdl</li>
                    <li>definition/tables/*.tmdl <span className="text-(--color-text-dim) font-sans">(at least one)</span></li>
                  </ul>
                </div>
              </>
            )}

            {/* Parsed model summary + Generate button */}
            {parsedModel && (
              <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
                <div className="px-6 py-4 border-b border-(--color-border)">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-(--color-accent-green)/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-(--color-accent-green)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{parsedModel.name}</p>
                      <p className="text-xs text-(--color-text-muted)">Model parsed successfully</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-(--color-primary)">{parsedModel.tables.length}</div>
                    <div className="text-[11px] text-(--color-text-muted) uppercase tracking-wider mt-0.5">Tables</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-(--color-accent-orange)">{parsedModel.relationships.length}</div>
                    <div className="text-[11px] text-(--color-text-muted) uppercase tracking-wider mt-0.5">Relationships</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-(--color-accent-purple)">{totalMeasures}</div>
                    <div className="text-[11px] text-(--color-text-muted) uppercase tracking-wider mt-0.5">Measures</div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-(--color-border) flex items-center gap-3">
                  <button
                    onClick={handleGenerate}
                    className="flex-1 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))" }}
                  >
                    Generate
                  </button>
                  <button
                    onClick={() => setParsedModel(null)}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-(--color-text-muted) hover:bg-(--color-surface-light) transition-colors border border-(--color-border)"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-(--color-accent-red)/8 border border-(--color-accent-red)/20 text-sm text-(--color-accent-red) flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
          </div>

          {/* Right - feature preview */}
          <div className="hidden lg:block">
            <div className="space-y-4">
              {[
                { icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z", title: "Interactive Diagrams", desc: "ERD, Star Schema, Data Sources, RLS flow, and Calc Groups", color: "var(--color-primary)" },
                { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", title: "Health Score & Best Practices", desc: "Automated checks with DAX complexity scoring", color: "var(--color-accent)" },
                { icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z", title: "Privacy Mode", desc: "Obfuscate table and column names for safe sharing", color: "var(--color-accent-purple)" },
                { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", title: "Export Anywhere", desc: "PNG, SVG diagrams and full HTML reports", color: "var(--color-accent-orange)" },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-4 p-4 rounded-xl bg-(--color-surface)/50 border border-(--color-border-subtle) hover:border-(--color-border) transition-colors">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${feature.color} 12%, transparent)` }}>
                    <svg className="w-5 h-5" style={{ color: feature.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{feature.title}</h3>
                    <p className="text-sm text-(--color-text-muted) mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-4 text-center text-xs text-(--color-text-muted)">
        100% client-side. Your data never leaves your browser.
      </footer>
    </div>
  );
}
