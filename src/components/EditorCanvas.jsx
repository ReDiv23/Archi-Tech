import React, { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Transformer, Text, Circle, Arrow, Line, Image } from "react-konva";
import { updateProject } from "../services/projectService";
import { createProject } from "../services/projectService";
import { getProjects, getProjectById } from "../services/projectService";
import { useAuth } from "../context/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { getSharedProject } from "../services/projectService";
import { Html } from "react-konva-utils";
import useImage from "use-image";

/* ---------------- HELPERS ---------------- */

const PX_PER_FOOT = 14;
const WALL_THICKNESS_FT = 0.7;
const WALL_THICKNESS_PX = WALL_THICKNESS_FT * PX_PER_FOOT;

const pxToFeetInches = (px) => {
  const totalInches = (px / PX_PER_FOOT) * 12;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}' ${inches}"`;
};

const midpoint = (a, b) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const angleDeg = (a, b) =>
  (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

const getRectCorners = (node) => {
  const w = node.width();
  const h = node.height();
  const t = node.getAbsoluteTransform();

  return [
    t.point({ x: 0, y: 0 }),
    t.point({ x: w, y: 0 }),
    t.point({ x: w, y: h }),
    t.point({ x: 0, y: h }),
  ];
};

const lockWallThickness = (oldBox, newBox) => ({
  ...newBox,
  height: oldBox.height,
  y: oldBox.y,
});

/* ===== SYMBOL IMAGE PATHS ===== */
const base = import.meta.env.BASE_URL; // Vite public base

const SYMBOL_IMAGES = {
  door: base + "icons/door.png",
  doubleDoor: base + "icons/double-door.png",
  slidingDoor: base + "icons/sliding-door.png",
  window: base + "icons/window.png",
  stairs: base + "icons/stairs.png",
  bed: base + "icons/bed.png",
  sofa: base + "icons/sofa.png",
  dining: base + "icons/dining.png",
  stove: base + "icons/stove.png",
  sink: base + "icons/sink.png",
  wc: base + "icons/wc.png",
  bathtub: base + "icons/bathtub.png",
  ac: base + "icons/shaft.png",
  tv: base + "icons/tv.png",
  shaft: base + "icons/shaft.png",
  compass: base + "icons/compass.png",
};

/* ===== SYMBOL DISPLAY NAMES ===== */
const SYMBOL_NAMES = {
  door: "Door",
  doubleDoor: "Double Door",
  slidingDoor: "Sliding Door",
  window: "Window",
  stairs: "Stairs",
  bed: "Bed",
  sofa: "Sofa",
  dining: "Dining Table",
  stove: "Stove",
  sink: "Sink",
  wc: "WC",
  bathtub: "Bathtub",
  ac: "AC Unit",
  tv: "TV",
  shaft: "Shaft",
  compass: "Compass",
};

/* ===== SYMBOL IMAGE COMPONENT ===== */
function SymbolImage({ symbol, onSelect, onDragEnd, onTransformEnd, registerRef, isInDrawingMode }) {
  const [img] = useImage(SYMBOL_IMAGES[symbol.type]);

  return (
    <Image
      ref={registerRef}
      id={symbol.id}
      x={symbol.x}
      y={symbol.y}
      width={symbol.width}
      height={symbol.height}
      rotation={symbol.rotation}
      scaleX={symbol.flipX ? -1 : 1}
      scaleY={symbol.flipY ? -1 : 1}
      offsetX={symbol.flipX ? symbol.width : 0}
      offsetY={symbol.flipY ? symbol.height : 0}
      image={img}
      draggable={!isInDrawingMode}
      onClick={() => !isInDrawingMode && onSelect()}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  );
}

/* ---------------- COMPONENT ---------------- */

export default function EditorCanvas() {

  const [isLoaded, setIsLoaded] = useState(false);

  const stageRef = useRef(null);
  const trRef = useRef(null);
  const rectRefs = useRef({});
  const wallRefs = useRef({});

  const [selectedId, setSelectedId] = useState(null);

  /* -------- RECTANGLES -------- */
  const [objects, setObjects] = useState([]);

  /* -------- WALLS -------- */
  const [walls, setWalls] = useState([]);

  /* ===== AutoSave ===== */
  const hasUserEdited = useRef(false);

  const hasHydratedFromDB = useRef(false);

  const skipFirstAutosave = useRef(true);

  const autosaveTimer = useRef(null);

  const { currentUser } = useAuth();
  const params = useParams();
  const id = params.id || null;
  const shareId = params.shareId || null;     // projectId from URL

  const navigate = useNavigate();

  const isViewOnly = window.location.pathname.includes("/view/");

  const isReadOnly = isViewOnly;

  const edit = (fn) => {
    if (isReadOnly) return;
    hasUserEdited.current = true;
    fn();
  };
  /* ===== AutoSave ===== */

  const [drawingWall, setDrawingWall] = useState(null);
  const [mode, setMode] = useState("select");

  const [liveWallLength, setLiveWallLength] = useState(null);

  /* ===== UNDO/REDO STATE ===== */
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);

  /* -------- WALL INPUT STATE -------- */
  const [wallInputs, setWallInputs] = useState({
    lengthFt: "",
    angleDeg: "",
  });

  const [isEditingWallInput, setIsEditingWallInput] = useState(false);

  const [copiedWall, setCopiedWall] = useState(null);
  const [copiedShape, setCopiedShape] = useState(null);
  const [copiedSymbol, setCopiedSymbol] = useState(null);

  /* ===== SIDEBAR STATE ===== */
  const [sidebarTab, setSidebarTab] = useState("shapes"); // "shapes" | "icons"
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

  /* ===== SHAPES STATE ===== */
  const [shapeMode, setShapeMode] = useState(null);
  const [shapes, setShapes] = useState([]);
  const [drawingShape, setDrawingShape] = useState(null);
  const shapeRefs = useRef({});

  /* ===== SYMBOLS STATE ===== */
  const [symbols, setSymbols] = useState([]);
  const [activeSymbolType, setActiveSymbolType] = useState(null);
  const symbolRefs = useRef({});

  /* ===== TEXTBOX STATE ===== */
  const [textboxes, setTextboxes] = useState([]);
  const [editingTextboxId, setEditingTextboxId] = useState(null);
  const textboxRefs = useRef({});

  /* ===== BUTTON ANIMATION STATE ===== */
  const [animatingButton, setAnimatingButton] = useState(null);

  /* ===== Import/Export ===== */
    const handleExportProject = () => {
    const data = {
      objects,
      walls,
      shapes,
      symbols,
      textboxes,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-project.ArchiTech";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const data = JSON.parse(e.target.result);

      edit(() => {
        setObjects(data.objects || []);
        setWalls(data.walls || []);
        setShapes(data.shapes || []);
        setSymbols(data.symbols || []);
        setTextboxes(data.textboxes || []);
      });

      saveToHistory(
        data.objects || [],
        data.walls || [],
        data.shapes || [],
        data.symbols || [],
        data.textboxes || []
      );
    };

    reader.readAsText(file);
  };

  /* ===== UNDO/REDO FUNCTIONS ===== */
  const saveToHistory = React.useCallback((newObjects, newWalls, newShapes, newSymbols, newTextboxes) => {
    const newState = {
      objects: JSON.parse(JSON.stringify(newObjects)),
      walls: JSON.parse(JSON.stringify(newWalls)),
      shapes: JSON.parse(JSON.stringify(newShapes)),
      symbols: JSON.parse(JSON.stringify(newSymbols)),
      textboxes: JSON.parse(JSON.stringify(newTextboxes)),
    };

    setHistory((prevHistory) => {
      const currentIndex = historyIndexRef.current;
      const newHistory = [...prevHistory.slice(0, currentIndex + 1), newState];
     
      if (newHistory.length > 50) {
        historyIndexRef.current = currentIndex;
        setHistoryIndex(currentIndex);
        return newHistory.slice(1);
      } else {
        historyIndexRef.current = currentIndex + 1;
        setHistoryIndex(currentIndex + 1);
        return newHistory;
      }
    });
  }, []);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
     
      setObjects(JSON.parse(JSON.stringify(state.objects)));
      setWalls(JSON.parse(JSON.stringify(state.walls)));
      setShapes(JSON.parse(JSON.stringify(state.shapes)));
      setSymbols(JSON.parse(JSON.stringify(state.symbols)));
      setTextboxes(JSON.parse(JSON.stringify(state.textboxes || [])));
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      setSelectedId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
     
      setObjects(JSON.parse(JSON.stringify(state.objects)));
      setWalls(JSON.parse(JSON.stringify(state.walls)));
      setShapes(JSON.parse(JSON.stringify(state.shapes)));
      setSymbols(JSON.parse(JSON.stringify(state.symbols)));
      setTextboxes(JSON.parse(JSON.stringify(state.textboxes || [])));
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      setSelectedId(null);
    }
  };

  /* ===== CLEAR CANVAS FUNCTION ===== */
  const handleClearCanvas = () => {

    if (window.confirm("Are you sure you want to clear the entire canvas? This cannot be undone.")) {

      /* ===== Autosave ===== */
      hasUserEdited.current = true;
      /* ===== Autosave ===== */

      setObjects([]);
      setWalls([]);
      setShapes([]);
      setSymbols([]);
      setTextboxes([]);
      setSelectedId(null);
      rectRefs.current = {};
      wallRefs.current = {};
      shapeRefs.current = {};
      symbolRefs.current = {};
      textboxRefs.current = {};
      saveToHistory([], [], [], [], []);
    }
  };

  /* ===== FLIP FUNCTIONS ===== */
  const handleFlipHorizontal = () => {
    const symbol = symbols.find((s) => s.id === selectedId);
    if (!symbol) return;

    const newSymbols = symbols.map((s) =>
      s.id === selectedId
        ? { ...s, flipX: !s.flipX }
        : s
    );
    edit(() => setSymbols(newSymbols));
    saveToHistory(objects, walls, shapes, newSymbols, textboxes);
  };

  const handleFlipVertical = () => {
    const symbol = symbols.find((s) => s.id === selectedId);
    if (!symbol) return;

    const newSymbols = symbols.map((s) =>
      s.id === selectedId
        ? { ...s, flipY: !s.flipY }
        : s
    );
    edit(() => setSymbols(newSymbols));
    saveToHistory(objects, walls, shapes, newSymbols, textboxes);
  };

  /* ===== Autosave ===== */
  useEffect(() => {
    async function load() {
      if (!id && !shareId) return;

      let data = null;

      if (shareId) {
        data = await getSharedProject(shareId);
      } else if (id && currentUser) {
        data = await getProjectById(currentUser.uid, id);
      }

      if (!data) return;

      setObjects(data.objects || []);
      setWalls(data.walls || []);
      setShapes(data.shapes || []);
      setSymbols(data.symbols || []);
      setTextboxes(data.textboxes || []);
      setIsLoaded(true);
    }

    load();
  }, [currentUser, id, shareId]);

  useEffect(() => {
    if (!isLoaded) return;

    // this runs AFTER React applied setObjects/setWalls/setShapes
    hasHydratedFromDB.current = true;
  }, [isLoaded]);
  /* ===== Autosave ===== */

  /* ===== BUTTON CLICK ANIMATION ===== */
  const handleButtonClick = (callback, buttonId) => {
    setAnimatingButton(buttonId);
    setTimeout(() => setAnimatingButton(null), 200);
    callback();
  };

  /* ===== CHECK IF IN DRAWING MODE ===== */
  const isInDrawingMode = mode === "wall" || shapeMode !== null || mode === "symbol" || mode === "textbox";

  /* -------- TRANSFORMER ATTACH -------- */
  useEffect(() => {

    /* ===== Autosave ===== */
    if (!trRef.current) return;
    /* ===== Autosave ===== */

    if (!selectedId || isInDrawingMode) {
      trRef.current.nodes([]);
      return;
    }

    const node =
      rectRefs.current[selectedId] || wallRefs.current[selectedId] || shapeRefs.current[selectedId] || symbolRefs.current[selectedId] || textboxRefs.current[selectedId];

    if (node /* ===== Autosave ===== */&& trRef.current/* ===== Autosave ===== */) {
      trRef.current.nodes([node]);
      trRef.current.getLayer().batchDraw();
    }

    /* Sync inputs ONLY when not editing */
    const wall = walls.find((w) => w.id === selectedId);
    if (wall && !isEditingWallInput) {
      setWallInputs({
        lengthFt: String(wall.length / PX_PER_FOOT),
        angleDeg: String(wall.rotation),
      });
    }
  }, [selectedId, objects, walls, shapes, symbols, textboxes, isEditingWallInput, mode, shapeMode, activeSymbolType]);

  /* -------- INITIALIZE HISTORY -------- */
  useEffect(() => {
    if (history.length === 0) {
      const initialState = {
        objects: JSON.parse(JSON.stringify(objects)),
        walls: JSON.parse(JSON.stringify(walls)),
        shapes: JSON.parse(JSON.stringify(shapes)),
        symbols: JSON.parse(JSON.stringify(symbols)),
        textboxes: JSON.parse(JSON.stringify(textboxes)),
      };
      setHistory([initialState]);
      setHistoryIndex(0);
      historyIndexRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- DELETE WALL WITH KEYBOARD -------- */
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      /* DELETE WALL */
      if (e.key === "Delete" || e.key === "Backspace") {
        if (wallRefs.current[selectedId]) {

          /* ===== Autosave ===== */
          hasUserEdited.current = true;
          /* ===== Autosave ===== */

          const newWalls = walls.filter((w) => w.id !== selectedId);
          setWalls(newWalls);
          delete wallRefs.current[selectedId];
          setSelectedId(null);
          saveToHistory(objects, newWalls, shapes, symbols, textboxes);
        }
        if (shapeRefs.current[selectedId]) {

          /* ===== Autosave ===== */
          hasUserEdited.current = true;
          /* ===== Autosave ===== */

          const newShapes = shapes.filter((s) => s.id !== selectedId);
          setShapes(newShapes);
          delete shapeRefs.current[selectedId];
          setSelectedId(null);
          saveToHistory(objects, walls, newShapes, symbols, textboxes);
        }
        if (symbolRefs.current[selectedId]) {

          /* ===== Autosave ===== */
          hasUserEdited.current = true;
          /* ===== Autosave ===== */

          const newSymbols = symbols.filter((s) => s.id !== selectedId);
          setSymbols(newSymbols);
          delete symbolRefs.current[selectedId];
          setSelectedId(null);
          saveToHistory(objects, walls, shapes, newSymbols, textboxes);
        }
        if (textboxRefs.current[selectedId]) {

          /* ===== Autosave ===== */
          hasUserEdited.current = true;
          /* ===== Autosave ===== */

          const newTextboxes = textboxes.filter((t) => t.id !== selectedId);
          setTextboxes(newTextboxes);
          delete textboxRefs.current[selectedId];
          setSelectedId(null);
          setEditingTextboxId(null);
          saveToHistory(objects, walls, shapes, symbols, newTextboxes);
        }
        return;
      }

      /* COPY WALL */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const wall = walls.find((w) => w.id === selectedId);
        if (wall) {
          setCopiedWall({ ...wall });
        }
        const shape = shapes.find((s) => s.id === selectedId);
        if (shape) {
          setCopiedShape({ ...shape });
        }
        const symbol = symbols.find((s) => s.id === selectedId);
        if (symbol) {
          setCopiedSymbol({ ...symbol });
        }
        return;
      }

      /* PASTE WALL */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (copiedWall) {
          const offset = 30; // pixels

          const newWall = {
            ...copiedWall,
            id: Date.now().toString(),
            x: copiedWall.x + offset,
            y: copiedWall.y + offset,
          };

          /* ===== Autosave ===== */
          hasUserEdited.current = true;
          /* ===== Autosave ===== */

          const newWalls = [...walls, newWall];
          setWalls(newWalls);
          setSelectedId(newWall.id);
          saveToHistory(objects, newWalls, shapes, symbols, textboxes);
        }
        if (copiedShape) {
          const offset = 30; // pixels
         
          const newShape = {

            ...copiedShape,
            id: Date.now().toString(),
            x: copiedShape.x + offset,
            y: copiedShape.y + offset,
          };

          /* ===== Autosave ===== */
          hasUserEdited.current = true;
          /* ===== Autosave ===== */

          const newShapes = [...shapes, newShape];
          setShapes(newShapes);
          setSelectedId(newShape.id);
          saveToHistory(objects, walls, newShapes, symbols, textboxes);
        }
        if (copiedShape) {
          const offset = 30;
          const newShape = {
            ...copiedShape,
            id: Date.now().toString(),
            x: copiedShape.x + offset,
            y: copiedShape.y + offset,
          };

          /* ===== Autosave ===== */
          hasUserEdited.current = true;
          /* ===== Autosave ===== */

          const newShapes = [...shapes, newShape];
          setShapes(newShapes);
          setSelectedId(newShape.id);
          saveToHistory(objects, walls, newShapes, symbols, textboxes);
        }
        if (copiedSymbol) {
          const offset = 30;
          const newSymbol = {
            ...copiedSymbol,
            id: Date.now().toString(),
            x: copiedSymbol.x + offset,
            y: copiedSymbol.y + offset,
          };

          /* ===== Autosave ===== */
          hasUserEdited.current = true;
          /* ===== Autosave ===== */

          const newSymbols = [...symbols, newSymbol];
          setSymbols(newSymbols);
          setSelectedId(newSymbol.id);
          saveToHistory(objects, walls, shapes, newSymbols, textboxes);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, walls, copiedWall, shapes, copiedShape, symbols, copiedSymbol, textboxes, objects, history, historyIndex]);

  /* ===== DETERMINE CURSOR STYLE ===== */
  const cursorStyle = isInDrawingMode ? "crosshair" : "default";

  /* ===== Autosave ===== */
  useEffect(() => {

    if (isViewOnly) return;

    if (!currentUser || !id) return;

    const t = setTimeout(() => {
      updateProject(currentUser.uid, id, {
        objects,
        walls,
        shapes,
        symbols,
        textboxes,
      });
    }, 1000);

    return () => clearTimeout(t);
  }, [objects, walls, shapes, symbols, textboxes, currentUser, id]);

  if (!isLoaded) {
    return <div style={{ padding: 40 }}>Loading project...</div>;
  }
  /* ===== Autosave ===== */

return (
    <>
      {/* ADD ANIMATION KEYFRAMES */}
      <style>
        {`
          @keyframes buttonPulse {
            0% { transform: scale(1); }
            50% { transform: scale(0.95); }
            100% { transform: scale(1); }
          }
          .button-animate {
            animation: buttonPulse 0.2s ease-in-out;
          }
        `}
      </style>

      {/* HORIZONTAL TOP TOOLBAR */}
      {!isReadOnly && (
        <div
            style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            background: "#fff",
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: "10px",
            zIndex: 100,
            }}
        >
            {/* LEFT SECTION - SELECT AND WALL */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
                onClick={() => handleButtonClick(() => {
                setMode("select");
                setShapeMode(null);
                setActiveSymbolType(null);
                }, "select")}
                className={animatingButton === "select" ? "button-animate" : ""}
                style={{
                background: mode === "select" && shapeMode === null && activeSymbolType === null ? "skyblue" : "white",
                fontWeight: mode === "select" && shapeMode === null && activeSymbolType === null ? "bold" : "normal",
                padding: "8px 16px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
                }}
            >
                Select/Edit
            </button>
           
            <button
                onClick={() => handleButtonClick(() => {
                setMode("wall");
                setShapeMode(null);
                setActiveSymbolType(null);
                }, "wall")}
                className={animatingButton === "wall" ? "button-animate" : ""}
                style={{
                background: mode === "wall" ? "skyblue" : "white",
                fontWeight: mode === "wall" ? "bold" : "normal",
                padding: "8px 16px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
                }}
            >
                Insert Wall
            </button>
            </div>

            {/* CENTER SECTION - UNDO, REDO, TEXT BOX */}
            <div style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "10px",
            alignItems: "center"
            }}>
            {/* UNDO BUTTON */}
            <button
                onClick={() => handleButtonClick(handleUndo, "undo")}
                disabled={historyIndex <= 0}
                className={animatingButton === "undo" ? "button-animate" : ""}
                style={{
                padding: "8px 16px",
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: historyIndex > 0 ? "pointer" : "not-allowed",
                opacity: historyIndex > 0 ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                }}
                title="Undo (Ctrl+Z)"
            >
                <span>↶</span> Undo
            </button>

            {/* REDO BUTTON */}
            <button
                onClick={() => handleButtonClick(handleRedo, "redo")}
                disabled={historyIndex >= history.length - 1}
                className={animatingButton === "redo" ? "button-animate" : ""}
                style={{
                padding: "8px 16px",
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: historyIndex < history.length - 1 ? "pointer" : "not-allowed",
                opacity: historyIndex < history.length - 1 ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                }}
                title="Redo (Ctrl+Y)"
            >
                <span>↷</span> Redo
            </button>

            {/* TEXT BOX BUTTON */}
            <button
                onClick={() => handleButtonClick(() => {
                setMode("textbox");
                setShapeMode(null);
                setActiveSymbolType(null);
                }, "textbox")}
                className={animatingButton === "textbox" ? "button-animate" : ""}
                style={{
                padding: "8px 16px",
                background: mode === "textbox" ? "skyblue" : "white",
                fontWeight: mode === "textbox" ? "bold" : "normal",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                }}
                title="Add Text Box"
            >
                <span>💬</span> Text
            </button>
            </div>

            {/* RIGHT SECTION - EXPORT / IMPORT / CLEAR */}
            <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>

            <button onClick={handleExportProject} className = "bg-black cursor-pointer text-white p-2 rounded">
              Export
            </button>

            <label className = "bg-green-500 cursor-pointer text-white p-2 rounded" >
              Import
              <input
                type="file"
                accept=".ArchiTech,application/json"
                style={{ display: "none" }}
                onChange={handleImportProject}
              />
            </label>

            <button
              onClick={() => handleButtonClick(handleClearCanvas, "clear")}
              style={{
                padding: "8px 16px",
                background: "#ff4444",
                color: "white",
                border: "1px solid #cc0000",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Clear Canvas
            </button>

          </div>
        </div>
      )}

      {/* VERTICAL LEFT SIDEBAR */}
      <div
        style={{
          position: "fixed",
          top: 60,
          left: 0,
          width: sidebarMinimized ? 40 : 250,
          height: "calc(100vh - 60px)",
          background: "#f5f5f5",
          borderRight: "1px solid #ddd",
          zIndex: 99,
          transition: "width 0.3s ease",
          overflow: "visible",
        }}
      >
        {/* MINIMIZE BUTTON - POPPING OUT */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: sidebarMinimized ? -20 : -20,
            transform: "translateY(-50%)",
            cursor: "pointer",
            zIndex: 101,
            width: 32,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "0 8px 8px 0",
            background: "#fff",
            border: "1px solid #ddd",
            borderLeft: "none",
            boxShadow: "2px 0 4px rgba(0,0,0,0.1)",
            transition: "all 0.2s",
          }}
          onClick={() => handleButtonClick(() => setSidebarMinimized(!sidebarMinimized), "minimize")}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f0f0f0";
            e.currentTarget.style.boxShadow = "3px 0 6px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.boxShadow = "2px 0 4px rgba(0,0,0,0.1)";
          }}
          className={animatingButton === "minimize" ? "button-animate" : ""}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#666"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {sidebarMinimized ? (
              <polyline points="6,4 10,8 6,12" />
            ) : (
              <polyline points="10,4 6,8 10,12" />
            )}
          </svg>
        </div>

        {!sidebarMinimized && (
          <>
            {/* SIDEBAR TABS */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #ddd",
                marginTop: 0,
              }}
            >
              <button
                onClick={() => handleButtonClick(() => setSidebarTab("shapes"), "tab-shapes")}
                className={animatingButton === "tab-shapes" ? "button-animate" : ""}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: sidebarTab === "shapes" ? "#fff" : "#f5f5f5",
                  border: "none",
                  borderBottom: sidebarTab === "shapes" ? "2px solid skyblue" : "none",
                  fontWeight: sidebarTab === "shapes" ? "bold" : "normal",
                  cursor: "pointer",
                }}
              >
                Shapes
              </button>
              <button
                onClick={() => handleButtonClick(() => setSidebarTab("icons"), "tab-icons")}
                className={animatingButton === "tab-icons" ? "button-animate" : ""}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: sidebarTab === "icons" ? "#fff" : "#f5f5f5",
                  border: "none",
                  borderBottom: sidebarTab === "icons" ? "2px solid skyblue" : "none",
                  fontWeight: sidebarTab === "icons" ? "bold" : "normal",
                  cursor: "pointer",
                }}
              >
                Icons
              </button>
            </div>

            {/* SIDEBAR CONTENT */}
            <div style={{ padding: "15px", maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
              {sidebarTab === "shapes" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                  }}
                >
                  <button
                    onClick={() => handleButtonClick(() => {
                      setShapeMode("rect");
                      setActiveSymbolType(null);
                    }, "shape-rect")}
                    className={animatingButton === "shape-rect" ? "button-animate" : ""}
                    style={{
                      padding: "20px",
                      background: shapeMode === "rect" ? "skyblue" : "#e0e0e0",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: shapeMode === "rect" ? "bold" : "normal",
                    }}
                  >
                    Rect
                  </button>
                  <button
                    onClick={() => handleButtonClick(() => {
                      setShapeMode("circle");
                      setActiveSymbolType(null);
                    }, "shape-circle")}
                    className={animatingButton === "shape-circle" ? "button-animate" : ""}
                    style={{
                      padding: "20px",
                      background: shapeMode === "circle" ? "skyblue" : "#e0e0e0",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: shapeMode === "circle" ? "bold" : "normal",
                    }}
                  >
                    Circle
                  </button>
                  <button
                    onClick={() => handleButtonClick(() => {
                      setShapeMode("triangle");
                      setActiveSymbolType(null);
                    }, "shape-triangle")}
                    className={animatingButton === "shape-triangle" ? "button-animate" : ""}
                    style={{
                      padding: "20px",
                      background: shapeMode === "triangle" ? "skyblue" : "#e0e0e0",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: shapeMode === "triangle" ? "bold" : "normal",
                    }}
                  >
                    Triangle
                  </button>
                  <button
                    onClick={() => handleButtonClick(() => {
                      setShapeMode("arrow");
                      setActiveSymbolType(null);
                    }, "shape-arrow")}
                    className={animatingButton === "shape-arrow" ? "button-animate" : ""}
                    style={{
                      padding: "20px",
                      background: shapeMode === "arrow" ? "skyblue" : "#e0e0e0",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: shapeMode === "arrow" ? "bold" : "normal",
                    }}
                  >
                    Arrow
                  </button>
                </div>
              )}

              {sidebarTab === "icons" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                  }}
                >
                  {Object.keys(SYMBOL_NAMES).map((symbolType) => (
                    <button
                      key={symbolType}
                      onClick={() => handleButtonClick(() => {
                        setMode("symbol");
                        setActiveSymbolType(symbolType);
                        setShapeMode(null);
                      }, `symbol-${symbolType}`)}
                      className={animatingButton === `symbol-${symbolType}` ? "button-animate" : ""}
                      style={{
                        padding: "12px 8px",
                        background: mode === "symbol" && activeSymbolType === symbolType ? "skyblue" : "#e0e0e0",
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: mode === "symbol" && activeSymbolType === symbolType ? "bold" : "normal",
                        fontSize: "11px",
                        textAlign: "center",
                        minHeight: "50px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {SYMBOL_NAMES[symbolType]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* WALL PROPERTY PANEL */}
      {wallRefs.current[selectedId] && !isInDrawingMode && (
        <div
          style={{
            position: "fixed",
            top: 70,
            right: 10,
            background: "#fff",
            padding: 10,
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 10,
            width: 220,
          }}
        >
          <strong>Wall Properties</strong>

          <div>
            Length (ft)
            <input
              type="text"
              inputMode="decimal"
              value={wallInputs.lengthFt}
              onFocus={() => setIsEditingWallInput(true)}
              onChange={(e) => {
                const raw = e.target.value;
                setWallInputs((p) => ({ ...p, lengthFt: raw }));

                const parsed = parseFloat(raw);
                if (!isNaN(parsed) && parsed > 0) {
                  const newWalls = walls.map((w) =>
                    w.id === selectedId
                      ? { ...w, length: parsed * PX_PER_FOOT }
                      : w
                  );
                  edit(() => {
                    setWalls(newWalls);
                  });
                }
              }}
              onBlur={() => {
                setIsEditingWallInput(false);
                saveToHistory(objects, walls, shapes, symbols, textboxes);
              }}
            />
          </div>

          <div>
            Angle (deg)
            <input
              type="text"
              inputMode="decimal"
              value={wallInputs.angleDeg}
              onFocus={() => setIsEditingWallInput(true)}
              onChange={(e) => {
                const raw = e.target.value;
                setWallInputs((p) => ({ ...p, angleDeg: raw }));

                const parsed = parseFloat(raw);
                if (!isNaN(parsed)) {
                  const newWalls = walls.map((w) =>
                    w.id === selectedId
                      ? { ...w, rotation: parsed }
                      : w
                  );
                  edit(() => {
                    setWalls(newWalls);
                  });
                }
              }}
              onBlur={() => {
                setIsEditingWallInput(false);
                saveToHistory(objects, walls, shapes, symbols, textboxes);
              }}
            />
          </div>
        </div>
      )}

      {/* SYMBOL/ICON FLIP PANEL */}
      {symbolRefs.current[selectedId] && !isInDrawingMode && (
        <div
          style={{
            position: "fixed",
            top: 70,
            right: 10,
            background: "#fff",
            padding: 10,
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 10,
            width: 220,
          }}
        >
          <strong>Icon Controls</strong>
          
          <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexDirection: "column" }}>
            <button
              onClick={() => handleButtonClick(handleFlipHorizontal, "flip-h")}
              className={animatingButton === "flip-h" ? "button-animate" : ""}
              style={{
                padding: "8px 12px",
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              ↔️ Flip Horizontal
            </button>
            
            <button
              onClick={() => handleButtonClick(handleFlipVertical, "flip-v")}
              className={animatingButton === "flip-v" ? "button-animate" : ""}
              style={{
                padding: "8px 12px",
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              ↕️ Flip Vertical
            </button>
          </div>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          background: "#eee",
          marginTop: 60,
          marginLeft: sidebarMinimized ? 40 : 200,
          cursor: cursorStyle,
          transition: "margin-left 0.3s ease",
        }}
        onMouseDown={(e) => {

            if (isReadOnly) return;

          const stage = e.target.getStage();
          const pos = stage.getPointerPosition();

          if (mode === "textbox") {
            const id = Date.now().toString();
            const newTextbox = {
              id,
              x: pos.x,
              y: pos.y,
              width: 200,
              height: 40,
              text: "Double Click to Edit",
              fontSize: 16,
              rotation: 0,
            };
            const newTextboxes = [...textboxes, newTextbox];
            edit(() => setTextboxes(newTextboxes));
            setSelectedId(id);
            setEditingTextboxId(id);
            setMode("select");
            saveToHistory(objects, walls, shapes, symbols, newTextboxes);
            return;
          }

          if (mode === "symbol" && activeSymbolType) {
            const id = Date.now().toString();
            const newSymbol = {
              id,
              type: activeSymbolType,
              x: pos.x - 25,
              y: pos.y - 25,
              width: 50,
              height: 50,
              rotation: 0,
              flipX: false,
              flipY: false,
            };
            const newSymbols = [...symbols, newSymbol];
            edit(() => setSymbols(newSymbols));
            setSelectedId(id);
            setMode("select");
            setActiveSymbolType(null);
            saveToHistory(objects, walls, shapes, newSymbols, textboxes);
            return;
          }

          if (shapeMode) {
            const id = Date.now().toString();
            setDrawingShape({
              id,
              type: shapeMode,
              x1: pos.x,
              y1: pos.y,
              x2: pos.x,
              y2: pos.y,
              rotation: 0,
            });
            return;
          }

          if (mode === "wall") {
            const id = Date.now().toString();
            setDrawingWall({
              id,
              x1: pos.x,
              y1: pos.y,
              x2: pos.x,
              y2: pos.y,
              thickness: WALL_THICKNESS_PX,
            });
            setLiveWallLength({ id, length: 0 });
            return;
          }

          if (e.target === stage) setSelectedId(null);
        }}
        onMouseMove={(e) => {

            if (isReadOnly) return;

          if (drawingShape) {
            const pos = e.target.getStage().getPointerPosition();
            setDrawingShape((s) => ({ ...s, x2: pos.x, y2: pos.y }));
            return;
          }

          if (drawingWall) {
            const pos = e.target.getStage().getPointerPosition();
            setDrawingWall((w) => ({ ...w, x2: pos.x, y2: pos.y }));
            setLiveWallLength({
              id: drawingWall.id,
              length: Math.hypot(
                pos.x - drawingWall.x1,
                pos.y - drawingWall.y1
              ),
            });
          }
        }}
        onMouseUp={() => {

            if (isReadOnly) return;

          if (drawingShape) {
            const { x1, y1, x2, y2, type } = drawingShape;

            let newShape;
           
            if (type === "arrow") {
              newShape = {
                id: drawingShape.id,
                type,
                x: x1,
                y: y1,
                points: [0, 0, x2 - x1, y2 - y1],
                rotation: 0,
              };
            } else if (type === "triangle") {
              const x = Math.min(x1, x2);
              const y = Math.min(y1, y2);
              const width = Math.abs(x2 - x1);
              const height = Math.abs(y2 - y1);
             
              newShape = {
                id: drawingShape.id,
                type,
                x,
                y,
                width,
                height,
                rotation: 0,
              };
            } else {
              newShape = {
                id: drawingShape.id,
                type,
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1),
                rotation: 0,
              };
            }

            const newShapes = [...shapes, newShape];
            edit(() => setShapes(newShapes));
            setDrawingShape(null);
            setShapeMode(null);
            setMode("select");
            saveToHistory(objects, walls, newShapes, symbols, textboxes);
            return;
          }

          if (drawingWall) {
            const dx = drawingWall.x2 - drawingWall.x1;
            const dy = drawingWall.y2 - drawingWall.y1;

            const length = Math.hypot(dx, dy);
            const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;

            // FIX: Store the actual starting point (x1, y1) as the position
            const newWalls = [
              ...walls,
              {
                id: drawingWall.id,
                x: drawingWall.x1,
                y: drawingWall.y1,
                length,
                rotation,
                thickness: WALL_THICKNESS_PX,
              },
            ];

            edit(() => {
                setWalls(newWalls);
                setDrawingWall(null);
                setLiveWallLength(null);
                setMode("select");
                saveToHistory(objects, newWalls, shapes, symbols, textboxes);
            });
          }
        }}
      >
        <Layer>
          {/* WALL PREVIEW */}
          {drawingWall && (() => {
            const dx = drawingWall.x2 - drawingWall.x1;
            const dy = drawingWall.y2 - drawingWall.y1;
            const length = Math.hypot(dx, dy);
            const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;

            const mid = {
              x: (drawingWall.x1 + drawingWall.x2) / 2,
              y: (drawingWall.y1 + drawingWall.y2) / 2,
            };

            return (
              <>
                <Rect
                  x={drawingWall.x1}
                  y={drawingWall.y1 - drawingWall.thickness / 2}
                  width={length}
                  height={drawingWall.thickness}
                  rotation={rotation}
                  fill="red"
                  opacity={0.4}
                />

                {liveWallLength && (
                  <Text
                    text={pxToFeetInches(liveWallLength.length)}
                    x={mid.x}
                    y={mid.y}
                    rotation={rotation}
                    offsetX={40}
                    offsetY={-10}
                    fontSize={14}
                    fill="red"
                  />
                )}
              </>
            );
          })()}

          {/* WALLS */}
          {walls.map((w) => {
            const node = wallRefs.current[w.id];
            let mid, angle;

            if (node) {
              const [tl, tr] = getRectCorners(node);
              mid = midpoint(tl, tr);
              angle = angleDeg(tl, tr);
            }

            return (
              <React.Fragment key={w.id}>
                <Rect
                  ref={(n) => (wallRefs.current[w.id] = n)}
                  id={w.id}
                  x={w.x}
                  y={w.y - w.thickness / 2}
                  width={w.length}
                  height={w.thickness}
                  rotation={w.rotation}
                  fill="#444"
                  draggable={!isInDrawingMode && !isReadOnly}
                  onClick={() => !isInDrawingMode && setSelectedId(w.id)}
                  onDragMove={(e) => {
                    if (isInDrawingMode) return;
                    const n = e.target;
                    setWalls((prev) =>
                      prev.map((wall) =>
                        wall.id === w.id
                          ? {
                              ...wall,
                              x: n.x(),
                              y: n.y() + wall.thickness / 2,
                            }
                          : wall
                      )
                    );
                  }}
                  onDragEnd={(e) => {
                    if (isInDrawingMode) return;
                    const n = e.target;
                    const newWalls = walls.map((wall) =>
                      wall.id === w.id
                        ? {
                            ...wall,
                            x: n.x(),
                            y: n.y() + wall.thickness / 2,
                          }
                        : wall
                    );
                    edit(() => {
                        setWalls(newWalls);
                        saveToHistory(objects, newWalls, shapes, symbols, textboxes);
                    });
                  }}
                  onTransform={(e) => {
                    if (isInDrawingMode) return;
                    const n = e.target;
                    setLiveWallLength({
                      id: w.id,
                      length: n.width() * n.scaleX(),
                    });
                  }}
                  onTransformEnd={(e) => {
                    if (isInDrawingMode) return;
                    const n = e.target;
                    const newLength = n.width() * n.scaleX();

                    n.scaleX(1);
                    n.scaleY(1);

                    const newWalls = walls.map((wall) =>
                      wall.id === w.id
                        ? {
                            ...wall,
                            x: n.x(),
                            y: n.y() + wall.thickness / 2,
                            length: newLength,
                            rotation: n.rotation(),
                          }
                        : wall
                    );

                    edit(() => {
                        setWalls(newWalls);
                        setLiveWallLength(null);
                        saveToHistory(objects, newWalls, shapes, symbols, textboxes);
                    });
                  }}
                />

                {node && (
                  <Text
                    text={pxToFeetInches(
                      liveWallLength?.id === w.id
                        ? liveWallLength.length
                        : w.length
                    )}
                    x={mid.x}
                    y={mid.y}
                    rotation={angle}
                    offsetX={40}
                    offsetY={-10}
                    fontSize={14}
                    fill="black"
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* RECTANGLES */}
          {objects.map((obj) => {
            const node = rectRefs.current[obj.id];
            let topMid, leftMid, topAngle, leftAngle;

            if (node) {
              const [tl, tr, , bl] = getRectCorners(node);
              topMid = midpoint(tl, tr);
              leftMid = midpoint(tl, bl);
              topAngle = angleDeg(tl, tr);
              leftAngle = angleDeg(tl, bl);
            }

            return (
              <React.Fragment key={obj.id}>
                <Rect
                  ref={(n) => (rectRefs.current[obj.id] = n)}
                  id={obj.id}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  rotation={obj.rotation}
                  fill="lightblue"
                  stroke="dodgerblue"
                  strokeWidth={1.5}
                  draggable={!isInDrawingMode  && !isReadOnly}
                  onClick={() => !isInDrawingMode && setSelectedId(obj.id)}
                  onTap={() => !isInDrawingMode && setSelectedId(obj.id)}
                  onDragEnd={(e) => {
                    if (isInDrawingMode) return;
                    const newObjects = objects.map((o) =>
                      o.id === obj.id
                        ? { ...o, x: e.target.x(), y: e.target.y() }
                        : o
                    );
                    setObjects(newObjects);
                    saveToHistory(newObjects, walls, shapes, symbols, textboxes);
                  }}
                  onTransformEnd={(e) => {
                    if (isInDrawingMode) return;
                    const n = e.target;
                    const newWidth = n.width() * n.scaleX();
                    const newHeight = n.height() * n.scaleY();

                    n.scaleX(1);
                    n.scaleY(1);

                    const newObjects = objects.map((o) =>
                      o.id === obj.id
                        ? {
                            ...o,
                            x: n.x(),
                            y: n.y(),
                            width: newWidth,
                            height: newHeight,
                            rotation: n.rotation(),
                          }
                        : o
                    );
                    setObjects(newObjects);
                    saveToHistory(newObjects, walls, shapes, symbols, textboxes);
                  }}
                />

                {node && (
                  <>
                    <Text
                      text={pxToFeetInches(obj.width)}
                      x={topMid.x}
                      y={topMid.y}
                      rotation={topAngle}
                      offsetX={40}
                      offsetY={-10}
                      fontSize={16}
                      fill="black"
                    />

                    <Text
                      text={pxToFeetInches(obj.height)}
                      x={leftMid.x}
                      y={leftMid.y}
                      rotation={leftAngle - 90}
                      offsetX={40}
                      offsetY={-10}
                      fontSize={16}
                      fill="black"
                    />
                  </>
                )}
              </React.Fragment>
            );
          })}

          {/* SHAPE DRAW PREVIEW */}
          {drawingShape && (() => {
            const { x1, y1, x2, y2, type } = drawingShape;
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const w = Math.abs(x2 - x1);
            const h = Math.abs(y2 - y1);

            if (type === "rect") {
              return (
                <Rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  stroke="black"
                  dash={[6, 4]}
                  fill="transparent"
                />
              );
            }

            if (type === "circle") {
              return (
                <Circle
                  x={x + w / 2}
                  y={y + h / 2}
                  radius={Math.min(w, h) / 2}
                  stroke="black"
                  dash={[6, 4]}
                  fill="transparent"
                />
              );
            }

            if (type === "triangle") {
              const points = [
                x + w / 2, y,
                x, y + h,
                x + w, y + h
              ];
             
              return (
                <Line
                  points={points}
                  stroke="black"
                  dash={[6, 4]}
                  fill="transparent"
                  closed={true}
                />
              );
            }

            if (type === "arrow") {
              return (
                <Arrow
                  x={x1}
                  y={y1}
                  points={[0, 0, x2 - x1, y2 - y1]}
                  stroke="black"
                  fill="black"
                  dash={[6, 4]}
                  pointerLength={10}
                  pointerWidth={10}
                />
              );
            }

            return null;
          })()}

          {/* FREE DRAW SHAPES */}
          {shapes.map((s) => (
            <React.Fragment key={s.id}>
              {s.type === "rect" && (
                <Rect
                  ref={(n) => (shapeRefs.current[s.id] = n)}
                  x={s.x}
                  y={s.y}
                  width={s.width}
                  height={s.height}
                  rotation={s.rotation}
                  stroke="black"
                  fill="transparent"
                  draggable={!isInDrawingMode  && !isReadOnly}
                  onClick={() => !isInDrawingMode && setSelectedId(s.id)}
                  onDragEnd={(e) => {
                    if (isInDrawingMode) return;
                    const newShapes = shapes.map((shape) =>
                      shape.id === s.id
                        ? { ...shape, x: e.target.x(), y: e.target.y() }
                        : shape
                    );
                    edit(() => setShapes(newShapes));
                    saveToHistory(objects, walls, newShapes, symbols, textboxes);
                  }}
                  onTransformEnd={(e) => {
                    if (isInDrawingMode) return;
                    const n = e.target;
                    const newWidth = n.width() * n.scaleX();
                    const newHeight = n.height() * n.scaleY();

                    n.scaleX(1);
                    n.scaleY(1);

                    const newShapes = shapes.map((shape) =>
                      shape.id === s.id
                        ? {
                            ...shape,
                            x: n.x(),
                            y: n.y(),
                            width: newWidth,
                            height: newHeight,
                            rotation: n.rotation(),
                          }
                        : shape
                    );
                    edit(() => setShapes(newShapes));
                    saveToHistory(objects, walls, newShapes, symbols, textboxes);
                  }}
                />
              )}

              {s.type === "circle" && (
                <Circle
                  ref={(n) => (shapeRefs.current[s.id] = n)}
                  x={s.x + s.width / 2}
                  y={s.y + s.height / 2}
                  radius={Math.min(s.width, s.height) / 2}
                  stroke="black"
                  fill="transparent"
                  draggable={!isInDrawingMode  && !isReadOnly}
                  onClick={() => !isInDrawingMode && setSelectedId(s.id)}
                  onDragEnd={(e) => {
                    if (isInDrawingMode) return;
                    const newShapes = shapes.map((shape) =>
                      shape.id === s.id
                        ? {
                            ...shape,
                            x: e.target.x() - shape.width / 2,
                            y: e.target.y() - shape.height / 2
                          }
                        : shape
                    );
                    edit(() => setShapes(newShapes));
                    saveToHistory(objects, walls, newShapes, symbols, textboxes);
                  }}
                />
              )}

              {s.type === "triangle" && (
                <Line
                  ref={(n) => (shapeRefs.current[s.id] = n)}
                  x={s.x}
                  y={s.y}
                  points={[
                    s.width / 2, 0,
                    0, s.height,
                    s.width, s.height
                  ]}
                  stroke="black"
                  fill="transparent"
                  closed={true}
                  draggable={!isInDrawingMode  && !isReadOnly}
                  onClick={() => !isInDrawingMode && setSelectedId(s.id)}
                  onDragEnd={(e) => {
                    if (isInDrawingMode) return;
                    const newShapes = shapes.map((shape) =>
                      shape.id === s.id
                        ? { ...shape, x: e.target.x(), y: e.target.y() }
                        : shape
                    );
                    edit(() => setShapes(newShapes));
                    saveToHistory(objects, walls, newShapes, symbols, textboxes);
                  }}
                  onTransformEnd={(e) => {
                    if (isInDrawingMode) return;
                    const n = e.target;
                    const newWidth = s.width * n.scaleX();
                    const newHeight = s.height * n.scaleY();

                    n.scaleX(1);
                    n.scaleY(1);

                    const newShapes = shapes.map((shape) =>
                      shape.id === s.id
                        ? {
                            ...shape,
                            x: n.x(),
                            y: n.y(),
                            width: newWidth,
                            height: newHeight,
                            rotation: n.rotation(),
                          }
                        : shape
                    );
                    edit(() => setShapes(newShapes));
                    saveToHistory(objects, walls, newShapes, symbols, textboxes);
                  }}
                />
              )}

              {s.type === "arrow" && (
                <Arrow
                  ref={(n) => (shapeRefs.current[s.id] = n)}
                  x={s.x}
                  y={s.y}
                  points={s.points}
                  stroke="black"
                  fill="black"
                  pointerLength={10}
                  pointerWidth={10}
                  draggable={!isInDrawingMode  && !isReadOnly}
                  onClick={() => !isInDrawingMode && setSelectedId(s.id)}
                  onDragEnd={(e) => {
                    if (isInDrawingMode) return;
                    const newShapes = shapes.map((shape) =>
                      shape.id === s.id
                        ? { ...shape, x: e.target.x(), y: e.target.y() }
                        : shape
                    );
                    edit(() => setShapes(newShapes));
                    saveToHistory(objects, walls, newShapes, symbols, textboxes);
                  }}
                />
              )}
            </React.Fragment>
          ))}

          {/* SYMBOLS */}
          {symbols.map((symbol) => (
            <SymbolImage
              key={symbol.id}
              symbol={symbol}
              isInDrawingMode={isInDrawingMode}
              onSelect={() => setSelectedId(symbol.id)}
              registerRef={(n) => (symbolRefs.current[symbol.id] = n)}
              onDragEnd={(e) => {
                if (isInDrawingMode) return;
                const newSymbols = symbols.map((s) =>
                  s.id === symbol.id
                    ? { ...s, x: e.target.x(), y: e.target.y() }
                    : s
                );
                edit(() => setSymbols(newSymbols));
                saveToHistory(objects, walls, shapes, newSymbols, textboxes);
              }}
              onTransformEnd={(e) => {
                if (isInDrawingMode) return;
                const n = e.target;
                const newWidth = n.width() * n.scaleX();
                const newHeight = n.height() * n.scaleY();

                n.scaleX(1);
                n.scaleY(1);

                const newSymbols = symbols.map((s) =>
                  s.id === symbol.id
                    ? {
                        ...s,
                        x: n.x(),
                        y: n.y(),
                        width: newWidth,
                        height: newHeight,
                        rotation: n.rotation(),
                      }
                    : s
                );
                edit(() => setSymbols(newSymbols));
                saveToHistory(objects, walls, shapes, newSymbols, textboxes);
              }}
            />
          ))}

          {/* TEXTBOXES */}
          {textboxes.map((textbox) => (
            <Text
              key={textbox.id}
              ref={(n) => (textboxRefs.current[textbox.id] = n)}
              id={textbox.id}
              x={textbox.x}
              y={textbox.y}
              width={textbox.width}
              text={textbox.text}
              fontSize={textbox.fontSize}
              rotation={textbox.rotation}
              fill="black"
              draggable={!isInDrawingMode && !isReadOnly && editingTextboxId !== textbox.id}
              onClick={() => {
                if (!isInDrawingMode) {
                  setSelectedId(textbox.id);
                  setEditingTextboxId(textbox.id);
                }
              }}
              onDblClick={() => {
                setEditingTextboxId(textbox.id);
                setSelectedId(textbox.id);
              }}
              onDragEnd={(e) => {
                if (isInDrawingMode) return;
                const newTextboxes = textboxes.map((t) =>
                  t.id === textbox.id
                    ? { ...t, x: e.target.x(), y: e.target.y() }
                    : t
                );
                edit(() => setTextboxes(newTextboxes));
                saveToHistory(objects, walls, shapes, symbols, newTextboxes);
              }}
              onTransformEnd={(e) => {
                if (isInDrawingMode) return;
                const n = e.target;
                const newWidth = n.width() * n.scaleX();

                n.scaleX(1);
                n.scaleY(1);

                const newTextboxes = textboxes.map((t) =>
                  t.id === textbox.id
                    ? {
                        ...t,
                        x: n.x(),
                        y: n.y(),
                        width: newWidth,
                        rotation: n.rotation(),
                      }
                    : t
                );
                edit(() => setTextboxes(newTextboxes));
                saveToHistory(objects, walls, shapes, symbols, newTextboxes);
              }}
            />
          ))}

          {/* TEXT EDITING OVERLAY */}
          {editingTextboxId && (() => {
            const textbox = textboxes.find((t) => t.id === editingTextboxId);
            if (!textbox) return null;

            return (
              <Html>
                <textarea
                  autoFocus
                  value={textbox.text}
                  onChange={(e) => {
                    const newTextboxes = textboxes.map((t) =>
                      t.id === editingTextboxId
                        ? { ...t, text: e.target.value }
                        : t
                    );
                    edit(() => setTextboxes(newTextboxes));
                  }}
                  onBlur={() => {
                    setEditingTextboxId(null);
                    saveToHistory(objects, walls, shapes, symbols, textboxes);
                  }}
                  style={{
                    position: "absolute",
                    top: textbox.y,
                    left: textbox.x,
                    width: textbox.width,
                    fontSize: textbox.fontSize,
                    border: "2px solid skyblue",
                    padding: "2px",
                    resize: "none",
                    outline: "none",
                    background: "white",
                    overflow: "hidden",
                  }}
                />
              </Html>
            );
          })()}

          {!isReadOnly && (
            <Transformer
                ref={trRef}
                rotateEnabled
                enabledAnchors={
                wallRefs.current[selectedId]
                    ? ["middle-left", "middle-right"]
                    : [
                        "top-left",
                        "top-center",
                        "top-right",
                        "middle-right",
                        "bottom-right",
                        "bottom-center",
                        "bottom-left",
                        "middle-left"
                    ]
                }
                boundBoxFunc={
                wallRefs.current[selectedId] ? lockWallThickness : undefined
                }
            />
          )}
        </Layer>
      </Stage>
    </>
  );

}
