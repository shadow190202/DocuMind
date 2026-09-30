"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  X,
  Loader2,
  FileCheck,
  ArrowRight,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { upload } from "@vercel/blob/client";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const supportedFormats = [
    { ext: ".pdf", label: "PDF Documents" },
    { ext: ".docx", label: "Word Documents" },
    { ext: ".txt", label: "Plain Text" },
    { ext: ".csv", label: "Structured CSV" },
  ];

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const validExtensions = [".pdf", ".docx", ".txt", ".csv"];
    const fileExt = "." + file.name.split(".").pop().toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      setError(`Unsupported file format (${fileExt}). Please upload a PDF, DOCX, TXT, or CSV file.`);
      setSelectedFile(null);
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 20MB limit.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
    setError(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const isVercelBlob =
        process.env.NEXT_PUBLIC_STORAGE_PROVIDER === "vercel-blob";

      if (isVercelBlob) {
        // Direct client upload to Vercel Blob (bypasses 4.5MB serverless body limit, supports 20MB)
        const blob = await upload(selectedFile.name, selectedFile, {
          access: "private",
          handleUploadUrl: "/api/documents/upload",
          clientPayload: JSON.stringify({
            filename: selectedFile.name,
            size: selectedFile.size,
            type: selectedFile.type,
          }),
        });

        // Register document in PostgreSQL database
        const registerResponse = await fetch("/api/documents/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "register",
            blobUrl: blob.url,
            filename: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type,
          }),
        });

        const data = await registerResponse.json();

        if (!registerResponse.ok) {
          throw new Error(data.error || "Failed to register uploaded document.");
        }

        setUploadResult(data.document);
      } else {
        // Standard multipart upload (for local development & offline testing)
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to upload document.");
        }

        setUploadResult(data.document);
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "An unexpected error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documents" className="gap-1.5 text-xs text-slate-500">
                <ArrowLeft className="w-4 h-4" />
                Back to Documents
              </Link>
            </Button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upload Document</h1>
          </div>
          <Badge variant="outline" className="text-xs">
            Phase 5 Ingestion Pipeline
          </Badge>
        </header>

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add New Document</CardTitle>
              <CardDescription>
                Files are stored securely in your private vault and indexed in PostgreSQL with initial status <code>pending</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dropzone Box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  isDragging
                    ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 scale-[1.01]"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-900"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-sm">
                  <UploadCloud className="w-7 h-7" />
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Click to browse or drag and drop your document here
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supports PDF, DOCX, TXT, or CSV (up to 20MB)
                  </p>
                </div>

                {/* Formats Pills */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {supportedFormats.map((f) => (
                    <Badge key={f.ext} variant="secondary" className="text-[11px] font-mono">
                      {f.ext}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 flex items-start gap-3 text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Upload Failed</p>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Selected File Stage Box */}
              {selectedFile && !uploadResult && (
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-lg bg-blue-600 text-white shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(selectedFile.size)} • Ready for ingestion
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          Confirm Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Success Result Box */}
              {uploadResult && (
                <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                        Document Uploaded Successfully!
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                        Saved to storage and registered in PostgreSQL. Ready for text extraction in Phase 6.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900 text-xs space-y-1">
                    <p>
                      <strong className="text-slate-700 dark:text-slate-300">File Name:</strong>{" "}
                      {uploadResult.filename}
                    </p>
                    <p>
                      <strong className="text-slate-700 dark:text-slate-300">Document ID:</strong>{" "}
                      <span className="font-mono text-[11px]">{uploadResult.id}</span>
                    </p>
                    <p>
                      <strong className="text-slate-700 dark:text-slate-300">Status:</strong>{" "}
                      <Badge variant="warning" className="text-[10px] ml-1">
                        {uploadResult.processingStatus}
                      </Badge>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button asChild size="sm" className="gap-1.5">
                      <Link href="/documents">
                        View in Documents
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadResult(null);
                        setSelectedFile(null);
                      }}
                    >
                      Upload Another
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
