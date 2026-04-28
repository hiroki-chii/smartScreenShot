import React from 'react';
import { 
  MousePointer2, 
  Square, 
  ArrowUpRight, 
  Type, 
  Hash, 
  Pencil, 
  Trash2, 
  Copy, 
  Download, 
  Undo2,
  Redo2,
  Image as ImageIcon,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  ZoomIn,
  ZoomOut,
  Type as TypeIcon,
  Bold,
  Italic,
  Underline
} from 'lucide-react';

// Using relative imports for stability
import { Button } from './components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';
import { useFabric, ToolType, ToolSettings } from './hooks/useFabric';
import { cn } from './lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from './components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { Slider } from './components/ui/slider';

const PRESET_COLORS = [
  '#ff0000', // Red
  '#ff8c00', // Orange
  '#ffeb3b', // Yellow
  '#4caf50', // Green
  '#2196f3', // Blue
  '#9c27b0', // Purple
  '#000000', // Black
  '#ffffff', // White
];

const STROKE_STYLES = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
];

const TOOL_LABELS: Record<ToolType, string> = {
  select: 'Select',
  rectangle: 'Rectangle',
  arrow: 'Arrow',
  text: 'Text',
  step: 'Step',
  pen: 'Pen'
};

const hexToRgba = (hex: string, opacity: number) => {
  if (!hex || hex === 'transparent') return 'transparent';
  if (hex.startsWith('rgba')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const ColorGrid = ({ 
  selected, 
  onSelect, 
  includeTransparent = false 
}: { 
  selected: string, 
  onSelect: (color: string) => void,
  includeTransparent?: boolean
}) => (
  <div className="grid grid-cols-5 gap-2">
    {includeTransparent && (
      <button
        className={cn(
          "w-full aspect-square rounded-lg border border-border/50 transition-all hover:scale-110 active:scale-95 shadow-sm relative overflow-hidden",
          selected === 'transparent' ? "ring-2 ring-red-500 ring-offset-2 ring-offset-popover scale-105 shadow-md" : "hover:border-white/20"
        )}
        onClick={() => onSelect('transparent')}
      >
        <div className="absolute inset-0 bg-white" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[120%] h-[1px] bg-red-500 rotate-45" />
        </div>
      </button>
    )}
    {PRESET_COLORS.map(c => (
      <button
        key={c}
        className={cn(
          "w-full aspect-square rounded-lg border border-border/50 transition-all hover:scale-110 active:scale-95 shadow-sm",
          selected === c ? "ring-2 ring-red-500 ring-offset-2 ring-offset-popover scale-105 shadow-md" : "hover:border-white/20"
        )}
        style={{ backgroundColor: c }}
        onClick={() => onSelect(c)}
      />
    ))}
  </div>
);

const ToolSettingsPanel = ({ 
  tool, 
  settings, 
  onUpdate 
}: { 
  tool: ToolType, 
  settings: ToolSettings, 
  onUpdate: (tool: ToolType, updates: Partial<ToolSettings>) => void 
}) => {
  const isShape = tool === 'rectangle' || tool === 'arrow' || tool === 'pen';

  return (
    <div className="flex flex-col gap-6 p-6 w-72 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
      <div className="flex items-center justify-between border-b border-border/50 pb-2 -mb-2">
        <h3 className="text-xs font-black tracking-[0.2em] text-foreground/80 uppercase">
          {TOOL_LABELS[tool]}
        </h3>
      </div>

      {/* Stroke / Color Section */}
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {tool === 'text' || tool === 'step' ? 'Color' : 'Stroke Color'}
            </label>
            <div 
              className="w-3 h-3 rounded-full shadow-inner border border-border/50" 
              style={{ backgroundColor: hexToRgba(settings.color, settings.strokeOpacity) }} 
            />
          </div>
          <ColorGrid selected={settings.color} onSelect={(color) => onUpdate(tool, { color })} />
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {tool === 'text' || tool === 'step' ? 'Opacity' : 'Stroke Opacity'}
            </label>
            <span className="text-[10px] font-mono font-medium">{Math.round(settings.strokeOpacity * 100)}%</span>
          </div>
          <Slider 
            value={[settings.strokeOpacity * 100]} 
            max={100} 
            min={0}
            step={1} 
            onValueChange={(v) => onUpdate(tool, { strokeOpacity: v[0] / 100 })} 
          />
        </div>

        {isShape && (
          <>
            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Stroke Width</label>
                <span className="text-[10px] font-mono font-medium">{settings.strokeWidth}px</span>
              </div>
              <Slider 
                value={[settings.strokeWidth]} 
                min={1}
                max={30} 
                step={1} 
                onValueChange={(v) => onUpdate(tool, { strokeWidth: v[0] })} 
              />
            </div>

            <div className="space-y-3 pt-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Stroke Style</label>
              <div className="flex gap-2">
                {STROKE_STYLES.map((style) => (
                  <Button
                    key={style.label}
                    variant={settings.strokeStyle === style.value ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-8 text-[10px] uppercase font-bold tracking-tight"
                    onClick={() => onUpdate(tool, { strokeStyle: style.value as any })}
                  >
                    {style.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Fill Color Section (Rectangle only for now) */}
      {tool === 'rectangle' && (
        <div className="space-y-4 border-t border-border/50 pt-5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fill Color</label>
            <div className="w-3 h-3 rounded-full shadow-inner border border-border/50" style={{ backgroundColor: settings.fillColor }} />
          </div>
          <ColorGrid 
            selected={settings.fillColor} 
            onSelect={(fillColor) => onUpdate(tool, { fillColor, fillOpacity: fillColor === 'transparent' ? 0 : (settings.fillOpacity || 0.5) })} 
            includeTransparent 
          />
          {settings.fillColor !== 'transparent' && (
            <div className="space-y-2.5 pt-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Fill Opacity</span>
                <span className="text-[10px] font-mono font-medium">{Math.round(settings.fillOpacity * 100)}%</span>
              </div>
              <Slider 
                value={[settings.fillOpacity * 100]} 
                max={100} 
                min={0}
                step={1} 
                onValueChange={(v) => onUpdate(tool, { fillOpacity: v[0] / 100 })} 
              />
            </div>
          )}
        </div>
      )}

      {/* Text Style Section (Text tool only) */}
      {(tool === 'text' || tool === 'step') && (
        <div className="space-y-4 border-t border-border/50 pt-5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Text Style</label>
          <div className="flex gap-2">
            <Button
              variant={settings.fontWeight === 'bold' ? "default" : "outline"}
              size="sm"
              className="flex-1 h-10"
              onClick={() => onUpdate(tool, { fontWeight: settings.fontWeight === 'bold' ? 'normal' : 'bold' })}
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant={settings.fontStyle === 'italic' ? "default" : "outline"}
              size="sm"
              className="flex-1 h-10"
              onClick={() => onUpdate(tool, { fontStyle: settings.fontStyle === 'italic' ? 'normal' : 'italic' })}
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant={settings.underline ? "default" : "outline"}
              size="sm"
              className="flex-1 h-10"
              onClick={() => onUpdate(tool, { underline: !settings.underline })}
            >
              <Underline className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Font Size</span>
              <span className="text-[10px] font-mono font-medium">{Math.round(settings.fontSize)}px</span>
            </div>
            <Slider 
              value={[settings.fontSize]} 
              min={8}
              max={100} 
              step={1} 
              onValueChange={(v) => onUpdate(tool, { fontSize: v[0] })} 
            />
          </div>
        </div>
      )}

      {/* Rotation Section (Arrow only) */}
      {tool === 'arrow' && (
        <div className="space-y-4 border-t border-border/50 pt-5">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Angle</label>
              <span className="text-[10px] font-mono font-medium">{Math.round(settings.angle || 0)}°</span>
            </div>
            <Slider 
              value={[settings.angle || 0]} 
              min={0}
              max={360} 
              step={1} 
              onValueChange={(v) => onUpdate(tool, { angle: v[0] })} 
            />
          </div>
        </div>
      )}

      {/* Pen Mode Section (Pen only) */}
      {tool === 'pen' && (
        <div className="space-y-4 border-t border-border/50 pt-5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Drawing Mode</label>
          <div className="flex gap-2">
            <Button
              variant={!settings.lineMode ? "default" : "outline"}
              size="sm"
              className="flex-1 h-8 text-[10px] uppercase font-bold tracking-tight"
              onClick={() => onUpdate(tool, { lineMode: false })}
            >
              Freehand
            </Button>
            <Button
              variant={settings.lineMode ? "default" : "outline"}
              size="sm"
              className="flex-1 h-8 text-[10px] uppercase font-bold tracking-tight"
              onClick={() => onUpdate(tool, { lineMode: true })}
            >
              Straight
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const ToolbarButton = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick,
  danger,
  toolType,
  settings,
  onUpdateSettings,
  isOpen,
  onOpenChange
}: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  onClick: () => void,
  danger?: boolean,
  toolType?: ToolType,
  settings?: ToolSettings,
  onUpdateSettings?: (tool: ToolType, updates: Partial<ToolSettings>) => void,
  isOpen?: boolean,
  onOpenChange?: (open: boolean) => void
}) => {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant={active ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "w-12 h-12 rounded-xl transition-all relative group", 
                  active && "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/40",
                  danger && "hover:bg-red-500/20 hover:text-red-500"
                )}
                onClick={onClick}
              >
                <Icon className={cn("w-6 h-6 transition-transform group-hover:scale-110", active && "scale-105")} />
                {settings && (
                  <div className="absolute bottom-1 right-1 flex gap-0.5">
                    <div 
                      className="w-1.5 h-1.5 rounded-full border border-white/20 shadow-sm" 
                      style={{ backgroundColor: hexToRgba(settings.color, settings.strokeOpacity) }}
                    />
                    {settings.fillColor !== 'transparent' && (
                      <div 
                        className="w-1.5 h-1.5 rounded-full border border-white/20 shadow-sm" 
                        style={{ backgroundColor: hexToRgba(settings.fillColor, settings.fillOpacity) }}
                      />
                    )}
                  </div>
                )}
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="right" className="bg-popover text-popover-foreground border-border font-medium">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {settings && toolType && onUpdateSettings && (
        <PopoverContent 
          side="right" 
          align="start" 
          sideOffset={15}
          className="p-0 border-none bg-transparent shadow-none"
        >
          <ToolSettingsPanel 
            tool={toolType} 
            settings={settings} 
            onUpdate={onUpdateSettings} 
          />
        </PopoverContent>
      )}
    </Popover>
  );
};

function App() {
  const { 
    canvasRef, 
    fabricCanvas,
    activeTool, 
    setActiveTool, 
    toolSettings,
    updateToolSetting,
    clearCanvas, 
    deleteSelected,
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
  } = useFabric();
  
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>(
    (localStorage.getItem('theme') as any) || 'system'
  );

  const [openSettingsTool, setOpenSettingsTool] = React.useState<ToolType | null>(null);

  // ツールが自動・手動で切り替わった際に設定パネルを開く
  React.useEffect(() => {
    if (activeTool !== 'select') {
      setOpenSettingsTool(activeTool);
    } else {
      setOpenSettingsTool(null);
    }
  }, [activeTool]);

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleDownload = () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    
    const dataURL = canvas.toDataURL({
      format: 'png',
      multiplier: 2
    });
    
    const link = document.createElement('a');
    link.download = `screenshot-${new Date().getTime()}.png`;
    link.href = dataURL;
    link.click();
  };

  const handleCopy = async () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    
    canvas.discardActiveObject();
    canvas.renderAll();
    
    const dataURL = canvas.toDataURL({
      format: 'png'
    });
    
    try {
      const response = await fetch(dataURL);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans select-none">
      {/* Sidebar */}
      <aside className="w-20 border-r border-border flex flex-col items-center py-6 gap-4 bg-card z-50 shadow-xl">
        <div className="mb-6">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20 transition-transform hover:rotate-6">
            <ImageIcon className="text-white w-7 h-7" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ToolbarButton 
            icon={MousePointer2} 
            label="Select" 
            active={activeTool === 'select'} 
            onClick={() => {
              deselectAll();
              setActiveTool('select');
            }} 
          />
          <ToolbarButton 
            icon={Square} 
            label="Rectangle" 
            active={activeTool === 'rectangle'} 
            onClick={() => {
              if (activeTool !== 'rectangle') deselectAll();
              setActiveTool('rectangle');
            }} 
            toolType="rectangle"
            settings={toolSettings.rectangle}
            onUpdateSettings={updateToolSetting}
            isOpen={openSettingsTool === 'rectangle'}
            onOpenChange={(open) => setOpenSettingsTool(open ? 'rectangle' : null)}
          />
          <ToolbarButton 
            icon={ArrowUpRight} 
            label="Arrow" 
            active={activeTool === 'arrow'} 
            onClick={() => {
              if (activeTool !== 'arrow') deselectAll();
              setActiveTool('arrow');
            }} 
            toolType="arrow"
            settings={toolSettings.arrow}
            onUpdateSettings={updateToolSetting}
            isOpen={openSettingsTool === 'arrow'}
            onOpenChange={(open) => setOpenSettingsTool(open ? 'arrow' : null)}
          />
          <ToolbarButton 
            icon={Type} 
            label="Text" 
            active={activeTool === 'text'} 
            onClick={() => {
              if (activeTool !== 'text') deselectAll();
              setActiveTool('text');
            }} 
            toolType="text"
            settings={toolSettings.text}
            onUpdateSettings={updateToolSetting}
            isOpen={openSettingsTool === 'text'}
            onOpenChange={(open) => setOpenSettingsTool(open ? 'text' : null)}
          />
          <ToolbarButton 
            icon={Hash} 
            label="Step" 
            active={activeTool === 'step'} 
            onClick={() => {
              if (activeTool !== 'step') deselectAll();
              setActiveTool('step');
            }} 
            toolType="step"
            settings={toolSettings.step}
            onUpdateSettings={updateToolSetting}
            isOpen={openSettingsTool === 'step'}
            onOpenChange={(open) => setOpenSettingsTool(open ? 'step' : null)}
          />
          <ToolbarButton 
            icon={Pencil} 
            label="Pen" 
            active={activeTool === 'pen'} 
            onClick={() => {
              if (activeTool !== 'pen') deselectAll();
              setActiveTool('pen');
            }} 
            toolType="pen"
            settings={toolSettings.pen}
            onUpdateSettings={updateToolSetting}
            isOpen={openSettingsTool === 'pen'}
            onOpenChange={(open) => setOpenSettingsTool(open ? 'pen' : null)}
          />
        </div>

        <div className="mt-auto flex flex-col gap-3 pb-2">
          <ToolbarButton icon={RotateCcw} label="Clear All" onClick={clearCanvas} />
          <ToolbarButton icon={Trash2} label="Delete" onClick={deleteSelected} danger />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">Smart Screenshot Editor</h1>
          </div>
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={undo} 
                    disabled={!canUndo}
                    className="w-9 h-9 hover:bg-muted disabled:opacity-30"
                  >
                    <Undo2 className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={redo} 
                    disabled={!canRedo}
                    className="w-9 h-9 hover:bg-muted disabled:opacity-30"
                  >
                    <Redo2 className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="w-px h-6 bg-border mx-1" />

            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={zoomOut}
                disabled={zoom <= 0.1}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                className="h-7 px-2 text-xs font-mono font-medium" 
                onClick={resetZoom}
              >
                {Math.round(zoom * 100)}%
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={zoomIn}
                disabled={zoom >= 20}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-border mx-1" />

            <Button variant="secondary" size="sm" onClick={handleCopy} className="font-medium">
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-medium" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" /> Save
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9">
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" /> Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Monitor className="mr-2 h-4 w-4" /> System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div 
          className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-12"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              deselectAll();
              setActiveTool('select');
            }
          }}
        >
          <div className={cn(
            "relative transition-shadow duration-500",
            hasImage ? "shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]" : ""
          )}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-background/60 backdrop-blur-xl border border-border px-8 py-2.5 rounded-full text-sm text-muted-foreground shadow-lg">
          <span className="flex items-center gap-2">
            <kbd className="bg-red-600 px-1.5 py-0.5 rounded text-xs font-mono text-white">Ctrl + V</kbd>
            Paste image to edit
          </span>
        </div>
      </main>
    </div>
  );
}

export default App;
