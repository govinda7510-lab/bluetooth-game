import React, { useState, useEffect } from "react";
import { Folder, FileCode, Copy, Check, Search, Terminal, AlertCircle } from "lucide-react";
import { CodeFile, flutterCodeFiles } from "../data/flutterCode";
import { kotlinCodeFiles } from "../data/kotlinCode";
import { productionCodeFiles } from "../data/complianceAndAdsCode";

interface CodeViewerProps {
  framework: "flutter" | "kotlin" | "launch";
}

export default function CodeViewer({ framework }: CodeViewerProps) {
  const files = 
    framework === "flutter" 
      ? flutterCodeFiles 
      : framework === "kotlin" 
      ? kotlinCodeFiles 
      : productionCodeFiles;

  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(framework === "launch" ? 0 : 2);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    setSelectedFileIndex(framework === "launch" ? 0 : 2);
  }, [framework]);

  const activeFile = files[selectedFileIndex] || files[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="code-viewer-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* File Explorer Panel */}
      <div className="lg:col-span-4 bg-slate-950/80 p-4 border-r border-slate-800 flex flex-col h-full min-h-[400px]">
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Project Workspace</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              id="search-workspace"
              type="text"
              placeholder="Filter workspace files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs py-2 pl-9 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto">
          <div className="flex items-center space-x-2 px-2 py-1 text-slate-400 font-medium text-xs">
            <Folder className="w-4 h-4 text-amber-500" />
            <span>
              {framework === "flutter" 
                ? "neon_aura_hockey/" 
                : framework === "kotlin" 
                ? "NeonAuraHockey/" 
                : "play_store_launch_prep/"}
            </span>
          </div>

          <div className="pl-4 space-y-1">
            {filteredFiles.map((file) => {
              const fileIdx = files.indexOf(file);
              const isSelected = fileIdx === selectedFileIndex;
              return (
                <button
                  id={`file-btn-${file.name.replace(".", "-")}`}
                  key={file.name}
                  onClick={() => setSelectedFileIndex(fileIdx)}
                  className={`w-full flex items-start space-x-2.5 px-3 py-2 rounded-lg text-left transition duration-150 group ${
                    isSelected 
                      ? "bg-sky-500/10 border border-sky-500/30 text-sky-400" 
                      : "border border-transparent text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <FileCode className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                  <div className="truncate w-full">
                    {"phase" in file && file.phase && (
                      <span className="inline-block text-[8px] bg-slate-800 text-sky-400 font-bold px-1.5 py-0.5 rounded-md mb-1 uppercase tracking-wider">
                        {file.phase}
                      </span>
                    )}
                    <p className="text-xs font-medium font-mono truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-normal truncate max-w-[220px]">{file.path}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Informative Footer Card */}
        <div className="mt-4 bg-slate-900/60 rounded-xl p-3 border border-slate-800">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              These source files contain complete, production-grade logic for discovery socket binding, byte array packing, and interpolation loops.
            </p>
          </div>
        </div>
      </div>

      {/* Editor & Code Render Screen */}
      <div className="lg:col-span-8 flex flex-col h-[600px] bg-slate-950">
        
        {/* Editor Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/40">
          <div className="flex flex-col">
            <span className="text-xs font-mono font-semibold text-slate-200">{activeFile.name}</span>
            <span className="text-[10px] text-slate-500 mt-0.5">{activeFile.description}</span>
          </div>

          <button
            id="btn-copy-code"
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white font-medium text-xs rounded-lg transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400 animate-scale" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy File</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content Box */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300 select-all scrollbar-thin">
          <pre className="whitespace-pre">
            <code>{activeFile.code}</code>
          </pre>
        </div>

        {/* Code Terminal Guidelines footer */}
        <div className="p-3 border-t border-slate-900 bg-slate-950 text-slate-500 text-[10px] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            <span>Path: <strong className="text-slate-400 font-mono">{activeFile.path}</strong></span>
          </div>
          <span>Lang: <strong className="text-slate-400 uppercase font-mono">{activeFile.language}</strong></span>
        </div>

      </div>

    </div>
  );
}
