'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { convertToZip } from '@/lib/converters/schema1-to-zip';
import { convertToSchema2 } from '@/lib/converters/schema1-to-schema2';

type Status = 'idle' | 'loading' | 'success' | 'error';
type StatusMessage = {
  type: Status;
  message: string;
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<unknown>(null);
  const [status, setStatus] = useState<StatusMessage>({ type: 'idle', message: 'Ready' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent hydration mismatch by only rendering dynamic content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFile = useCallback(async (selectedFile: File) => {
    setStatus({ type: 'loading', message: 'Reading file...' });

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      // Validate it looks like Raptor v0.69
      if (!data.documentsById || !data.folders) {
        throw new Error('Invalid Raptor v0.69 format: missing documentsById or folders');
      }

      setFile(selectedFile);
      setJsonData(data);
      setStatus({ type: 'success', message: `Loaded: ${selectedFile.name}` });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to parse JSON',
      });
      setFile(null);
      setJsonData(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && droppedFile.name.endsWith('.json')) {
        handleFile(droppedFile);
      } else {
        setStatus({ type: 'error', message: 'Please drop a JSON file' });
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
  );

  const handleExportZip = useCallback(async () => {
    if (!jsonData) return;

    setStatus({ type: 'loading', message: 'Generating ZIP...' });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { blob, stats } = await convertToZip(jsonData as any);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file?.name.replace('.json', '.zip') || 'export.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({
        type: 'success',
        message: `Downloaded ZIP: ${stats.foldersProcessed} folders, ${stats.documentsProcessed} documents`,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate ZIP',
      });
    }
  }, [jsonData, file]);

  const handleExportSchema2 = useCallback(() => {
    if (!jsonData) return;

    setStatus({ type: 'loading', message: 'Converting to Raptor v1.0...' });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { result, stats } = convertToSchema2(jsonData as any);

      // Trigger download
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file?.name.replace('.json', '_v1.json') || 'raptor_v1.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({
        type: 'success',
        message: `Downloaded Raptor v1.0: ${stats.foldersProcessed} folders, ${stats.documentsProcessed} documents`,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to convert',
      });
    }
  }, [jsonData, file]);

  const statusColor =
    status.type === 'error'
      ? 'text-red-900'
      : status.type === 'success'
        ? 'text-green-900'
        : 'text-neutral-900';

  // Show loading state during SSR/hydration
  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-white">
        <div className="w-full max-w-xl space-y-6">
          <h1 className="text-3xl font-bold text-center text-black">Raptor Converter</h1>
          <div className="p-12 border-2 border-dashed border-neutral-400 bg-white rounded-lg">
            <div className="text-center text-neutral-600">Loading...</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-xl space-y-6">
        <h1 className="text-3xl font-bold text-center text-black">Raptor Converter</h1>

        {/* Dropzone */}
        <Card
          className={`p-12 border-2 border-dashed cursor-pointer transition-colors ${
            isDragging ? 'border-black bg-neutral-100' : 'border-neutral-400 bg-white'
          } ${file ? 'border-solid border-black' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={file ? `Loaded file: ${file.name}. Click to change.` : 'Drop JSON file here or click to browse'}
        >
          <div className="text-center">
            {file ? (
              <div className="space-y-2">
                <div className="text-2xl" aria-hidden="true">📄</div>
                <p className="font-semibold text-black">{file.name}</p>
                <p className="text-sm text-neutral-600">Click to change file</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl" aria-hidden="true">📁</div>
                <p className="text-lg font-medium text-black">Drop JSON file here</p>
                <p className="text-sm text-neutral-600">or click to browse</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleInputChange}
            aria-hidden="true"
          />
        </Card>

        {/* Export Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleExportZip}
            disabled={!jsonData || status.type === 'loading'}
            className="flex-1 h-12 text-base font-semibold bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-black focus:ring-offset-2"
            aria-describedby="status-message"
          >
            Export ZIP
          </Button>
          <Button
            onClick={handleExportSchema2}
            disabled={!jsonData || status.type === 'loading'}
            variant="outline"
            className="flex-1 h-12 text-base font-semibold border-2 border-black text-black hover:bg-neutral-100 disabled:border-neutral-300 disabled:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-black focus:ring-offset-2"
            aria-describedby="status-message"
          >
            Export Raptor v1.0
          </Button>
        </div>

        {/* Status Bar */}
        <div
          id="status-message"
          role="status"
          aria-live="polite"
          className={`p-4 bg-neutral-100 rounded text-center font-medium ${statusColor}`}
        >
          {status.type === 'loading' && (
            <span className="inline-block mr-2 animate-spin" aria-hidden="true">⏳</span>
          )}
          {status.message}
        </div>
      </div>
    </main>
  );
}
