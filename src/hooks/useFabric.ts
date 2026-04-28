import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, Rect, Circle, IText, Text, Group, Line, FabricImage, Triangle, TPointerEventInfo, PencilBrush } from 'fabric';

export type ToolType = 'select' | 'rectangle' | 'arrow' | 'text' | 'step' | 'blur' | 'pen';

export const useFabric = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<Canvas | null>(null);
  
  const stateRef = useRef({
    activeTool: 'select' as ToolType,
    color: '#ff0000',
    strokeWidth: 4,
    stepCount: 1,
    isMouseDown: false,
    startPoint: { x: 0, y: 0 },
    currentObject: null as any,
    currentHead: null as any,
  });

  const [activeTool, _setActiveTool] = useState<ToolType>('select');
  const [color, _setColor] = useState('#ff0000'); 
  const [stepCount, _setStepCount] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  const saveHistory = useCallback(() => {
    if (!fabricCanvas.current) return;
    const json = JSON.stringify(fabricCanvas.current.toJSON());
    
    // 同じ状態なら保存しない
    if (historyIndex.current >= 0 && history.current[historyIndex.current] === json) {
      return;
    }

    // 途中の履歴がある場合はそれ以降を削除
    if (historyIndex.current < history.current.length - 1) {
      history.current = history.current.slice(0, historyIndex.current + 1);
    }
    
    history.current.push(json);
    historyIndex.current++;
    
    // 履歴の上限設定 (50件)
    if (history.current.length > 50) {
      history.current.shift();
      historyIndex.current--;
    }
    
    setCanUndo(historyIndex.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(async () => {
    if (historyIndex.current <= 0 || !fabricCanvas.current) return;
    
    historyIndex.current--;
    const state = history.current[historyIndex.current];
    await fabricCanvas.current.loadFromJSON(state);
    fabricCanvas.current.renderAll();
    
    setHasImage(!!fabricCanvas.current.backgroundImage);
    
    setCanUndo(historyIndex.current > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(async () => {
    if (historyIndex.current >= history.current.length - 1 || !fabricCanvas.current) return;
    
    historyIndex.current++;
    const state = history.current[historyIndex.current];
    await fabricCanvas.current.loadFromJSON(state);
    fabricCanvas.current.renderAll();
    
    setHasImage(!!fabricCanvas.current.backgroundImage);
    
    setCanUndo(true);
    setCanRedo(historyIndex.current < history.current.length - 1);
  }, []);

  const setActiveTool = useCallback((tool: ToolType) => {
    stateRef.current.activeTool = tool;
    _setActiveTool(tool);
    
    if (fabricCanvas.current) {
      const canvas = fabricCanvas.current;
      canvas.selection = (tool === 'select');
      canvas.defaultCursor = (tool === 'select') ? 'default' : 'crosshair';
      
      // ペンツールの切り替え
      canvas.isDrawingMode = (tool === 'pen');
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = stateRef.current.color;
        canvas.freeDrawingBrush.width = stateRef.current.strokeWidth;
      }
    }
  }, []);

  const setColor = useCallback((c: string) => {
    stateRef.current.color = c;
    _setColor(c);
    if (fabricCanvas.current?.isDrawingMode) {
      fabricCanvas.current.freeDrawingBrush!.color = c;
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: 'transparent',
      selection: false,
    });
    fabricCanvas.current = canvas;

    // 初期状態を保存
    saveHistory();

    const createStepInternal = (c: Canvas, x: number, y: number) => {
      const s = stateRef.current;
      const radius = 18;
      const circle = new Circle({ radius, fill: s.color, originX: 'center', originY: 'center' });
      const text = new Text(s.stepCount.toString(), { fontSize: 20, fill: '#fff', originX: 'center', originY: 'center' });
      const group = new Group([circle, text], { left: x - radius, top: y - radius, selectable: true });
      c.add(group);
      s.stepCount++;
      _setStepCount(s.stepCount);
      saveHistory();
    };

    const handleMouseDown = (options: TPointerEventInfo) => {
      const state = stateRef.current;
      const tool = state.activeTool;
      if (tool === 'select' || tool === 'pen') return;
      
      const pointer = options.scenePoint || options.pointer || canvas.getPointer(options.e);
      state.isMouseDown = true;
      state.startPoint = { x: pointer.x, y: pointer.y };

      if (tool === 'rectangle' || tool === 'blur') {
        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: tool === 'blur' ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
          stroke: tool === 'blur' ? '#fff' : state.color,
          strokeWidth: state.strokeWidth,
          selectable: false,
          evented: false,
          originX: 'left',
          originY: 'top',
          ...(tool === 'blur' ? { strokeDashArray: [5, 5] } : {})
        });
        canvas.add(rect);
        state.currentObject = rect;
      } else if (tool === 'arrow') {
        const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: state.color,
          strokeWidth: state.strokeWidth,
          selectable: false,
          evented: false,
          strokeLineCap: 'round'
        });
        const head = new Triangle({
          width: 15,
          height: 15,
          fill: state.color,
          originX: 'center',
          originY: 'center',
          selectable: false,
          visible: false,
          evented: false,
        });
        canvas.add(line, head);
        state.currentObject = line;
        state.currentHead = head;
      } else if (tool === 'text') {
        const t = new IText('Input Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 24,
          fill: state.color,
        });
        canvas.add(t);
        canvas.setActiveObject(t);
        setActiveTool('select');
        saveHistory();
      } else if (tool === 'step') {
        createStepInternal(canvas, pointer.x, pointer.y);
      }
      
      canvas.requestRenderAll();
    };

    const handleMouseMove = (options: TPointerEventInfo) => {
      const state = stateRef.current;
      if (!state.isMouseDown || !state.currentObject) return;
      const pointer = options.scenePoint || options.pointer || canvas.getPointer(options.e);
      const tool = state.activeTool;

      if (tool === 'rectangle' || tool === 'blur') {
        const left = Math.min(pointer.x, state.startPoint.x);
        const top = Math.min(pointer.y, state.startPoint.y);
        const width = Math.abs(pointer.x - state.startPoint.x);
        const height = Math.abs(pointer.y - state.startPoint.y);
        state.currentObject.set({ left, top, width, height });
      } else if (tool === 'arrow') {
        const line = state.currentObject as Line;
        line.set({ x2: pointer.x, y2: pointer.y });
        if (state.currentHead) {
          const angle = Math.atan2(pointer.y - state.startPoint.y, pointer.x - state.startPoint.x) * 180 / Math.PI;
          state.currentHead.set({
            left: pointer.x,
            top: pointer.y,
            angle: angle + 90,
            visible: true
          });
        }
      }
      canvas.requestRenderAll();
    };

    const handleMouseUp = () => {
      const state = stateRef.current;
      if (!state.isMouseDown) return;
      state.isMouseDown = false;

      if (state.currentObject) {
        if (state.activeTool === 'arrow' && state.currentHead) {
          const line = state.currentObject as Line;
          const head = state.currentHead;
          canvas.remove(line, head);
          const group = new Group([line, head], { selectable: true });
          canvas.add(group);
          canvas.setActiveObject(group);
        } else {
          state.currentObject.set({ selectable: true, evented: true });
          canvas.setActiveObject(state.currentObject);
        }
        saveHistory();
      }
      
      state.currentObject = null;
      state.currentHead = null;
      canvas.requestRenderAll();
    };

    const handleObjectModified = () => {
      saveHistory();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('path:created', () => saveHistory());

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.includes('image')) {
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const img = await FabricImage.fromURL(ev.target?.result as string);
            const maxWidth = window.innerWidth * 0.8;
            const maxHeight = window.innerHeight * 0.8;
            const scale = Math.min(maxWidth / img.width!, maxHeight / img.height!, 1);
            img.scale(scale);
            img.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
            canvas.setDimensions({ width: img.getScaledWidth(), height: img.getScaledHeight() });
            canvas.backgroundImage = img;
            canvas.requestRenderAll();
            setHasImage(true);
            saveHistory();
          };
          reader.readAsDataURL(blob);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // テキスト編集中の場合は削除しない
      const activeObject = canvas.getActiveObject();
      if (activeObject && (activeObject as any).isEditing) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          canvas.remove(...activeObjects);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          saveHistory();
        }
      }

      // Ctrl + Z (Undo)
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }

      // Ctrl + Y (Redo)
      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      canvas.dispose();
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setActiveTool, saveHistory, undo, redo]);

  const deselectAll = useCallback(() => {
    if (!fabricCanvas.current) return;
    fabricCanvas.current.discardActiveObject();
    fabricCanvas.current.requestRenderAll();
  }, []);

  const deleteSelected = useCallback(() => {
    if (!fabricCanvas.current) return;
    const activeObjects = fabricCanvas.current.getActiveObjects();
    if (activeObjects.length > 0) {
      fabricCanvas.current.remove(...activeObjects);
      fabricCanvas.current.discardActiveObject();
      fabricCanvas.current.requestRenderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const clearCanvas = useCallback(() => {
    fabricCanvas.current?.clear();
    fabricCanvas.current?.set({ backgroundColor: 'transparent' });
    fabricCanvas.current?.requestRenderAll();
    stateRef.current.stepCount = 1;
    _setStepCount(1);
    setHasImage(false);
    saveHistory();
  }, [saveHistory]);

  return { 
    canvasRef, 
    fabricCanvas, 
    activeTool, 
    setActiveTool, 
    color, 
    setColor, 
    clearCanvas, 
    deleteSelected, 
    stepCount,
    undo,
    redo,
    canUndo,
    canRedo,
    hasImage,
    deselectAll
  };
};
