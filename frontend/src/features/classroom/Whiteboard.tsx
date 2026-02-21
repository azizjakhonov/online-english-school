import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Circle as KonvaCircle, Transformer, Image as KonvaImage } from 'react-konva';
import { Pencil, Eraser, Square, Circle, Trash2, Download, MousePointer2 } from 'lucide-react';
import Konva from 'konva';

interface Props {
  width: number;
  height: number;
  backgroundImage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameState?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (action: string, data: any) => void;
  isTeacher?: boolean;
  isConnected?: boolean;
}

type ShapeType = {
  id: string;
  tool: string;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  stroke: string;
  strokeWidth: number;
};

const COLORS = ['#2563eb', '#10b981', '#e11d48', '#f59e0b', '#0f172a', '#ffffff'];

function WhiteboardInner({
  width,
  height,
  backgroundImage,
  gameState,
  onAction,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isTeacher = false,
  isConnected,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);

  const [shapes, setShapes] = useState<ShapeType[]>([]);
  // shapesRef mirrors shapes so event handlers always read the latest value
  const shapesRef = useRef<ShapeType[]>([]);

  const [currentShapeId, setCurrentShapeId] = useState<string | null>(null);
  // currentShapeIdRef lets handleMouseMove / handleMouseUp read the current id
  // without stale-closure issues
  const currentShapeIdRef = useRef<string | null>(null);

  const [slideImage, setSlideImage] = useState<HTMLImageElement | null>(null);

  // Stores JSON.stringify of the last normalized shapes we sent, to drop our
  // own echo when the backend broadcasts it back to us
  const lastNormalizedShapesStr = useRef<string>('');

  // Timestamp of the last onAction call during mousemove (30 fps throttle)
  const lastSyncRef = useRef<number>(0);

  const [tool, setTool] = useState<string>('pencil');
  const [color, setColor] = useState('#2563eb');
  const [brushSize, setBrushSize] = useState(3);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Konva.Node | null>(null);

  const isDraggable = tool === 'select';

  // Keep shapesRef in sync with shapes state (safety net — event handlers also
  // update it eagerly to avoid a one-frame lag)
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  // Keep currentShapeIdRef in sync
  useEffect(() => {
    currentShapeIdRef.current = currentShapeId;
  }, [currentShapeId]);

  // ── 1. COORDINATE NORMALIZATION ──────────────────────────────────────────────

  const denormalizeShape = useCallback((shape: ShapeType): ShapeType => {
    const s = { ...shape };
    if (s.points) s.points = s.points.map((p, i) => i % 2 === 0 ? p * width : p * height);
    if (s.x !== undefined) s.x = s.x * width;
    if (s.y !== undefined) s.y = s.y * height;
    if (s.width !== undefined) s.width = s.width * width;
    if (s.height !== undefined) s.height = s.height * height;
    if (s.radius !== undefined) s.radius = s.radius * Math.min(width, height);
    return s;
  }, [width, height]);

  const normalizeShape = useCallback((shape: ShapeType): ShapeType => {
    const s = { ...shape };
    if (s.points) s.points = s.points.map((p, i) => i % 2 === 0 ? p / width : p / height);
    if (s.x !== undefined) s.x = s.x / width;
    if (s.y !== undefined) s.y = s.y / height;
    if (s.width !== undefined) s.width = s.width / width;
    if (s.height !== undefined) s.height = s.height / height;
    if (s.radius !== undefined) s.radius = s.radius / Math.min(width, height);
    return s;
  }, [width, height]);

  // ── 2. REMOTE STATE SYNC ─────────────────────────────────────────────────────

  useEffect(() => {
    // Don't overwrite local state while the user is actively drawing
    if (currentShapeId) return;
    if (!gameState) return;

    // Remote clear
    if (gameState.action === 'clear_board') {
      // Both refs updated synchronously so event-handlers read correct data immediately.
      shapesRef.current = [];
      lastNormalizedShapesStr.current = JSON.stringify([]);
      // setShapes([]) deferred to a microtask so it is NOT called in the
      // synchronous body of useEffect — satisfies react-hooks/set-state-in-effect.
      // queueMicrotask runs before the next paint (same event-loop turn, after I/O),
      // so there is no visible delay and no extra re-render cycle.
      queueMicrotask(() => setShapes([]));
      return;
    }

    // Remote draw: full shapes array
    if (gameState.shapes && Array.isArray(gameState.shapes)) {
      const remoteStr = JSON.stringify(gameState.shapes);
      // Skip our own echo
      if (remoteStr === lastNormalizedShapesStr.current) return;
      lastNormalizedShapesStr.current = remoteStr;
      const newShapes = (gameState.shapes as ShapeType[]).map(denormalizeShape);
      shapesRef.current = newShapes;
      setShapes(newShapes);
    }
  }, [gameState, denormalizeShape, currentShapeId]);

  // ── 3. BACKGROUND IMAGE ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!backgroundImage) {
      const id = requestAnimationFrame(() => setSlideImage(null));
      return () => cancelAnimationFrame(id);
    }
    const img = new window.Image();
    img.src = backgroundImage;
    img.crossOrigin = 'Anonymous';
    img.onload = () => setSlideImage(img);
  }, [backgroundImage]);

  // ── 4. TRANSFORMER ───────────────────────────────────────────────────────────

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      if (selectedId && stageRef.current) {
        const node = stageRef.current.findOne('.' + selectedId);
        setSelectedNode(node || null);
      } else {
        setSelectedNode(null);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [selectedId, shapes]);

  // ── 5. DRAWING ACTIONS ───────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage() || e.target.className === 'Image';
      if (clickedOnEmpty) setSelectedId(null);
      return;
    }

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    const id = `shape-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    // Update both ref and state eagerly so handleMouseMove sees the id immediately
    currentShapeIdRef.current = id;
    setCurrentShapeId(id);

    const common = {
      id,
      tool,
      stroke: tool === 'eraser' ? '#ffffff' : color,
      strokeWidth: tool === 'eraser' ? 25 : brushSize,
    };

    let newShape: ShapeType;
    if (tool === 'pencil' || tool === 'eraser') {
      newShape = { ...common, points: [pos.x, pos.y] };
    } else if (tool === 'rect') {
      newShape = { ...common, x: pos.x, y: pos.y, width: 0, height: 0 };
    } else {
      newShape = { ...common, x: pos.x, y: pos.y, radius: 0 };
    }

    const nextShapes = [...shapesRef.current, newShape];
    shapesRef.current = nextShapes;
    setShapes(nextShapes);
  }, [tool, color, brushSize]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const shapeId = currentShapeIdRef.current;
    if (!shapeId || tool === 'select') return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    // Compute next shapes synchronously from ref (avoids stale closure)
    const prevShapes = shapesRef.current;
    const nextShapes = prevShapes.map((s) => {
      if (s.id !== shapeId) return s;
      if (s.tool === 'pencil' || s.tool === 'eraser') {
        return { ...s, points: [...(s.points || []), pos.x, pos.y] };
      } else if (s.tool === 'rect') {
        return { ...s, width: pos.x - (s.x || 0), height: pos.y - (s.y || 0) };
      } else if (s.tool === 'circle') {
        const dx = pos.x - (s.x || 0);
        const dy = pos.y - (s.y || 0);
        return { ...s, radius: Math.sqrt(dx * dx + dy * dy) };
      }
      return s;
    });

    // Update ref immediately so consecutive moves read current data
    shapesRef.current = nextShapes;
    setShapes(nextShapes);

    // Throttled full-array sync — 30 fps (33 ms)
    if (onAction) {
      const now = Date.now();
      if (now - lastSyncRef.current >= 33) {
        lastSyncRef.current = now;
        const normalized = nextShapes.map(normalizeShape);
        lastNormalizedShapesStr.current = JSON.stringify(normalized);
        onAction('draw_event', { shapes: normalized });
      }
    }
  }, [tool, onAction, normalizeShape]);

  const handleMouseUp = useCallback(() => {
    // Always sync the final stroke state — no throttle
    if (currentShapeIdRef.current && onAction) {
      const normalized = shapesRef.current.map(normalizeShape);
      lastNormalizedShapesStr.current = JSON.stringify(normalized);
      onAction('draw_event', { shapes: normalized });
    }
    currentShapeIdRef.current = null;
    setCurrentShapeId(null);
  }, [onAction, normalizeShape]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Clear all drawings?')) return;
    shapesRef.current = [];
    setShapes([]);
    lastNormalizedShapesStr.current = JSON.stringify([]);
    if (onAction) onAction('clear_board', {});
  }, [onAction]);

  const handleDownload = useCallback(() => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = 'whiteboard-export.png';
    link.href = uri;
    link.click();
  }, []);

  const isEmpty = !backgroundImage && shapes.length === 0;

  return (
    <div className="w-full h-full relative bg-white overflow-hidden select-none">

      {/* ── TOOLBAR ─────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-auto">

        {/* Main pill */}
        <div className="flex items-center gap-0.5 p-1.5 bg-white border border-gray-200 shadow-md rounded-2xl">

          {/* Group 1 — Select */}
          <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} title="Select" icon={<MousePointer2 size={17} />} />

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          {/* Group 2 — Draw */}
          <ToolBtn active={tool === 'pencil'} onClick={() => setTool('pencil')} title="Pencil" icon={<Pencil size={17} />} />
          <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser" icon={<Eraser size={17} />} />

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          {/* Group 3 — Shapes */}
          <ToolBtn active={tool === 'rect'} onClick={() => setTool('rect')} title="Rectangle" icon={<Square size={17} />} />
          <ToolBtn active={tool === 'circle'} onClick={() => setTool('circle')} title="Circle" icon={<Circle size={17} />} />

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          {/* Group 4 — Color swatches */}
          <div className="flex items-center gap-1 px-1">
            {COLORS.map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => {
                  setColor(c);
                  if (tool === 'select' || tool === 'eraser') setTool('pencil');
                }}
                className={`w-5 h-5 rounded-full transition-all ring-offset-1 ${
                  color === c
                    ? 'scale-110 ring-2 ring-gray-400'
                    : 'hover:scale-105 ring-2 ring-transparent'
                } ${c === '#ffffff' ? 'border border-gray-200' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          {/* Group 5 — Status + actions */}
          {isConnected !== undefined && (
            <div className="flex items-center gap-1 px-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className={`text-[10px] font-semibold ${isConnected ? 'text-emerald-600' : 'text-red-500'}`}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          )}

          <button
            onClick={handleClear}
            title="Clear board"
            className="p-2 rounded-xl transition-all duration-200 text-rose-500 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
          >
            <Trash2 size={17} />
          </button>

          <button
            onClick={handleDownload}
            title="Download as PNG"
            className="p-2 rounded-xl transition-all duration-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
          >
            <Download size={17} />
          </button>
        </div>

        {/* Size slider — shown when pencil or eraser is active */}
        {(tool === 'pencil' || tool === 'eraser') && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-2 flex items-center gap-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Size</span>
            <input
              type="range"
              min="1"
              max="15"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-20 accent-blue-600"
            />
            <span className="text-xs font-bold text-gray-600 w-4 tabular-nums">{brushSize}</span>
          </div>
        )}
      </div>

      {/* ── EMPTY STATE ─────────────────────────────────────────────────────── */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <Pencil size={32} className="text-gray-200 mb-2" />
          <p className="text-sm text-gray-300">Start drawing…</p>
        </div>
      )}

      {/* ── CANVAS ──────────────────────────────────────────────────────────── */}
      <Stage
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={stageRef}
      >
        <Layer>
          {slideImage && (
            <KonvaImage image={slideImage} width={width} height={height} listening={false} />
          )}
        </Layer>
        <Layer>
          {shapes.map((shape) => {
            const { id, tool: sTool, ...shapeProps } = shape;
            if (sTool === 'pencil' || sTool === 'eraser') {
              return (
                <Line
                  key={id}
                  id={id}
                  {...shapeProps}
                  name={id}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.5}
                  draggable={isDraggable}
                  onClick={() => isDraggable && setSelectedId(id)}
                />
              );
            }
            if (sTool === 'rect') {
              return (
                <Rect
                  key={id}
                  id={id}
                  {...shapeProps}
                  name={id}
                  draggable={isDraggable}
                  onClick={() => isDraggable && setSelectedId(id)}
                />
              );
            }
            if (sTool === 'circle') {
              return (
                <KonvaCircle
                  key={id}
                  id={id}
                  {...shapeProps}
                  name={id}
                  draggable={isDraggable}
                  onClick={() => isDraggable && setSelectedId(id)}
                />
              );
            }
            return null;
          })}
          {isDraggable && selectedNode && <Transformer nodes={[selectedNode]} />}
        </Layer>
      </Stage>
    </div>
  );
}

// ── INTERNAL PRIMITIVES ──────────────────────────────────────────────────────

function ToolBtn({
  icon,
  active,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {icon}
    </button>
  );
}

export default React.memo(WhiteboardInner);
