/**
 * PdfActivity.tsx
 *
 * Classroom PDF viewer used by both teacher and student.
 * The component first tries a direct authenticated URL source for react-pdf,
 * then falls back to an explicit blob fetch for browsers that fail direct loading.
 */

import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Loader2, FileText, RefreshCw } from 'lucide-react';
import { resolveApiUrl } from '../../lib/api';

// Configure PDF.js worker (local copy bundled by Vite via new URL())
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfContent {
  pdf_id?: number;
  pdf_download_url?: string;
  pdf_title?: string;
}

interface PdfGameState {
  action?: string;
  page?: number;
}

interface PdfActivityProps {
  content: PdfContent;
  isTeacher: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameState: any;
  onAction: (action: string, data: Record<string, unknown>) => void;
}

interface FetchError {
  message: string;
  status?: number;
  retryable: boolean;
}

interface PdfUrlSource {
  url: string;
  httpHeaders?: Record<string, string>;
  withCredentials?: boolean;
}

type PdfFileSource = string | PdfUrlSource;

function buildFetchError(status?: number, detail?: string): FetchError {
  if (status === 401) {
    return { message: detail ?? 'Session expired. Please sign in again.', status, retryable: false };
  }
  if (status === 403) {
    return { message: detail ?? "You don't have access to this PDF.", status, retryable: false };
  }
  if (status === 404) {
    return { message: detail ?? 'PDF not found (deleted or wrong id).', status, retryable: false };
  }
  if (status === 410) {
    return { message: detail ?? 'PDF file missing on server.', status, retryable: false };
  }
  return {
    message: detail ?? 'Could not load PDF. Check your connection and try again.',
    status,
    retryable: true,
  };
}

export default memo(function PdfActivity({
  content,
  isTeacher,
  gameState,
  onAction,
}: PdfActivityProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpInput, setJumpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<FetchError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [forceBlobMode, setForceBlobMode] = useState(false);

  // Viewport (16:9) and page size for scale-to-fit (no scroll, no crop)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const fallbackAttemptedRef = useRef(false);
  const fallbackRequestIdRef = useRef(0);

  const token = localStorage.getItem('access_token');
  const resolvedDownloadUrl = useMemo(() => {
    const raw = content.pdf_download_url?.trim();
    if (!raw) return '';
    return resolveApiUrl(raw);
  }, [content.pdf_download_url]);

  const directPdfSource = useMemo<PdfUrlSource | null>(() => {
    if (!resolvedDownloadUrl || !token) return null;
    return {
      url: resolvedDownloadUrl,
      httpHeaders: {
        Authorization: `Bearer ${token}`,
      },
      withCredentials: true,
    };
  }, [resolvedDownloadUrl, token]);

  const pdfSource: PdfFileSource | null = forceBlobMode
    ? blobUrl
    : (blobUrl ?? directPdfSource);

  const releaseBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  const fetchBlobFallback = useCallback(async () => {
    if (!resolvedDownloadUrl || !token) {
      setLoading(false);
      setFetchError(buildFetchError(401));
      return;
    }

    const requestId = ++fallbackRequestIdRef.current;
    setLoading(true);
    setFetchError(null);

    console.info('[PdfActivity] blob fallback request', {
      role: isTeacher ? 'teacher' : 'student',
      downloadPath: content.pdf_download_url,
      resolvedDownloadUrl,
      requestHeaders: ['Authorization'],
    });

    try {
      const response = await fetch(resolvedDownloadUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (requestId !== fallbackRequestIdRef.current) return;

      if (!response.ok) {
        let detail: string | undefined;
        const text = await response.text();
        if (text) {
          try {
            detail = (JSON.parse(text) as { detail?: string }).detail ?? text;
          } catch {
            detail = text;
          }
        }
        throw { status: response.status, detail } as { status: number; detail?: string };
      }

      const blob = await response.blob();
      if (requestId !== fallbackRequestIdRef.current) return;

      const contentType = (blob.type || response.headers.get('Content-Type') || '').toLowerCase();
      if (!contentType.includes('pdf')) {
        throw {
          status: 502,
          detail: `Unexpected content type from PDF endpoint: ${contentType || 'unknown'}`,
        } as { status: number; detail: string };
      }

      const objectUrl = URL.createObjectURL(blob);
      releaseBlobUrl();
      blobUrlRef.current = objectUrl;
      setBlobUrl(objectUrl);

      console.info('[PdfActivity] blob fallback success', {
        role: isTeacher ? 'teacher' : 'student',
        resolvedDownloadUrl,
        contentType,
        size: blob.size,
      });
    } catch (err: unknown) {
      if (requestId !== fallbackRequestIdRef.current) return;

      const status = typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: number }).status)
        : undefined;
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String((err as { detail?: string }).detail)
        : undefined;

      console.error('[PdfActivity] blob fallback failed', {
        role: isTeacher ? 'teacher' : 'student',
        resolvedDownloadUrl,
        status,
        detail,
        err,
      });

      setFetchError(buildFetchError(status, detail));
    } finally {
      if (requestId === fallbackRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [content.pdf_download_url, isTeacher, releaseBlobUrl, resolvedDownloadUrl, token]);

  // Reset source state whenever URL/token changes or user clicks retry.
  useEffect(() => {
    fallbackRequestIdRef.current += 1;
    fallbackAttemptedRef.current = false;
    setForceBlobMode(false);
    setFetchError(null);
    setNumPages(0);
    setPageSize(null);
    releaseBlobUrl();

    if (!content.pdf_download_url) {
      setFetchError({ message: 'No PDF attached to this activity.', retryable: false });
      return;
    }

    if (!token) {
      setFetchError(buildFetchError(401));
      return;
    }

    console.info('[PdfActivity] source resolved', {
      role: isTeacher ? 'teacher' : 'student',
      downloadPath: content.pdf_download_url,
      resolvedDownloadUrl,
      hasAuthorizationHeader: Boolean(token),
      mode: 'direct-url-with-auth-header',
    });
  }, [content.pdf_download_url, isTeacher, releaseBlobUrl, resolvedDownloadUrl, retryCount, token]);

  // Release object URL on unmount.
  useEffect(() => {
    return () => {
      fallbackRequestIdRef.current += 1;
      releaseBlobUrl();
    };
  }, [releaseBlobUrl]);

  const handleDocumentSourceError = useCallback((err: Error) => {
    console.error('[PdfActivity] direct source failed', {
      role: isTeacher ? 'teacher' : 'student',
      resolvedDownloadUrl,
      err,
    });

    if (!fallbackAttemptedRef.current) {
      fallbackAttemptedRef.current = true;
      setForceBlobMode(true);
      void fetchBlobFallback();
      return;
    }

    setFetchError(buildFetchError(undefined, 'Could not load PDF source.'));
  }, [fetchBlobFallback, isTeacher, resolvedDownloadUrl]);

  const handleDocumentLoadError = useCallback((err: Error) => {
    console.error('[PdfActivity] document render failed', {
      role: isTeacher ? 'teacher' : 'student',
      resolvedDownloadUrl,
      forceBlobMode,
      err,
    });

    if (!fallbackAttemptedRef.current) {
      fallbackAttemptedRef.current = true;
      setForceBlobMode(true);
      void fetchBlobFallback();
      return;
    }

    setFetchError(buildFetchError(undefined, 'Could not render this PDF file.'));
  }, [fetchBlobFallback, forceBlobMode, isTeacher, resolvedDownloadUrl]);

  // Measure 16:9 viewport for scale-to-fit
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el) {
        setViewportSize({ width: el.clientWidth, height: el.clientHeight });
      }
    });
    ro.observe(el);
    setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [pdfSource]);

  // Apply page from teacher (gameState sync)
  useEffect(() => {
    const gs = gameState as PdfGameState | null;
    if (!isTeacher && gs?.page && gs.page !== currentPage) {
      setCurrentPage(gs.page);
    }
  }, [gameState, isTeacher, currentPage]);

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > numPages) return;
    setCurrentPage(page);
    if (isTeacher) {
      onAction('page_change', { page });
    }
  }, [numPages, isTeacher, onAction]);

  const handleJumpKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const p = parseInt(jumpInput, 10);
    if (!isNaN(p)) goToPage(p);
    setJumpInput('');
  }, [jumpInput, goToPage]);

  const renderWidth =
    viewportSize.width > 0 &&
    viewportSize.height > 0 &&
    pageSize
      ? (() => {
          const scale = Math.min(
            viewportSize.width / pageSize.width,
            viewportSize.height / pageSize.height,
          );
          return pageSize.width * scale;
        })()
      : undefined;

  const onPageLoadSuccess = useCallback(({ width, height }: { width: number; height: number }) => {
    setPageSize({ width, height });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <span className="text-sm font-medium">
          Loading {content.pdf_title || 'PDF'}...
        </span>
      </div>
    );
  }

  if (fetchError || !pdfSource) {
    const errMsg = fetchError?.message ?? 'No PDF available for this activity.';
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-red-500 p-8 text-center">
        <FileText size={36} className="text-red-300" />
        <p className="text-sm font-semibold">{errMsg}</p>
        {fetchError?.status && (
          <p className="text-xs text-gray-400 tabular-nums">HTTP {fetchError.status}</p>
        )}
        {fetchError?.retryable && (
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-2">
        <div
          ref={viewportRef}
          className="w-full h-full max-h-full aspect-video bg-white rounded-xl shadow-lg overflow-hidden flex items-center justify-center"
          style={{ maxWidth: '100%' }}
        >
          <Document
            key={`${resolvedDownloadUrl}-${retryCount}-${forceBlobMode ? 'blob' : 'direct'}`}
            file={pdfSource}
            onSourceError={handleDocumentSourceError}
            onLoadError={handleDocumentLoadError}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setCurrentPage((prev) => Math.min(Math.max(prev, 1), n || 1));
            }}
            loading={
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 size={22} className="animate-spin text-blue-400" />
                <span className="text-sm">Rendering...</span>
              </div>
            }
          >
            <Page
              pageNumber={Math.min(Math.max(currentPage, 1), numPages || 1)}
              width={renderWidth ?? (viewportSize.width || undefined)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={onPageLoadSuccess}
              onLoadError={handleDocumentLoadError}
              className="shadow-lg"
            />
          </Document>
        </div>
      </div>

      {numPages > 0 && (
        <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-center gap-3">
          {isTeacher ? (
            <>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                title="Previous page"
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <ChevronLeft size={18} />
              </button>

              <span className="text-sm font-semibold text-gray-700 tabular-nums select-none w-24 text-center">
                {currentPage} / {numPages}
              </span>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                title="Next page"
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <ChevronRight size={18} />
              </button>

              <div className="w-px h-5 bg-gray-200 mx-1" />
              <input
                type="number"
                min={1}
                max={numPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={handleJumpKeyDown}
                placeholder="Go to..."
                className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg text-center outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </>
          ) : (
            <span className="text-sm text-gray-400 select-none">
              Page {currentPage} of {numPages}
            </span>
          )}
        </div>
      )}
    </div>
  );
});



