import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, Rect, Circle, IText, Text, Group, Line, FabricImage, Triangle, TPointerEventInfo, PencilBrush } from 'fabric';

export type ToolType = 'select' | 'rectangle' | 'arrow' | 'text' | 'step' | 'pen';

export interface ToolSettings {
  color: string;
  fillColor: string;
  strokeOpacity: number;
  fillOpacity: number;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  angle: number;
}

const getDashArray = (style: string, width: number) => {
  if (style === 'dashed') return [width * 3, width * 1.5];
  if (style === 'dotted') return [0.1, width * 2];
  return null;
};

const hexToRgba = (hex: string, opacity: number) => {
  if (!hex || hex === 'transparent') return 'transparent';
  if (hex.startsWith('rgba')) {
    return hex.replace(/[\d.]+\)$/g, `${opacity})`);
  }
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const useFabric = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<Canvas | null>(null);
  
  const [activeTool, _setActiveTool] = useState<ToolType>('select');
  const [toolSettings, setToolSettings] = useState<Record<ToolType, ToolSettings>>({
    select: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0 },
    rectangle: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0 },
    arrow: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 4, strokeStyle: 'solid', angle: 0 },
    text: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 0, strokeStyle: 'solid', angle: 0 },
    step: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 0, strokeStyle: 'solid', angle: 0 },
    pen: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0 },
  });

  const stateRef = useRef({
    activeTool: 'select' as ToolType,
    toolSettings: {
      select: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0 },
      rectangle: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0 },
      arrow: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 4, strokeStyle: 'solid', angle: 0 },
      text: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 0, strokeStyle: 'solid', angle: 0 },
      step: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 0, strokeStyle: 'solid', angle: 0 },
      pen: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0 },
    } as Record<ToolType, ToolSettings>,
    stepCount: 1,
    isMouseDown: false,
    startPoint: { x: 0, y: 0 },
    currentObject: null as any,
    currentHead: null as any,
    baseSize: { width: 800, height: 600 },
  });

  const [stepCount, _setStepCount] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [zoom, setZoom] = useState(1);
  
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
        const settings = stateRef.current.toolSettings.pen;
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = settings.color;
        canvas.freeDrawingBrush.width = settings.strokeWidth;
        canvas.freeDrawingBrush.strokeDashArray = getDashArray(settings.strokeStyle, settings.strokeWidth);
        // 不透明度の反映
        const r = parseInt(settings.color.slice(1, 3), 16);
        const g = parseInt(settings.color.slice(3, 5), 16);
        const b = parseInt(settings.color.slice(5, 7), 16);
        canvas.freeDrawingBrush.color = `rgba(${r}, ${g}, ${b}, ${settings.strokeOpacity})`;
      }
    }
  }, []);

  const updateToolSetting = useCallback((tool: ToolType, updates: Partial<ToolSettings>) => {
    setToolSettings(prev => {
      const newSettings = {
        ...prev,
        [tool]: { ...prev[tool], ...updates }
      };
      stateRef.current.toolSettings = newSettings;

      // アクティブなツールがペンで、その設定が更新された場合はブラシに即座に反映
      if (stateRef.current.activeTool === 'pen' && tool === 'pen' && fabricCanvas.current?.isDrawingMode) {
        const penSettings = newSettings.pen;
        const brush = fabricCanvas.current.freeDrawingBrush!;
        brush.width = penSettings.strokeWidth;
        brush.color = hexToRgba(penSettings.color, penSettings.strokeOpacity);
        brush.strokeDashArray = getDashArray(penSettings.strokeStyle, penSettings.strokeWidth);
      }

      // 選択中のオブジェクトがあれば、そのプロパティも更新
      if (fabricCanvas.current) {
        const activeObjects = fabricCanvas.current.getActiveObjects();
        let modified = false;

        activeObjects.forEach(obj => {
          // 現在変更中のツールの設定を使用
          const s = newSettings[tool];

          if (updates.color || updates.strokeOpacity !== undefined) {
            modified = true;
            const strokeColor = hexToRgba(s.color, s.strokeOpacity);
            if (obj instanceof Rect) obj.set({ stroke: strokeColor, opacity: 1 });
            else if (obj instanceof IText || obj instanceof Text) obj.set({ fill: strokeColor, opacity: 1 });
            else if (obj instanceof Group) {
              obj.set({ opacity: 1 });
              obj.getObjects().forEach(child => {
                if (child instanceof Line) child.set({ stroke: strokeColor });
                else if (child instanceof Triangle) child.set({ fill: strokeColor });
                else if (child instanceof Circle) child.set({ fill: strokeColor });
              });
            } else if (obj.type === 'path') obj.set({ stroke: strokeColor, opacity: 1 });
          }
          
          if (updates.fillColor || updates.fillOpacity !== undefined) {
            modified = true;
            if (obj instanceof Rect) {
              obj.set({ fill: hexToRgba(s.fillColor, s.fillOpacity) });
            } else if (obj instanceof Group) {
              obj.getObjects().forEach(child => {
                if (child instanceof Circle) child.set({ fill: s.fillColor });
              });
            }
          }

          if (updates.strokeWidth !== undefined || updates.strokeStyle !== undefined) {
            modified = true;
            const dashArray = getDashArray(s.strokeStyle, s.strokeWidth);
            if (obj instanceof Rect || obj.type === 'path') {
              obj.set({ 
                strokeWidth: s.strokeWidth, 
                strokeDashArray: dashArray,
                strokeLineCap: 'round',
                strokeLineJoin: 'round'
              });
            } else if (obj instanceof Group) {
              const isArrow = obj.getObjects().some(c => c instanceof Triangle);
              obj.getObjects().forEach(child => {
                if (child instanceof Line) {
                  child.set({ 
                    strokeWidth: s.strokeWidth, 
                    strokeDashArray: dashArray,
                    strokeLineCap: 'round'
                  });
                } else if (child instanceof Triangle && isArrow) {
                  const size = s.strokeWidth * 2 + 7;
                  child.set({ width: size, height: size });
                }
              });
            }
          }

          if (updates.angle !== undefined) {
            modified = true;
            obj.set({ angle: updates.angle });
          }
        });

        if (modified) {
          fabricCanvas.current.requestRenderAll();
          saveHistory();
        }
      }
      
      return newSettings;
    });
  }, [saveHistory]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: 'transparent',
      selection: false,
    });
    fabricCanvas.current = canvas;
    
    // 現在のズーム状態を反映
    canvas.setZoom(zoom);

    // 初期状態を保存
    saveHistory();

    const createStepInternal = (c: Canvas, x: number, y: number) => {
      const s = stateRef.current;
      const settings = s.toolSettings.step;
      const radius = 18;
      const circle = new Circle({ 
        radius, 
        fill: hexToRgba(settings.color, settings.strokeOpacity), 
        opacity: 1,
        originX: 'center', 
        originY: 'center' 
      });
      const text = new Text(s.stepCount.toString(), { 
        fontSize: 20, 
        fill: '#fff', 
        originX: 'center', 
        originY: 'center' 
      });
      const group = new Group([circle, text], { left: x - radius, top: y - radius, selectable: true });
      c.add(group);
      s.stepCount++;
      _setStepCount(s.stepCount);
      saveHistory();
    };

    const handleMouseDown = (options: TPointerEventInfo) => {
      const state = stateRef.current;
      const tool = state.activeTool;

      // 既存のオブジェクト（背景画像以外）をクリックした場合は、新規作成を行わない
      if (options.target && options.target !== canvas.backgroundImage) {
        return;
      }

      if (tool === 'select' || tool === 'pen') return;
      
      const pointer = options.scenePoint || options.pointer || canvas.getPointer(options.e);
      state.isMouseDown = true;
      state.startPoint = { x: pointer.x, y: pointer.y };

      const settings = state.toolSettings[tool];

      if (tool === 'rectangle') {
        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: hexToRgba(settings.fillColor, settings.fillOpacity),
          stroke: hexToRgba(settings.color, settings.strokeOpacity),
          strokeWidth: settings.strokeWidth,
          strokeDashArray: getDashArray(settings.strokeStyle, settings.strokeWidth),
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          opacity: 1,
          selectable: false,
          evented: false,
          originX: 'left',
          originY: 'top',
        });
        canvas.add(rect);
        state.currentObject = rect;
      } else if (tool === 'arrow') {
        const dashArray = getDashArray(settings.strokeStyle, settings.strokeWidth);
        const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: hexToRgba(settings.color, settings.strokeOpacity),
          strokeWidth: settings.strokeWidth,
          strokeDashArray: dashArray,
          strokeLineCap: 'round',
          opacity: 1,
          selectable: false,
          evented: false,
        });
        const head = new Triangle({
          width: settings.strokeWidth * 2 + 7,
          height: settings.strokeWidth * 2 + 7,
          fill: hexToRgba(settings.color, settings.strokeOpacity),
          opacity: 1,
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
          fill: hexToRgba(settings.color, settings.strokeOpacity),
          opacity: 1,
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

      if (tool === 'rectangle') {
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

    const handleMouseWheel = (opt: any) => {
      const delta = opt.e.deltaY;
      let newZoom = canvas.getZoom();
      newZoom *= 0.999 ** delta;
      if (newZoom > 20) newZoom = 20;
      if (newZoom < 0.1) newZoom = 0.1;
      
      const base = stateRef.current.baseSize;
      canvas.setDimensions({
        width: base.width * newZoom,
        height: base.height * newZoom
      });
      
      canvas.setZoom(newZoom);
      
      opt.e.preventDefault();
      opt.e.stopPropagation();
      setZoom(newZoom);
    };

    const handleSelection = (e: any) => {
      const selected = e.selected?.[0] || e.target;
      if (!selected || selected instanceof FabricImage) return;

      let tool: ToolType | null = null;
      const updates: Partial<ToolSettings> = {};

      if (selected instanceof Rect) {
        tool = 'rectangle';
        updates.angle = selected.angle;
        updates.color = selected.stroke as string;
        updates.strokeWidth = selected.strokeWidth;
        const dash = selected.strokeDashArray;
        if (!dash) updates.strokeStyle = 'solid';
        else if (dash[0] === 0.1 || dash[0] === 0) updates.strokeStyle = 'dotted';
        else updates.strokeStyle = 'dashed';
        
        const stroke = selected.stroke as string;
        if (stroke && stroke.startsWith('rgba')) {
          const match = stroke.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
          if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            updates.color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            updates.strokeOpacity = parseFloat(match[4]);
          }
        } else {
          updates.strokeOpacity = selected.opacity; // fallback
        }
        
        const fill = selected.fill as string;
        if (fill && fill.startsWith('rgba')) {
          const match = fill.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
          if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            updates.fillColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            updates.fillOpacity = parseFloat(match[4]);
          }
        } else if (fill === 'transparent') {
          updates.fillColor = 'transparent';
          updates.fillOpacity = 0;
        } else {
          updates.fillColor = fill;
          updates.fillOpacity = 1;
        }
      } else if (selected instanceof IText || selected instanceof Text) {
        tool = 'text';
        updates.angle = selected.angle;
        const fill = selected.fill as string;
        if (fill && fill.startsWith('rgba')) {
          const match = fill.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
          if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            updates.color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            updates.strokeOpacity = parseFloat(match[4]);
          }
        } else {
          updates.color = fill;
          updates.strokeOpacity = selected.opacity;
        }
      } else if (selected instanceof Group) {
        const children = selected.getObjects();
        const isArrow = children.some(c => c instanceof Triangle);
        const isStep = children.some(c => c instanceof Circle);
        updates.angle = selected.angle;
        
        if (isArrow) {
          tool = 'arrow';
          const line = children.find(c => c instanceof Line) as Line;
          if (line) {
            const stroke = line.stroke as string;
            if (stroke && stroke.startsWith('rgba')) {
              const match = stroke.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
              if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                updates.color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                updates.strokeOpacity = parseFloat(match[4]);
              }
            } else {
              updates.color = stroke;
              updates.strokeOpacity = selected.opacity;
            }
            updates.strokeWidth = line.strokeWidth;
            const dash = line.strokeDashArray;
            if (!dash) updates.strokeStyle = 'solid';
            else if (dash[0] === 0.1 || dash[0] === 0) updates.strokeStyle = 'dotted';
            else updates.strokeStyle = 'dashed';
          }
        } else if (isStep) {
          tool = 'step';
          const circle = children.find(c => c instanceof Circle) as Circle;
          if (circle) {
            const fill = circle.fill as string;
            if (fill && fill.startsWith('rgba')) {
              const match = fill.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
              if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                updates.color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                updates.strokeOpacity = parseFloat(match[4]);
              }
            } else {
              updates.color = fill;
              updates.strokeOpacity = selected.opacity;
            }
          }
        }
      } else if (selected.type === 'path') {
        tool = 'pen';
        updates.angle = selected.angle;
        const stroke = selected.stroke as string;
        if (stroke && stroke.startsWith('rgba')) {
          const match = stroke.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
          if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            updates.color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            updates.strokeOpacity = parseFloat(match[4]);
          }
        } else {
          updates.color = stroke;
          updates.strokeOpacity = selected.opacity;
        }
        updates.strokeWidth = selected.strokeWidth;
        const dash = selected.strokeDashArray;
        if (!dash) updates.strokeStyle = 'solid';
        else if (dash[0] === 0.1 || dash[0] === 0) updates.strokeStyle = 'dotted';
        else updates.strokeStyle = 'dashed';
      }

      if (tool) {
        setActiveTool(tool);
        if (Object.keys(updates).length > 0) {
          setToolSettings(prev => {
            const newSettings = {
              ...prev,
              [tool!]: { ...prev[tool!], ...updates }
            };
            stateRef.current.toolSettings = newSettings;
            return newSettings;
          });
        }
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:wheel', handleMouseWheel);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => {
      setActiveTool('select');
    });
    canvas.on('path:created', (options: any) => {
      const settings = stateRef.current.toolSettings.pen;
      const r = parseInt(settings.color.slice(1, 3), 16);
      const g = parseInt(settings.color.slice(3, 5), 16);
      const b = parseInt(settings.color.slice(5, 7), 16);
      options.path.set({ 
        stroke: `rgba(${r}, ${g}, ${b}, ${settings.strokeOpacity})`,
        strokeDashArray: getDashArray(settings.strokeStyle, settings.strokeWidth),
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        opacity: 1 
      });
      saveHistory();
    });

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
            
            const scaledWidth = img.getScaledWidth();
            const scaledHeight = img.getScaledHeight();
            stateRef.current.baseSize = { width: scaledWidth, height: scaledHeight };
            
            canvas.setDimensions({ 
              width: scaledWidth * zoom, 
              height: scaledHeight * zoom 
            });
            canvas.setZoom(zoom);
            
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
      const activeObject = canvas.getActiveObject();
      if (activeObject && (activeObject as any).isEditing) return;

      if (e.key === 'Escape') {
        deselectAll();
        setActiveTool('select');
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

      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }

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

  const zoomIn = useCallback(() => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;
    const newZoom = Math.min(canvas.getZoom() * 1.1, 20);
    const base = stateRef.current.baseSize;
    
    canvas.setDimensions({
      width: base.width * newZoom,
      height: base.height * newZoom
    });
    canvas.setZoom(newZoom);
    setZoom(newZoom);
  }, []);

  const zoomOut = useCallback(() => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;
    const newZoom = Math.max(canvas.getZoom() / 1.1, 0.1);
    const base = stateRef.current.baseSize;
    
    canvas.setDimensions({
      width: base.width * newZoom,
      height: base.height * newZoom
    });
    canvas.setZoom(newZoom);
    setZoom(newZoom);
  }, []);

  const resetZoom = useCallback(() => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;
    const base = stateRef.current.baseSize;
    
    canvas.setDimensions({
      width: base.width,
      height: base.height
    });
    canvas.setZoom(1);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
  }, []);

  return { 
    canvasRef, 
    fabricCanvas, 
    activeTool, 
    setActiveTool, 
    toolSettings,
    updateToolSetting,
    clearCanvas, 
    deleteSelected, 
    stepCount,
    undo,
    redo,
    canUndo,
    canRedo,
    hasImage,
    deselectAll,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom
  };
};

