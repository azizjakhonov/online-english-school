/**
 * PdfActivity.tsx
 * ───────────────
 * Classroom PDF viewer — follows the exact same prop contract as other activities
 * (Quiz, MatchingGame, GapFill, Whiteboard): receives `content`, `isTeacher`,
 * `gameState`, and `onAction`.
 *
 * Sync protocol (reuses existing ZONE_ACTION mechanism):
 *   Teacher navigates  → onAction('page_change', { page })
 *     → ws.send({ type:'ZONE_ACTION', payload:{ activity_type:'pdf', action:'page_change', page } })
 *     → backend merges into zone_state, broadcasts ZONE_STATE_UPDATE
 *   Student receives   → gameState.page  → updates currentPage
 *   Late joiner        → receives full zone_state on connect → same effect
 *
 * Auth: PDF is fetched via `api` (axios with Authorization header).
 *       The binary response is converted to a blob URL for react-pdf.
 *       Raw /media/ URL is never used.
 */

import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Loader2, FileText, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

// Configure PDF.js worker (local copy bundled by Vite via new URL())
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── Types ────────────────────────────────────────────────────────────────────

interface PdfContent {
  pdf_id?:           number;
  pdf_download_url?: string;   // injected by LessonActivitySerializer
  pdf_title?:        string;
}

interface PdfGameState {
  action?: string;
  page?:   number;
}

interface PdfActivityProps {
  content:    PdfContent;
  isTeacher:  boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameState:  any;
  onAction:   (action: string, data: Record<string, unknown>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default memo(function PdfActivity({
  content,
  isTeacher,
  gameState,
  onAction,
}: PdfActivityProps) {
  interface FetchError { message: string; status?: number; retryable: boolean; }

  const [blobUrl,     setBlobUrl]     = useState<string | null>(null);
  const [numPages,    setNumPages]    = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpInput,   setJumpInput]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<FetchError | null>(null);
  // Incrementing this triggers a manual retry without changing the URL dep.
  // Nothing auto-increments it, so there is no infinite refetch loop.
  const [retryCount,  setRetryCount]  = useState(0);

  // Keep a ref to the blob URL so we can revoke it on unmount / URL change
  const blobUrlRef = useRef<string | null>(null);

  // ── Fit-to-screen sizing ───────────────────────────────────────────────────
  // containerRef points at the flex-1 canvas area (excludes the controls bar).
  const containerRef = useRef<HTMLDivElement>(null);
  // Live dimensions of that area (updated by ResizeObserver).
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  // Native PDF page dimensions at scale=1 (set once the first page renders).
  const [pdfPageSize, setPdfPageSize] = useState<{ width: number; height: number } | null>(null);

  // ── Fetch PDF with auth header ─────────────────────────────────────────────
  useEffect(() => {
    const downloadUrl = content.pdf_download_url;

    // No URL means the serializer couldn't resolve the pdf_id (asset deleted).
    if (!downloadUrl) {
      setLoading(false);
      setFetchError({ message: 'No PDF attached to this activity.', retryable: false });
      return;
    }

    // ── AbortController cancels the actual HTTP request on cleanup.
    // This is critical in React Strict Mode (dev), which runs every effect
    // twice: without abort, both requests complete and the first one's
    // now-revoked blob URL causes ERR_FAILED in PDF.js.
    let alive = true;
    const controller = new AbortController();

    setLoading(true);
    setFetchError(null);

    (async () => {
      try {
        const res = await api.get(downloadUrl, {
          responseType: 'blob',
          signal: controller.signal,
        });
        if (!alive) return;
        const url = URL.createObjectURL(res.data as Blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (err: unknown) {
        if (!alive) return;

        // AbortController fired — intentionally cancelled (Strict Mode cleanup,
        // effect re-run due to retryCount, or component unmount).
        // Do NOT set an error state; the next run will re-fetch if needed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any)?.code === 'ERR_CANCELED' ||
            (err instanceof Error && err.name === 'AbortError')) {
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const axiosErr = err as any;
        const httpStatus: number | undefined = axiosErr?.response?.status;

        // When responseType='blob', the server's error body (e.g. JSON 404)
        // arrives as a Blob, not a parsed object. Read it as text first.
        let detail: string | undefined;
        if (axiosErr?.response?.data instanceof Blob) {
          try {
            const text = await (axiosErr.response.data as Blob).text();
            detail = (JSON.parse(text) as { detail?: string })?.detail;
          } catch { /* ignore parse errors — fall back to generic messages */ }
        } else {
          detail = axiosErr?.response?.data?.detail;
        }

        console.error('[PdfActivity] fetch failed', httpStatus, detail ?? err);

        let message: string;
        let retryable = true;
        if (httpStatus === 400) {
          message   = detail ?? 'No PDF attached to this activity.';
          retryable = false;
        } else if (httpStatus === 403) {
          message   = detail ?? "You don't have access to this PDF.";
          retryable = false;
        } else if (httpStatus === 404) {
          message   = detail ?? 'PDF not found (deleted or wrong id).';
          retryable = false;
        } else if (httpStatus === 410) {
          message   = detail ?? 'PDF file missing on server.';
          retryable = false;
        } else {
          message = detail ?? 'Could not load PDF. Check your connection and try again.';
        }
        setFetchError({ message, status: httpStatus, retryable });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      // Cancel the in-flight HTTP request — prevents ERR_FAILED from a
      // now-revoked blob URL being handed to PDF.js after re-mount.
      controller.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setBlobUrl(null);
    };
  // retryCount is intentionally included: incrementing it re-triggers the
  // fetch when the user clicks Retry. It never auto-increments.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.pdf_download_url, retryCount]);

  // ── Apply page from teacher (gameState sync) ───────────────────────────────
  useEffect(() => {
    const gs = gameState as PdfGameState | null;
    if (!isTeacher && gs?.page && gs.page !== currentPage) {
      setCurrentPage(gs.page);
    }
  }, [gameState, isTeacher, currentPage]);

  // ── Teacher navigation ─────────────────────────────────────────────────────
  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > numPages) return;
    setCurrentPage(page);
    if (isTeacher) {
      // Reuse ZONE_ACTION — same channel as whiteboard/matching sync
      onAction('page_change', { page });
    }
  }, [numPages, isTeacher, onAction]);

  const handleJumpKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const p = parseInt(jumpInput, 10);
    if (!isNaN(p)) goToPage(p);
    setJumpInput('');
  }, [jumpInput, goToPage]);

  // ── Track canvas-area dimensions via ResizeObserver ───────────────────────
  // IMPORTANT: deps include `blobUrl`, not `[]`.
  // The component has early-return paths for loading/error states, so
  // `containerRef` is only attached to the DOM when the main JSX renders
  // (i.e. when blobUrl is set). Using `[]` means the effect fires during
  // the loading phase when containerRef.current is still null — the guard
  // hits early return and the ResizeObserver is never registered, leaving
  // containerSize null forever. Re-running on blobUrl guarantees the effect
  // fires after the main JSX (and containerRef's div) are in the DOM.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setContainerSize({ width: el.clientWidth, height: el.clientHeight });

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({
          width:  entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [blobUrl]); // re-runs when main JSX becomes visible

  // ── Pre-fetch page 1 dimensions as soon as the Document is parsed ─────────
  // pdf.getPage() is near-instant because the PDF bytes are already in memory.
  // Doing this inside Document.onLoadSuccess means pdfPageSize is set BEFORE
  // <Page> renders, so targetPageWidth is correct from the very first frame —
  // no "renders too wide → clipped → corrects itself" flash.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDocumentLoadSuccess = useCallback((pdf: any) => {
    setNumPages(pdf.numPages);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf.getPage(1).then((page: any) => {
      // Pass page.rotate so landscape PDFs stored as portrait are measured correctly.
      const vp = page.getViewport({ scale: 1, rotation: page.rotate ?? 0 });
      setPdfPageSize({ width: vp.width, height: vp.height });
    }).catch(() => {
      // Dimensions unavailable from pre-fetch — Page.onLoadSuccess will set them.
    });
  }, []);

  // ── object-fit:contain math ────────────────────────────────────────────────
  // Returns the pixel width to pass to <Page width={…} />.
  // react-pdf scales height proportionally from width, so one dimension suffices.
  // Returns undefined while either measurement is still pending — <Page> is
  // withheld until the value is known so it never renders at the wrong size.
  const targetPageWidth = useMemo<number | undefined>(() => {
    if (!containerSize || !pdfPageSize) return undefined;

    const { width: cW, height: cH } = containerSize;
    const { width: pW, height: pH } = pdfPageSize;

    // 2 px inset on each axis so CSS sub-pixel rounding never causes the canvas
    // to overflow by 1–2 px and get clipped by the parent overflow:hidden.
    const scale = Math.min((cW - 2) / pW, (cH - 2) / pH);
    return Math.floor(scale * pW);
  }, [containerSize, pdfPageSize]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <span className="text-sm font-medium">
          Loading {content.pdf_title || 'PDF'}…
        </span>
      </div>
    );
  }

  if (fetchError || !blobUrl) {
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
            onClick={() => setRetryCount(c => c + 1)}
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

      {/* ── PDF canvas ─────────────────────────────────────────────────────── */}
      {/*
        overflow-hidden  → no scrollbars ever
        items-center     → vertical centering (letterbox if aspect ratios differ)
        justify-center   → horizontal centering
      */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex justify-center items-center bg-gray-100"
      >
        <Document
          file={blobUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 size={22} className="animate-spin text-blue-400" />
              <span className="text-sm">Loading…</span>
            </div>
          }
        >
          {/* Gate rendering until targetPageWidth is known.
              If we rendered <Page> with width=undefined, react-pdf would use
              the PDF's native pixel size which can be far larger than the
              container, causing the visible clipping this fix addresses. */}
          {targetPageWidth === undefined ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 size={22} className="animate-spin text-blue-400" />
              <span className="text-sm">Preparing…</span>
            </div>
          ) : (
            <Page
              pageNumber={currentPage}
              width={targetPageWidth}
              onLoadSuccess={(page) => {
                // Update dimensions on page navigation — pages in the same PDF
                // can technically have different sizes (e.g. a cover page).
                const vp = page.getViewport({ scale: 1, rotation: page.rotate ?? 0 });
                setPdfPageSize({ width: vp.width, height: vp.height });
              }}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-xl rounded-lg overflow-hidden"
            />
          )}
        </Document>
      </div>

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      {numPages > 0 && (
        <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-center gap-3">
          {isTeacher ? (
            <>
              {/* Prev */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                title="Previous page"
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <ChevronLeft size={18} />
              </button>

              {/* Counter */}
              <span className="text-sm font-semibold text-gray-700 tabular-nums select-none w-24 text-center">
                {currentPage} / {numPages}
              </span>

              {/* Next */}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                title="Next page"
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <ChevronRight size={18} />
              </button>

              {/* Jump-to input */}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <input
                type="number"
                min={1}
                max={numPages}
                value={jumpInput}
                onChange={e => setJumpInput(e.target.value)}
                onKeyDown={handleJumpKeyDown}
                placeholder="Go to…"
                className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg text-center outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </>
          ) : (
            /* Students see a read-only page indicator */
            <span className="text-sm text-gray-400 select-none">
              Page {currentPage} of {numPages}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
