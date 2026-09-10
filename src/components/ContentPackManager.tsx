/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { 
  Upload, 
  FileJson, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Terminal, 
  Check, 
  FileCode,
  Info,
  Layers,
  ArrowRight
} from "lucide-react";
import { Subject } from "../types";

interface ContentPackManagerProps {
  subjects: Subject[];
  onRefreshContent: () => Promise<void>;
  /** Uploading writes into content/, so it is off where that is not
   *  persistent. See shared/capabilities.ts. */
  canUpload?: boolean;
}

export default function ContentPackManager({ subjects, onRefreshContent, canUpload = false }: ContentPackManagerProps) {
  const [jsonText, setJsonText] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const schemaTemplate = `{
  "exam": "CIL MT",
  "subject": "Computer Networks",
  "chapter": "OSI Model and TCP IP",
  "description": "Fundamental concepts of networking models, layer functionalities, and standard architectures.",
  "questions": [
    {
      "id": 1,
      "question": "Which layer of the OSI reference model is responsible for encryption of data?",
      "options": [
        "Session Layer",
        "Presentation Layer",
        "Application Layer",
        "Transport Layer"
      ],
      "answer": "Presentation Layer",
      "difficulty": "Easy",
      "source": "CIL MT 2021",
      "explanation": "Presentation layer handles data formatting, encryption, and compression.",
      "examTrick": "Remember P-E-C (Presentation, Encryption, Compression).",
      "importance": "High",
      "tags": ["OSI Model", "Security"]
    }
  ]
}`;

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(schemaTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateAndUpload = async (contentStr: string) => {
    try {
      setIsValidating(true);
      setUploadStatus(null);
      const content = JSON.parse(contentStr);

      // Validate required fields
      if (!content.subject || typeof content.subject !== "string") {
        throw new Error("Missing or invalid 'subject' string field.");
      }
      if (!content.chapter || typeof content.chapter !== "string") {
        throw new Error("Missing or invalid 'chapter' string field.");
      }
      if (!Array.isArray(content.questions) || content.questions.length === 0) {
        throw new Error("Missing or empty 'questions' array.");
      }

      // Validate first question structure
      const firstQ = content.questions[0];
      if (!firstQ.id || !firstQ.question || !Array.isArray(firstQ.options) || !firstQ.answer) {
        throw new Error("Questions must contain 'id', 'question' text, 'options' string array, and a 'answer' string matching one of the options.");
      }

      // Call API
      const res = await fetch("/api/content/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Server rejected content pack upload.");
      }

      const result = await res.json();
      setUploadStatus({
        success: true,
        message: result.message || "Content pack successfully uploaded and discovered!",
      });
      setJsonText("");
      await onRefreshContent();
    } catch (err: any) {
      console.error(err);
      setUploadStatus({
        success: false,
        message: err.message || "Failed to parse JSON. Check commas, brackets, and syntax.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleTextUploadSubmit = () => {
    if (!jsonText.trim()) return;
    validateAndUpload(jsonText);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      await validateAndUpload(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-7xl mx-auto pb-12">
      {/* Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-100 p-5 sm:p-6 rounded-2xl shadow-3xs">
        <div>
          <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
            CURRICULUM ARCHITECTURE
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5 flex items-center gap-2.5">
            <Upload className="w-6 h-6 text-indigo-600" /> Content Pack Manager
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            {canUpload
              ? "Add new chapter files to expand the curriculum — no code changes or redeploys needed."
              : "Browse the discovered curriculum and the content pack schema. Uploading is disabled on this deployment."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column (7 cols): File Drag & Paste uploads */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* File Upload Box */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
              Upload JSON Content Pack File
            </h3>

            {!canUpload ? (
              /* Uploading writes into content/, which does not persist on free
                 hosting tiers — so the controls are withheld rather than left
                 to fail silently. See shared/capabilities.ts. */
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-700">Uploading is disabled on this deployment</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Content packs are written into the <code className="font-mono text-slate-600">content/</code> folder,
                      which is not persistent on free hosting — an uploaded pack would disappear on the next restart.
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      To add content: drop the JSON into <code className="font-mono text-slate-600">content/&lt;exam&gt;/modules/&lt;subject&gt;/</code>,
                      commit, and redeploy. To re-enable this uploader, run the app locally
                      or set <code className="font-mono text-slate-600">ENABLE_AUTHORING=true</code>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
            <>
            {/* Drag & Drop Frame */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50 p-8 rounded-xl text-center cursor-pointer transition-all space-y-3"
            >
              <FileJson className="w-10 h-10 text-slate-400 mx-auto" />
              <div>
                <span className="text-xs font-bold text-slate-700 block">Drag & Drop file here, or browse</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Supports standard UTF-8 .json files</span>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".json" 
                onChange={handleFileUpload}
                className="hidden" 
              />
            </div>

            {/* Paste Text Frame */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider block">Or Paste Raw JSON Pack Text</label>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder="Paste complete JSON structure here..."
                rows={8}
                className="w-full border border-slate-200 rounded-xl p-4 font-mono text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 transition-all leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleTextUploadSubmit}
                  disabled={!jsonText.trim() || isValidating}
                  className="inline-flex items-center justify-center gap-1.5 min-h-11 sm:min-h-0 w-full sm:w-auto bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs"
                >
                  {isValidating ? "Validating..." : "Push Content Pack"}
                </button>
              </div>
            </div>

            {/* Upload Feedback Status banner */}
            {uploadStatus && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 mt-4 ${
                uploadStatus.success 
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                  : "bg-rose-50 border-rose-100 text-rose-800"
              }`}>
                {uploadStatus.success ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold font-display uppercase tracking-wider">
                    {uploadStatus.success ? "Discovery Successful" : "Validation Refused"}
                  </h4>
                  <p className="text-xs leading-relaxed opacity-90">{uploadStatus.message}</p>
                </div>
              </div>
            )}
            </>
            )}
          </div>

          {/* Active Discovered Directory logs */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-800 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-600" /> Discovery Log
            </h3>
            
            <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-xs space-y-2 max-h-[220px] overflow-y-auto leading-relaxed border border-slate-800">
              <div className="text-slate-500">// Booting exam-pack engine discovery logs...</div>
              <div>[OK] Found Content Directory: ./content/</div>
              {subjects.map((sub) => (
                <div key={sub.name}>
                  <div>[OK] Discovered Subject Node: <span className="text-indigo-300">"{sub.name}"</span></div>
                  {sub.chapters.map((chap) => (
                    <div key={chap.id} className="pl-4 text-slate-300 flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span>Found chapter: <span className="text-emerald-300">"{chap.id}.json"</span> {"→"} resolved to <span className="text-amber-300">"{chap.name}"</span> ({chap.questionsCount} items)</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="text-slate-500">[IDLE] Scanning content folder periodically. Ready.</div>
            </div>
          </div>

        </div>

        {/* Right column (5 cols): Schema template copy block */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs space-y-5">
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
              JSON Schema Specifications
            </h3>
            <p className="text-slate-400 text-xs">
              Every JSON content pack dropped into the folder must implement the following structure layout:
            </p>
          </div>

          <div className="relative">
            <button
              onClick={handleCopyTemplate}
              className="absolute top-3 right-3 inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <pre className="bg-slate-950 text-slate-300 p-4 pt-12 rounded-xl text-[10px] font-mono leading-relaxed overflow-x-auto max-h-[380px] border border-slate-800">
              {schemaTemplate}
            </pre>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-700 leading-relaxed font-medium">
              {canUpload ? (
                <>
                  You can copy this layout, edit the questions in any standard text editor, and either drag-upload or paste-push it right here. The pack is filed under <code className="font-mono">content/&lt;exam&gt;/modules/&lt;subject&gt;/</code> and appears immediately in the Dashboard and Subject screens — a new <code className="font-mono">exam</code> value simply creates a new exam folder.
                </>
              ) : (
                <>
                  You can copy this layout, edit the questions in any standard text editor, and commit the file to <code className="font-mono">content/&lt;exam&gt;/modules/&lt;subject&gt;/</code>. It is picked up on the next deploy — a new <code className="font-mono">exam</code> value simply creates a new exam folder.
                </>
              )}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
