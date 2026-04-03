"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  ChevronRight,
  LogOut,
} from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface FilePickerProps {
  onSelect: (file: DriveFile) => void;
  isAnalyzing: boolean;
}

export default function FilePicker({ onSelect, isAnalyzing }: FilePickerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/drive");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to load Drive files`);
      }
      setFiles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Select Spreadsheet
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchFiles}
            disabled={loading}
            data-testid="button-refresh-files"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose a powerlifting spreadsheet from your Google Drive
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search spreadsheets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="input-search-files"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive mb-4">
            <p className="font-medium mb-1">Drive access error</p>
            <p className="text-xs opacity-90 mb-3">{error}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fetchFiles} className="text-xs h-7">
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-destructive border-destructive/40"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-3 w-3 mr-1" /> Sign out &amp; reconnect
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {search ? "No matching spreadsheets" : "No spreadsheets found in your Drive"}
            </p>
          ) : (
            filtered.map((file) => (
              <button
                key={file.id}
                onClick={() => onSelect(file)}
                disabled={isAnalyzing}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-left hover:bg-accent transition-colors disabled:opacity-50 group"
                data-testid={`button-file-${file.id}`}
              >
                <FileSpreadsheet className="h-5 w-5 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Modified{" "}
                    {new Date(file.modifiedTime).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
