'use client';

import { useState, useRef, useCallback } from 'react';

interface CVResult {
  filename: string;
  score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
  error?: string;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-green-100 text-green-800 border-green-300' :
    score >= 40 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
    'bg-red-100 text-red-800 border-red-300';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${color}`}>
      {score}% match
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function ResultCard({ result, rank }: { result: CVResult; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  if (result.error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-red-500 text-lg">⚠</span>
        <div>
          <p className="font-medium text-gray-800">{result.filename}</p>
          <p className="text-sm text-red-600 mt-1">{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg font-bold text-gray-400 w-6 shrink-0">#{rank}</span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{result.filename}</p>
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{result.summary}</p>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <ScoreBadge score={result.score} />
            <span className="text-xs text-gray-400">{expanded ? 'Hide details ▲' : 'Show details ▼'}</span>
          </div>
        </div>
        <ScoreBar score={result.score} />
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-green-700 mb-2">Strengths</h4>
            <ul className="space-y-1">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-red-700 mb-2">Gaps</h4>
            <ul className="space-y-1">
              {result.gaps.length > 0 ? result.gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-red-400 mt-0.5">✗</span>
                  {g}
                </li>
              )) : (
                <li className="text-sm text-gray-500 italic">No significant gaps identified</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [jdMode, setJdMode] = useState<'text' | 'file'>('text');
  const [jd, setJd] = useState('');
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdDragging, setJdDragging] = useState(false);
  const jdFileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<CVResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const allowed = Array.from(incoming).filter(
      (f) => f.name.endsWith('.pdf') || f.name.endsWith('.docx')
    );
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...allowed.filter((f) => !existing.has(f.name))];
    });
  }, []);

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleAnalyze = async () => {
    if (jdMode === 'text' && !jd.trim()) { setError('Please enter a job description.'); return; }
    if (jdMode === 'file' && !jdFile) { setError('Please upload a job description file.'); return; }
    if (files.length === 0) { setError('Please upload at least one CV.'); return; }

    setError('');
    setLoading(true);
    setResults([]);

    const formData = new FormData();
    if (jdMode === 'file' && jdFile) {
      formData.append('jdFile', jdFile);
    } else {
      formData.append('jd', jd);
    }
    files.forEach((f) => formData.append('cvs', f));

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">CV Shortlister</h1>
        <p className="text-gray-500 mt-2">Upload CVs, paste your JD, and get AI-powered match scores instantly.</p>
      </div>

      <div className="space-y-6">
        {/* Job Description */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-700">Job Description</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => { setJdMode('text'); setJdFile(null); }}
                className={`px-3 py-1.5 transition-colors ${jdMode === 'text' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Paste text
              </button>
              <button
                onClick={() => { setJdMode('file'); setJd(''); }}
                className={`px-3 py-1.5 transition-colors ${jdMode === 'file' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Upload file
              </button>
            </div>
          </div>

          {jdMode === 'text' ? (
            <>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={8}
                placeholder="Paste the full job description here — requirements, responsibilities, skills..."
                value={jd}
                onChange={(e) => setJd(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{jd.length} characters</p>
            </>
          ) : (
            <>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  jdDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setJdDragging(true); }}
                onDragLeave={() => setJdDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setJdDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f && (f.name.endsWith('.pdf') || f.name.endsWith('.docx'))) setJdFile(f);
                }}
                onClick={() => jdFileInputRef.current?.click()}
              >
                <input
                  ref={jdFileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setJdFile(f);
                  }}
                />
                <div className="text-4xl mb-2">📋</div>
                <p className="text-gray-600 font-medium">Drop JD file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Supports PDF and DOCX</p>
              </div>
              {jdFile && (
                <div className="mt-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-blue-800 truncate">
                    <span>{jdFile.name.endsWith('.pdf') ? '📕' : '📘'}</span>
                    <span className="truncate">{jdFile.name}</span>
                    <span className="text-blue-400 shrink-0">({(jdFile.size / 1024).toFixed(0)} KB)</span>
                  </span>
                  <button
                    onClick={() => setJdFile(null)}
                    className="ml-3 text-blue-400 hover:text-red-500 shrink-0 transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* CV Upload */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Upload CVs
          </label>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <div className="text-4xl mb-2">📄</div>
            <p className="text-gray-600 font-medium">Drop CV files here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports PDF and DOCX</p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ul className="mt-4 space-y-2">
              {files.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-gray-700 truncate">
                    <span>{f.name.endsWith('.pdf') ? '📕' : '📘'}</span>
                    <span className="truncate">{f.name}</span>
                    <span className="text-gray-400 shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                  </span>
                  <button
                    onClick={() => removeFile(f.name)}
                    className="ml-3 text-gray-400 hover:text-red-500 shrink-0 transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading
            ? `Analyzing ${files.length} CV${files.length > 1 ? 's' : ''}...`
            : `Analyze ${files.length} CV${files.length !== 1 ? 's' : ''}`}
        </button>

        {/* Loading indicator */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 text-center">
            Claude is reviewing each CV against the job description. This may take a moment...
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Results — {results.length} CV{results.length > 1 ? 's' : ''} ranked by match
              </h2>
              <span className="text-xs text-gray-400">Click a card to expand details</span>
            </div>
            <div className="space-y-3">
              {results.map((r, i) => (
                <ResultCard key={r.filename} result={r} rank={i + 1} />
              ))}
            </div>

            {/* Summary table */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Rank</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">CV</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Match %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r, i) => (
                    <tr key={r.filename} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">#{i + 1}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{r.filename}</td>
                      <td className="px-4 py-3 text-right">
                        {r.error ? (
                          <span className="text-red-500 text-xs">Error</span>
                        ) : (
                          <ScoreBadge score={r.score} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
