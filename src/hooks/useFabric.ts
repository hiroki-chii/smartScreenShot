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
  underline: boolean;
  fontSize: number;
  fontWeight?: string;
  fontStyle?: string;
  lineMode?: boolean;
}

const getDashArray = (style: string, width: number) => {
  if (style === 'dashed') return [width * 3, width * 1.5];
  if (style === 'dotted') return [0.1, width * 2];
  return null;
};

const hexToRgba = (hex: string, opacity: number) => {
  if (!hex || hex === 'transparent') return 'transparent';
  if (hex.startsWith('rgba')) {
    return hex.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, `rgba($1, $2, $3, ${opacity})`);
  }
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const DEFAULT_FONT_FAMILY = '"Yu Gothic", "YuGothic", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", sans-serif';

export const useFabric = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<Canvas | null>(null);

  const [activeTool, _setActiveTool] = useState<ToolType>('select');
  const [toolSettings, setToolSettings] = useState<Record<ToolType, ToolSettings>>({
    select: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
    rectangle: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
    arrow: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 4, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
    text: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 0, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
    step: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 0, strokeStyle: 'solid', angle: 0, fontWeight: 'bold', fontStyle: 'normal', underline: false, fontSize: 20, lineMode: false },
    pen: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
  });

  const stateRef = useRef({
    activeTool: 'select' as ToolType,
    toolSettings: {
      select: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
      rectangle: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
      arrow: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 4, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
      text: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 0, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
      step: { color: '#ff0000', fillColor: '#ff0000', strokeOpacity: 1, fillOpacity: 1, strokeWidth: 0, strokeStyle: 'solid', angle: 0, fontWeight: 'bold', fontStyle: 'normal', underline: false, fontSize: 20, lineMode: false },
      pen: { color: '#ff0000', fillColor: 'transparent', strokeOpacity: 1, fillOpacity: 0, strokeWidth: 4, strokeStyle: 'solid', angle: 0, fontWeight: 'normal', fontStyle: 'normal', underline: false, fontSize: 24, lineMode: false },
    } as Record<ToolType, ToolSettings>,
    stepCount: 1,
    isMouseDown: false,
    startPoint: { x: 0, y: 0 },
    currentObject: null as any,
    currentHead: null as any,
    baseSize: { width: 800, height: 600 },
  });
  const clipboard = useRef<any>(null);

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
      const penSettings = stateRef.current.toolSettings.pen;
      canvas.isDrawingMode = (tool === 'pen' && !penSettings.lineMode);
      
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = hexToRgba(penSettings.color, penSettings.strokeOpacity);
        canvas.freeDrawingBrush.width = penSettings.strokeWidth;
        canvas.freeDrawingBrush.strokeDashArray = getDashArray(penSettings.strokeStyle, penSettings.strokeWidth);
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
      if (stateRef.current.activeTool === 'pen' && tool === 'pen' && fabricCanvas.current) {
        const penSettings = newSettings.pen;
        fabricCanvas.current.isDrawingMode = !penSettings.lineMode;
        
        if (fabricCanvas.current.isDrawingMode) {
          if (!fabricCanvas.current.freeDrawingBrush) {
            fabricCanvas.current.freeDrawingBrush = new PencilBrush(fabricCanvas.current);
          }
          const brush = fabricCanvas.current.freeDrawingBrush!;
          brush.width = penSettings.strokeWidth;
          brush.color = hexToRgba(penSettings.color, penSettings.strokeOpacity);
          brush.strokeDashArray = getDashArray(penSettings.strokeStyle, penSettings.strokeWidth);
        }
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
                if (child.type === 'line') child.set({ stroke: strokeColor });
                else if (child instanceof Triangle) child.set({ fill: strokeColor });
                else if (child instanceof Circle) child.set({ fill: strokeColor });
              });
            } else if (obj.type === 'path' || obj.type === 'line') obj.set({ stroke: strokeColor, opacity: 1 });
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
            if (obj instanceof Rect || obj.type === 'path' || obj.type === 'line') {
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

          const hasTextUpdate = updates.fontWeight !== undefined || updates.fontStyle !== undefined || 
                               updates.underline !== undefined || updates.fontSize !== undefined;
          
          if (hasTextUpdate) {
            if (obj instanceof IText || obj instanceof Text) {
              modified = true;
              if (updates.fontWeight !== undefined) obj.set({ fontWeight: updates.fontWeight });
              if (updates.fontStyle !== undefined) obj.set({ fontStyle: updates.fontStyle });
              if (updates.underline !== undefined) obj.set({ underline: updates.underline });
              if (updates.fontSize !== undefined) obj.set({ fontSize: updates.fontSize });
            } else if (obj instanceof Group) {
              // ステップツール内のテキストへの反映
              obj.getObjects().forEach(child => {
                if (child instanceof Text) {
                  modified = true;
                  if (updates.fontWeight !== undefined) child.set({ fontWeight: updates.fontWeight });
                  if (updates.fontStyle !== undefined) child.set({ fontStyle: updates.fontStyle });
                  if (updates.underline !== undefined) child.set({ underline: updates.underline });
                  if (updates.fontSize !== undefined) child.set({ fontSize: updates.fontSize });
                }
              });
            }
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
        fontFamily: DEFAULT_FONT_FAMILY,
        fontWeight: 'bold',
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

      const settings = state.toolSettings[tool];

      if (tool === 'select' || (tool === 'pen' && !settings.lineMode)) return;

      const pointer = options.scenePoint || options.pointer || canvas.getPointer(options.e);
      state.isMouseDown = true;
      state.startPoint = { x: pointer.x, y: pointer.y };

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
      } else if (tool === 'arrow' || (tool === 'pen' && settings.lineMode)) {
        const dashArray = getDashArray(settings.strokeStyle, settings.strokeWidth);
        const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: hexToRgba(settings.color, settings.strokeOpacity),
          strokeWidth: settings.strokeWidth,
          strokeDashArray: dashArray,
          strokeLineCap: 'round',
          strokeUniform: true,
          opacity: 1,
          selectable: false,
          evented: false,
        });

        if (tool === 'arrow') {
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
        } else {
          canvas.add(line);
          state.currentObject = line;
        }
      } else if (tool === 'text') {
        const t = new IText('Input Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: settings.fontSize,
          fill: hexToRgba(settings.color, settings.strokeOpacity),
          fontFamily: DEFAULT_FONT_FAMILY,
          fontWeight: settings.fontWeight,
          fontStyle: settings.fontStyle,
          underline: settings.underline,
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
      } else if (tool === 'arrow' || tool === 'pen') {
        const line = state.currentObject;
        if (line && line.type === 'line') {
          const startX = state.startPoint.x;
          const startY = state.startPoint.y;
          let targetX = pointer.x;
          let targetY = pointer.y;

          // 描画中のスナップ処理
          const angleRad = Math.atan2(targetY - startY, targetX - startX);
          let angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
          
          const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
          const snapThreshold = 5; // マウス描画時は少し広めにスナップ
          let snapped = false;
          let bestSnapAngle = angleDeg;

          for (const snap of snapAngles) {
            if (Math.abs(angleDeg - snap) <= snapThreshold) {
              bestSnapAngle = snap % 360;
              snapped = true;
              break;
            }
          }

          if (snapped) {
            const dist = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
            const snapRad = bestSnapAngle * Math.PI / 180;
            targetX = startX + dist * Math.cos(snapRad);
            targetY = startY + dist * Math.sin(snapRad);
            
            // スナップ時の視覚効果（緑色に一時的に変更）
            line.set({ stroke: '#22c55e', strokeWidth: state.toolSettings[tool].strokeWidth * 1.5 });
          } else {
            // 通常時の色に戻す
            const settings = state.toolSettings[tool];
            line.set({ 
              stroke: hexToRgba(settings.color, settings.strokeOpacity),
              strokeWidth: settings.strokeWidth 
            });
          }

          line.set({ x2: targetX, y2: targetY });
          line.setCoords();

          if (tool === 'arrow' && state.currentHead) {
            const currentAngle = Math.atan2(targetY - startY, targetX - startX) * 180 / Math.PI;
            state.currentHead.set({
              left: targetX,
              top: targetY,
              angle: currentAngle + 90,
              visible: true,
              fill: snapped ? '#22c55e' : hexToRgba(state.toolSettings.arrow.color, state.toolSettings.arrow.strokeOpacity)
            });
            state.currentHead.setCoords();
          }
        }
      }
      canvas.requestRenderAll();
    };

    const handleMouseUp = () => {
      const state = stateRef.current;
      if (!state.isMouseDown) return;
      state.isMouseDown = false;

      if (state.currentObject) {
        // スナップ時の視覚効果（緑色）をリセットして元の設定に戻す
        const tool = state.activeTool;
        const settings = state.toolSettings[tool];
        
        if (state.currentObject.type === 'line') {
          state.currentObject.set({
            stroke: hexToRgba(settings.color, settings.strokeOpacity),
            strokeWidth: settings.strokeWidth
          });
        }

        if (state.activeTool === 'arrow' && state.currentHead) {
          state.currentHead.set({
            fill: hexToRgba(settings.color, settings.strokeOpacity)
          });
          
          const line = state.currentObject as Line;
          const head = state.currentHead;
          canvas.remove(line, head);
          const group = new Group([line, head], { selectable: true });
          canvas.add(group);
          canvas.setActiveObject(group);
        } else {
          state.currentObject.set({ selectable: true, evented: true });
          if (state.currentObject.setCoords) state.currentObject.setCoords();
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
        updates.fontWeight = selected.fontWeight;
        updates.fontStyle = selected.fontStyle;
        updates.underline = selected.underline;
        updates.fontSize = selected.fontSize;
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
        if (isArrow) {
          tool = 'arrow';
          updates.angle = selected.angle;
          const line = children.find(c => c.type === 'line');
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
            updates.fontSize = circle.radius * 1.1; // Estimate fontSize from radius for steps
          }
        }
      } else if (selected.type === 'path' || selected.type === 'line') {
        // Line の場合は、ペンツールの直線モードかアローツールのいずれか
        // ただし、アローは Group になっているので、ここに来る Line は通常ペンツールの直線
        tool = 'pen';
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
        
        if (selected.type === 'line') {
          updates.lineMode = true;
        } else {
          updates.lineMode = false;
        }
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

      // テキスト編集開始 (F2)
      if (e.key === 'F2') {
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject instanceof IText) {
          e.preventDefault();
          activeObject.enterEditing();
          canvas.requestRenderAll();
        }
      }

      // コピー (Ctrl + C)
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          e.preventDefault();
          activeObject.clone().then((cloned: any) => {
            clipboard.current = cloned;
          });
        }
      }

      // 貼り付け (Ctrl + V)
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        // 内部クリップボードにオブジェクトがある場合のみ処理
        // システムクリップボードからの画像貼り付けは handlePaste で行われる
        if (clipboard.current) {
          e.preventDefault();
          clipboard.current.clone().then((clonedObj: any) => {
            canvas.discardActiveObject();
            clonedObj.set({
              left: clonedObj.left + 20,
              top: clonedObj.top + 20,
              evented: true,
            });
            if (clonedObj.type === 'activeSelection') {
              // active selection needs a reference to the canvas.
              clonedObj.canvas = canvas;
              clonedObj.forEachObject((obj: any) => {
                canvas.add(obj);
              });
              // this targets the objects in the selection, not the selection itself
              clonedObj.setCoords();
            } else {
              canvas.add(clonedObj);
            }
            // 次の貼り付けのために位置をずらす
            clipboard.current.top += 20;
            clipboard.current.left += 20;
            canvas.setActiveObject(clonedObj);
            canvas.requestRenderAll();
            saveHistory();
          });
        }
      }

      // 方向キーによる移動・回転・サイズ変更
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          e.preventDefault();
          
          if (e.ctrlKey) {
            // サイズ変更（スケール調整）
            const step = e.shiftKey ? 0.1 : 0.01;
            activeObjects.forEach(obj => {
              const currentScaleX = obj.scaleX || 1;
              const currentScaleY = obj.scaleY || 1;
              let newScaleX = currentScaleX;
              let newScaleY = currentScaleY;
              
              if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                newScaleX += step;
                newScaleY += step;
              } else {
                newScaleX = Math.max(0.01, newScaleX - step);
                newScaleY = Math.max(0.01, newScaleY - step);
              }
              
              obj.set({ scaleX: newScaleX, scaleY: newScaleY });
              obj.setCoords();
            });
          } else if (e.altKey) {
            // 回転
            const step = e.shiftKey ? 15 : 1;
            activeObjects.forEach(obj => {
              const currentAngle = obj.angle || 0;
              let newAngle = currentAngle;
              
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                newAngle -= step;
              } else {
                newAngle += step;
              }
              
              // 0-359の範囲に正規化
              newAngle = (newAngle % 360 + 360) % 360;
              
              // スナップポイント (垂直、水平、45度)
              const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
              const snapThreshold = 2.1; // スナップする閾値
              
              let snapped = false;
              for (const snapAngle of snapAngles) {
                // 角度間の最短距離を計算
                const getDist = (a: number, b: number) => {
                  const d = Math.abs(a - b) % 360;
                  return d > 180 ? 360 - d : d;
                };

                const distNew = getDist(newAngle, snapAngle);
                const distCurrent = getDist(currentAngle, snapAngle);

                // 閾値以内、かつスナップポイントに近づいている場合のみ吸着する
                // これにより、すでにスナップしている状態から離れる方向への移動を許可する
                if (distNew <= snapThreshold && distNew < distCurrent) {
                  newAngle = snapAngle;
                  snapped = true;
                  break;
                }
                
                // すでにスナップポイント上にいる場合も視覚効果を表示
                if (distCurrent < 0.1) {
                  snapped = true;
                }
              }
              
              // 視覚効果の適用
              if (snapped) {
                obj.set({
                  borderColor: '#22c55e', // 鮮やかな緑
                  borderScaleFactor: 2.5,
                  cornerColor: '#22c55e',
                  cornerStrokeColor: '#ffffff'
                });
              } else {
                obj.set({
                  borderColor: '#3b82f6', // 青
                  borderScaleFactor: 1,
                  cornerColor: '#ffffff',
                  cornerStrokeColor: '#3b82f6'
                });
              }
              
              obj.set('angle', newAngle);
              obj.setCoords();
            });
          } else {
            // 移動
            const step = e.shiftKey ? 10 : 1;
            activeObjects.forEach(obj => {
              switch (e.key) {
                case 'ArrowUp':
                  obj.set('top', obj.top - step);
                  break;
                case 'ArrowDown':
                  obj.set('top', obj.top + step);
                  break;
                case 'ArrowLeft':
                  obj.set('left', obj.left - step);
                  break;
                case 'ArrowRight':
                  obj.set('left', obj.left + step);
                  break;
              }
              obj.setCoords();
            });
          }
          
          canvas.requestRenderAll();
          saveHistory();
        }
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

