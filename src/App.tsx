import React from 'react';
import { 
  MousePointer2, 
  Square, 
  ArrowUpRight, 
  Type, 
  Hash, 
  Ghost, 
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
  Search
} from 'lucide-react';

// Using relative imports for stability
import { Button } from './components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';
import { useFabric } from './hooks/useFabric';
import { cn } from './lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from './components/ui/dropdown-menu';

// Definition outside App to prevent re-creation and potential Hook issues
const ToolbarButton = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick,
  danger 
}: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  onClick: () => void,
  danger?: boolean
}) => (
  <TooltipProvider>
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "ghost"}
          size="icon"
          className={cn(
            "w-12 h-12 rounded-xl transition-all", 
            active && "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/40",
            danger && "hover:bg-red-500/20 hover:text-red-500"
          )}
          onClick={(e) => {
            onClick();
          }}
        >
          <Icon className="w-6 h-6" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="bg-popover text-popover-foreground border-border">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

function App() {
  const { 
    canvasRef, 
    fabricCanvas,
    activeTool, 
    setActiveTool, 
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
      <aside className="w-20 border-r border-border flex flex-col items-center py-6 gap-4 bg-card z-50">
        <div className="mb-6">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
            <ImageIcon className="text-white w-7 h-7" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <ToolbarButton icon={MousePointer2} label="Select" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
          <ToolbarButton icon={Square} label="Rectangle" active={activeTool === 'rectangle'} onClick={() => setActiveTool('rectangle')} />
          <ToolbarButton icon={ArrowUpRight} label="Arrow" active={activeTool === 'arrow'} onClick={() => setActiveTool('arrow')} />
          <ToolbarButton icon={Type} label="Text" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
          <ToolbarButton icon={Hash} label="Step" active={activeTool === 'step'} onClick={() => setActiveTool('step')} />
          <ToolbarButton icon={Ghost} label="Blur" active={activeTool === 'blur'} onClick={() => setActiveTool('blur')} />
          <ToolbarButton icon={Pencil} label="Pen" active={activeTool === 'pen'} onClick={() => setActiveTool('pen')} />
        </div>

        <div className="mt-auto flex flex-col gap-2 pb-2">
          <ToolbarButton icon={RotateCcw} label="Clear All" onClick={clearCanvas} />
          <ToolbarButton icon={Trash2} label="Delete" onClick={deleteSelected} danger />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">Smart Screenshot Editor</h1>
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
                    className="w-9 h-9 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
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
                    className="w-9 h-9 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
                  >
                    <Redo2 className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="w-px h-6 bg-white/10 mx-1" />

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
                className="h-7 px-2 text-xs font-mono" 
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

            <div className="w-px h-6 bg-white/10 mx-1" />

            <Button variant="secondary" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDownload}>
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
            // キャンバス自体やその中身以外の場所をクリックした判定
            if (e.target === e.currentTarget) {
              deselectAll();
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
