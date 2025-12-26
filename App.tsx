import React, { useState, useEffect, useRef, useCallback } from 'react';
import GoXPrintLogo from './components/GoXPrintLogo';
import { 
  Scissors,
  LayoutTemplate,
  ChevronLeft,
  Package,
  Settings, 
  Maximize, 
  Grid, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  List, 
  Filter, 
  Box, 
  ChevronDown, 
  DollarSign,
  RefreshCw, 
  Calculator, 
  ArrowRight, 
  Scroll, 
  StickyNote, 
  AlertCircle, 
  ChevronUp, 
  Plus, 
  X, 
  Trophy, 
  CheckCircle
} from 'lucide-react';

// ==========================================
// PAPER CALCULATOR COMPONENT
// ==========================================
const PaperCalculator: React.FC = () => {
  const [activeTab, setActiveTab] = useState('divide'); 
  const [showPreview, setShowPreview] = useState(true);

  // --- Global Inputs ---
  const [paper, setPaper] = useState({ w: 790, h: 1090 });
  const [paperPrice, setPaperPrice] = useState(0); // Giá tiền giấy lớn

  // --- Tab 1: Optimize Inputs ---
  const [item, setItem] = useState({ w: 210, h: 297 });

  // --- Tab 2: Divide Inputs ---
  const [targetQuantity, setTargetQuantity] = useState(11);
  const [minSize, setMinSize] = useState({ w: 200, h: 200 });
  const [maxSize, setMaxSize] = useState({ w: 330, h: 0 });
  const [selectedGrid, setSelectedGrid] = useState<any>(null);
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(3);

  // --- Results ---
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [divisionOptions, setDivisionOptions] = useState<any[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ==========================================
  // CORE ALGORITHM
  // ==========================================
  const getBestYield = useCallback((P_W: number, P_H: number, I_W: number, I_H: number) => {
      if (I_W <= 0 || I_H <= 0 || P_W < Math.min(I_W, I_H) || P_H < Math.min(I_W, I_H)) {
          return { total: 0, blocks: [], description: "N/A" };
      }

      const calcBlock = (areaW: number, areaH: number, iW: number, iH: number, rotated: boolean) => {
          if (areaW < iW || areaH < iH) return { count: 0, cols: 0, rows: 0, w: 0, h: 0 };
          const cols = Math.floor(areaW / iW);
          const rows = Math.floor(areaH / iH);
          return {
              count: cols * rows, cols, rows, itemW: iW, itemH: iH, rotated,
              x: 0, y: 0, width: cols * iW, height: rows * iH
          };
      };

      let best = { total: -1, blocks: [] as any[], description: "" };

      const update = (blocks: any[], desc: string) => {
          const total = blocks.reduce((acc, b) => acc + b.count, 0);
          if (total > best.total) {
              best = { total, blocks, description: desc };
          }
      };

      // 1. Simple Grid
      update([calcBlock(P_W, P_H, I_W, I_H, false)], "Tất cả Dọc");
      update([calcBlock(P_W, P_H, I_H, I_W, true)], "Tất cả Ngang");

      // 2. Vertical Cut
      const maxColsNorm = Math.floor(P_W / I_W);
      for (let c = 1; c <= maxColsNorm; c++) {
          const cutX = c * I_W;
          const b1 = calcBlock(cutX, P_H, I_W, I_H, false);
          const b2 = calcBlock(P_W - cutX, P_H, I_H, I_W, true);
          b2.x = cutX;
          update([b1, b2], `Dọc (${c} cột) + Ngang`);
      }

      const maxColsRot = Math.floor(P_W / I_H);
      for (let c = 1; c <= maxColsRot; c++) {
          const cutX = c * I_H;
          const b1 = calcBlock(cutX, P_H, I_H, I_W, true);
          const b2 = calcBlock(P_W - cutX, P_H, I_W, I_H, false);
          b2.x = cutX;
          update([b1, b2], `Ngang (${c} cột) + Dọc`);
      }

      // 3. Horizontal Cut
      const maxRowsNorm = Math.floor(P_H / I_H);
      for (let r = 1; r <= maxRowsNorm; r++) {
          const cutY = r * I_H;
          const b1 = calcBlock(P_W, cutY, I_W, I_H, false);
          const b2 = calcBlock(P_W, P_H - cutY, I_H, I_W, true);
          b2.y = cutY;
          update([b1, b2], `Dọc (${r} hàng) + Ngang`);
      }

      const maxRowsRot = Math.floor(P_H / I_W);
      for (let r = 1; r <= maxRowsRot; r++) {
          const cutY = r * I_W;
          const b1 = calcBlock(P_W, cutY, I_H, I_W, true);
          const b2 = calcBlock(P_W, P_H - cutY, I_W, I_H, false);
          b2.y = cutY;
          update([b1, b2], `Ngang (${r} hàng) + Dọc`);
      }

      return best;
  }, []);

  // ==========================================
  // CALCULATE WASTE
  // ==========================================
  const calculateWaste = (paperW: number, paperH: number, blocks: any[]) => {
      let maxX = 0;
      let maxY = 0;
      
      blocks.forEach(b => {
          if (b.count > 0) {
              const right = b.x + b.width;
              const bottom = b.y + b.height;
              if (right > maxX) maxX = right;
              if (bottom > maxY) maxY = bottom;
          }
      });

      const wastes = [];
      if (paperW - maxX > 1) { 
          wastes.push({ w: paperW - maxX, h: paperH, label: 'Thừa Phải' });
      }
      if (paperH - maxY > 1) {
           wastes.push({ w: maxX, h: paperH - maxY, label: 'Thừa Dưới' });
      }
      return wastes;
  };

  // ==========================================
  // LOGIC 1: OPTIMIZE
  // ==========================================
  const calculateOptimization = () => {
    const P_W = Number(paper.w);
    const P_H = Number(paper.h);
    const I_W = Number(item.w);
    const I_H = Number(item.h);

    if (P_W <= 0 || P_H <= 0 || !I_W || !I_H) return;

    const result = getBestYield(P_W, P_H, I_W, I_H);
    if (result.total === 0) {
        setOptimizationResult({ error: "Kích thước sản phẩm quá lớn!" });
    } else {
        setOptimizationResult(result);
    }
  };

  // ==========================================
  // LOGIC 2: DIVIDE
  // ==========================================
  const calculateDivisionOptions = () => {
      const P_W = Number(paper.w);
      const P_H = Number(paper.h);
      const Qty = parseInt(String(targetQuantity));
      
      if (P_W <= 0 || P_H <= 0 || !Qty || Qty <= 0) {
          setDivisionOptions([]); return;
      }

      const startW = Math.max(1, Number(minSize.w) || 1);
      const endW = Number(maxSize.w) > 0 ? Math.min(Number(maxSize.w), P_W) : P_W;
      
      const startH = Math.max(1, Number(minSize.h) || 1);
      const endH = Number(maxSize.h) > 0 ? Math.min(Number(maxSize.h), P_H) : P_H;

      const step = 0.5;
      let foundOptions = [];

      for (let w = startW; w <= endW; w += step) {
          let low = startH;
          let high = endH;
          let bestHForThisW = -1;
          let bestResult = null;

          while (low <= high) {
              const mid = Math.floor(((low + high) / 2) / step) * step;
              if (mid < startH) break;

              const result = getBestYield(P_W, P_H, w, mid);
              
              if (result.total >= Qty) {
                  bestHForThisW = mid;
                  bestResult = result;
                  low = mid + step; 
              } else {
                  high = mid - step; 
              }
          }

          if (bestHForThisW !== -1 && bestResult) {
              const area = w * bestHForThisW;
              const isDup = foundOptions.some(o => Math.abs(o.w - w) < 0.1 && Math.abs(o.h - bestHForThisW) < 0.1);
              
              if (!isDup) {
                  const wastes = calculateWaste(P_W, P_H, bestResult.blocks);
                  foundOptions.push({
                      id: `opt-${w}-${bestHForThisW}`,
                      w: parseFloat(w.toFixed(1)),
                      h: parseFloat(bestHForThisW.toFixed(1)),
                      area: area,
                      label: bestResult.description,
                      totalYield: bestResult.total, 
                      wastes: wastes 
                  });
              }
          }
      }

      foundOptions.sort((a, b) => b.area - a.area);
      
      setDivisionOptions(foundOptions);
      setVisibleCount(3); 

      if (foundOptions.length > 0) {
          handleSelectGrid(foundOptions[0]);
      } else {
          setSelectedGrid(null);
      }
  };

  const handleSelectGrid = (opt: any) => {
      const P_W = Number(paper.w);
      const P_H = Number(paper.h);
      const res = getBestYield(P_W, P_H, opt.w, opt.h);
      
      setSelectedGrid({
          ...opt,
          blocks: res.blocks
      });
  };

  useEffect(() => { if (activeTab === 'optimize') calculateOptimization(); }, [paper, item, activeTab, getBestYield]);
  useEffect(() => { 
      if (activeTab === 'divide') {
          const timer = setTimeout(() => calculateDivisionOptions(), 300);
          return () => clearTimeout(timer);
      }
  }, [paper, targetQuantity, minSize, maxSize, activeTab, getBestYield]);

  useEffect(() => {
      if (!showPreview || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const P_W = Number(paper.w);
      const P_H = Number(paper.h);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!P_W || !P_H) return;

      const scaleX = canvas.width / P_W;
      const scaleY = canvas.height / P_H;
      const scale = Math.min(scaleX, scaleY) * 0.9;
      const drawW = P_W * scale;
      const drawH = P_H * scale;
      const startX = (canvas.width - drawW) / 2;
      const startY = (canvas.height - drawH) / 2;
      
      ctx.fillStyle = '#f0f0f0'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.fillRect(startX, startY, drawW, drawH); ctx.strokeRect(startX, startY, drawW, drawH);
      
      const drawCell = (x: number, y: number, w: number, h: number, color: string) => {
          ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, w, h);
      };

      const blocksToRender = activeTab === 'optimize' 
          ? (optimizationResult && !optimizationResult.error ? optimizationResult.blocks : [])
          : (activeTab === 'divide' && selectedGrid ? selectedGrid.blocks : []);

      blocksToRender?.forEach((block: any, idx: number) => {
          const bX = startX + (block.x * scale);
          const bY = startY + (block.y * scale);
          const cellW = block.itemW * scale;
          const cellH = block.itemH * scale;
          let color = '#3b82f6';
          if (activeTab === 'divide') color = idx === 0 ? '#f59e0b' : '#10b981';
          else if (idx > 0) color = '#10b981';

          for(let r=0; r<block.rows; r++) {
              for(let c=0; c<block.cols; c++) {
                  drawCell(bX + c*cellW, bY + r*cellH, cellW, cellH, color);
              }
          }
      });
  }, [paper, activeTab, optimizationResult, selectedGrid, showPreview]);

  return (
    <div className="bg-gray-50 text-gray-800 font-sans pb-10 min-h-full">
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-600" />
            Tính Khổ Giấy
          </h1>
          <button onClick={() => setShowPreview(!showPreview)} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition">
            {showPreview ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
            <Maximize className="w-4 h-4" /> Khổ Giấy Lớn (mm)
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Chiều Dài</label>
              <input type="number" value={paper.w} onChange={(e) => setPaper({...paper, w: Number(e.target.value)})} className="w-full text-lg font-medium p-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Chiều Rộng</label>
              <input type="number" value={paper.h} onChange={(e) => setPaper({...paper, h: Number(e.target.value)})} className="w-full text-lg font-medium p-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition" />
            </div>
          </div>
          
          <div className="pt-3 border-t border-gray-100">
             <div className="relative">
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Giá giấy lớn (VNĐ)
                </label>
                <input 
                    type="number" 
                    value={paperPrice || ''} 
                    onChange={(e) => setPaperPrice(Number(e.target.value))}
                    placeholder="VD: 5000"
                    className="w-full text-lg font-medium p-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition text-emerald-600" 
                />
             </div>
          </div>
        </div>

        <div className="flex p-1 bg-gray-200 rounded-lg mb-4">
          <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'optimize' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('optimize')}>
            Tối ưu cắt (Nhập Size)
          </button>
          <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'divide' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('divide')}>
            Chia số lượng
          </button>
        </div>

        {activeTab === 'optimize' && (
          <div className="animate-in fade-in duration-300">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
                <div className="flex justify-between items-center mb-3">
                   <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase"><Settings className="w-4 h-4" /> Thành phẩm (mm)</div>
                   <button onClick={() => setItem({ w: item.h, h: item.w })} className="text-xs flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"><RotateCcw className="w-3 h-3" /> Đổi chiều</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs text-gray-500 mb-1">Dài</label><input type="number" value={item.w} onChange={(e) => setItem({...item, w: Number(e.target.value)})} className="w-full text-lg font-medium p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">Rộng</label><input type="number" value={item.h} onChange={(e) => setItem({...item, h: Number(e.target.value)})} className="w-full text-lg font-medium p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                </div>
            </div>

            {optimizationResult && !optimizationResult.error ? (
                <div className="bg-blue-600 text-white p-5 rounded-xl shadow-lg mb-4 text-center">
                    <div className="text-blue-100 text-xs uppercase font-bold tracking-wider mb-1">Số lượng tối đa</div>
                    <div className="text-5xl font-bold mb-2">{optimizationResult.total} <span className="text-xl font-normal">con</span></div>
                    <div className="flex justify-center gap-4 text-sm text-blue-100 border-t border-blue-500 pt-2 mt-2">
                        <span>{optimizationResult.description}</span>
                    </div>
                    {paperPrice > 0 && optimizationResult.total > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-500/50">
                            <div className="text-blue-200 text-xs uppercase mb-1">Giá thành phẩm</div>
                            <div className="text-xl font-bold">
                                {Math.round(paperPrice / optimizationResult.total).toLocaleString('vi-VN')} đ<span className="text-sm font-normal">/con</span>
                            </div>
                        </div>
                    )}
                </div>
            ) : optimizationResult?.error ? (
                 <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center border border-red-100">{optimizationResult.error}</div>
            ) : null}
          </div>
        )}

        {activeTab === 'divide' && (
          <div className="animate-in fade-in duration-300">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 uppercase">
                     <List className="w-4 h-4" /> Số lượng & Bộ lọc
                </div>
                <div className="relative mb-4">
                    <input type="number" value={targetQuantity} onChange={(e) => setTargetQuantity(Math.max(1, parseInt(e.target.value) || 0))} className="w-full text-3xl font-bold p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center text-blue-600" />
                    <div className="text-center text-xs text-gray-400 mt-2">Tìm kích thước lớn nhất cho số lượng này</div>
                </div>
                
                <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                        <Filter className="w-3 h-3" /> Bộ lọc kích thước (Min - Max):
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                         <div className="relative">
                             <label className="block text-[10px] text-gray-400 mb-1 text-center">Min Dài</label>
                            <input type="number" placeholder="Min W" value={minSize.w || ''} onChange={(e) => setMinSize({...minSize, w: Number(e.target.value)})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none text-center" />
                         </div>
                         <div className="relative">
                             <label className="block text-[10px] text-gray-400 mb-1 text-center">Max Dài</label>
                            <input type="number" placeholder="Max W" value={maxSize.w || ''} onChange={(e) => setMaxSize({...maxSize, w: Number(e.target.value)})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none text-center" />
                         </div>
                         <div className="relative">
                             <label className="block text-[10px] text-gray-400 mb-1 text-center">Min Rộng</label>
                            <input type="number" placeholder="Min H" value={minSize.h || ''} onChange={(e) => setMinSize({...minSize, h: Number(e.target.value)})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none text-center" />
                         </div>
                         <div className="relative">
                             <label className="block text-[10px] text-gray-400 mb-1 text-center">Max Rộng</label>
                            <input type="number" placeholder="Max H" value={maxSize.h || ''} onChange={(e) => setMaxSize({...maxSize, h: Number(e.target.value)})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none text-center" />
                         </div>
                    </div>
                </div>
            </div>

             {divisionOptions.length > 0 ? (
                <div className="space-y-3">
                    <div className="text-xs font-bold text-gray-400 uppercase ml-1 flex justify-between">
                        <span>Kết quả tối ưu nhất:</span>
                        <span>{divisionOptions.length} phương án</span>
                    </div>
                    
                    {divisionOptions.slice(0, visibleCount).map((opt, idx) => (
                        <button key={opt.id} onClick={() => handleSelectGrid(opt)} className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex justify-between items-start ${selectedGrid?.id === opt.id ? 'bg-amber-50 border-amber-500 shadow-md ring-1 ring-amber-500' : 'bg-white border-gray-100 hover:border-amber-300'}`}>
                            <div className="flex-1">
                                <div className={`text-xs font-bold uppercase tracking-wider mb-1 flex items-center ${selectedGrid?.id === opt.id ? 'text-amber-600' : 'text-gray-400'}`}>
                                    {idx === 0 && <span className="bg-red-100 text-red-600 px-1 rounded mr-2">Top 1</span>}
                                    {opt.label}
                                </div>
                                <div className="text-2xl font-bold text-gray-800 leading-tight mb-2">
                                    {opt.w.toFixed(1)} <span className="text-gray-400 text-sm">x</span> {opt.h.toFixed(1)} <span className="text-xs font-normal text-gray-500">mm</span>
                                </div>
                                <div className="text-xs text-gray-500 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-blue-600">Tổng số: {opt.totalYield} con</span>
                                        <span className="text-gray-300">|</span>
                                        <span>Diện tích: {Math.round(opt.area/100)/10} cm²</span>
                                    </div>
                                    {paperPrice > 0 && opt.totalYield > 0 && (
                                         <div className="text-emerald-600 font-bold">
                                            Giá: {Math.round(paperPrice / opt.totalYield).toLocaleString('vi-VN')} đ/con
                                         </div>
                                    )}
                                    {opt.wastes.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {opt.wastes.map((waste: any, wIdx: number) => (
                                                <span key={wIdx} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                                    {waste.label}: {waste.w.toFixed(1)} x {waste.h.toFixed(1)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {selectedGrid?.id === opt.id && <div className="text-amber-500"><Eye className="w-5 h-5" /></div>}
                        </button>
                    ))}

                    {visibleCount < divisionOptions.length && (
                        <button 
                            onClick={() => setVisibleCount(prev => prev + 3)}
                            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
                        >
                            <ChevronDown className="w-4 h-4" /> Xem thêm {Math.min(3, divisionOptions.length - visibleCount)} phương án
                        </button>
                    )}
                </div>
             ) : (
                 <div className="text-center text-gray-400 py-8 bg-white rounded-xl border border-dashed border-gray-300">
                     <p>Đang tìm kiếm hoặc không tìm thấy...</p>
                     <p className="text-xs mt-1">(Thử điều chỉnh kích thước Min/Max)</p>
                 </div>
             )}
          </div>
        )}

        <div className={`transition-all duration-300 ${showPreview ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0 overflow-hidden'} mt-4`}>
             <div className="bg-gray-800 p-2 rounded-t-xl flex justify-between items-center px-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mô phỏng cắt</span>
                <div className="flex gap-3 text-xs">
                     {activeTab === 'optimize' ? (
                        <>
                             {optimizationResult?.blocks.length > 1 && (
                                <>
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Cụm 1</div>
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Cụm 2</div>
                                </>
                             )}
                        </>
                     ) : (
                         <>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded-sm"></div> {selectedGrid?.blocks?.length > 1 ? 'Cụm 1' : 'Sản phẩm'}</div>
                            {selectedGrid?.blocks?.length > 1 && <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Cụm 2</div>}
                         </>
                     )}
                </div>
             </div>
             <div className="bg-gray-200 p-4 rounded-b-xl flex justify-center overflow-hidden border-2 border-gray-800 border-t-0">
                <canvas ref={canvasRef} width={600} height={400} className="w-full h-auto max-w-full shadow-lg bg-white" />
             </div>
        </div>
        <div className="mt-8 text-center text-xs text-gray-400">Hỗ trợ tính toán cắt bù hao • Tối ưu hiển thị mobile</div>
      </div>
    </div>
  );
};

// ==========================================
// MATERIAL CALCULATOR COMPONENTS
// ==========================================

// Input số tối ưu cho mobile
const NumberInput = ({ value, onChange, className, placeholder, suffix, label, ...props }: any) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '').replace(/,/g, '.');
    if (rawValue === '') { onChange(0); return; }
    const numberValue = parseFloat(rawValue);
    if (!isNaN(numberValue)) onChange(numberValue);
  };

  const displayValue = value !== undefined && value !== null 
    ? value.toLocaleString('vi-VN', { maximumFractionDigits: 10 }) 
    : '';

  return (
    <div className="relative w-full group">
      {label && <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">{label}</label>}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          className={`w-full p-3 pl-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none font-semibold text-gray-800 ${className}`}
          placeholder={placeholder}
          {...props}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

// Toggle Switcher lớn
const ModeSwitcher = ({ mode, setMode }: any) => (
  <div className="bg-gray-100 p-1.5 rounded-2xl flex relative mb-6">
    <div 
      className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out ${mode === 'sheet' ? 'left-1.5' : 'left-[calc(50%+3px)]'}`} 
    />
    <button 
      onClick={() => setMode('sheet')}
      className={`flex-1 py-3 relative z-10 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'sheet' ? 'text-blue-600' : 'text-gray-500'}`}
    >
      <StickyNote className="w-4 h-4" /> Dạng Tờ
    </button>
    <button 
      onClick={() => setMode('roll')}
      className={`flex-1 py-3 relative z-10 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'roll' ? 'text-blue-600' : 'text-gray-500'}`}
    >
      <Scroll className="w-4 h-4" /> Dạng Cuộn
    </button>
  </div>
);

const MaterialCalculator: React.FC = () => {
  const [mode, setMode] = useState('sheet'); 
  const [showPreview, setShowPreview] = useState(true);
  
  // Inputs
  const [product, setProduct] = useState({ w: 210, h: 148, qty: 1000 });
  const [sheetMaterial, setSheetMaterial] = useState({ w: 790, h: 1090, price: 2000 });
  
  // Roll Material: Hỗ trợ multi-width
  const [rollMaterial, setRollMaterial] = useState({ 
    widths: [500], 
    price: 100, 
    areaPrice: 200000, 
    priceMode: 'area' 
  }); 
  
  // Results
  const [results, setResults] = useState<any[]>([]); 
  const [selectedResultIndex, setSelectedResultIndex] = useState(0); 
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper: Quản lý khổ cuộn
  const addRollWidth = () => setRollMaterial((prev: any) => ({ ...prev, widths: [...prev.widths, 0] }));
  const updateRollWidth = (idx: number, val: number) => {
    const newWidths = [...rollMaterial.widths];
    newWidths[idx] = val;
    setRollMaterial((prev: any) => ({ ...prev, widths: newWidths }));
  };
  const removeRollWidth = (idx: number) => {
    if (rollMaterial.widths.length <= 1) return;
    const newWidths = rollMaterial.widths.filter((_, i) => i !== idx);
    setRollMaterial((prev: any) => ({ ...prev, widths: newWidths }));
  };

  // --- Algorithms ---
  const calculateSheetYield = useCallback((P_W: number, P_H: number, I_W: number, I_H: number) => {
      if (I_W <= 0 || I_H <= 0 || P_W < Math.min(I_W, I_H) || P_H < Math.min(I_W, I_H)) return { count: 0, blocks: [], description: "N/A" };
      
      const calcBlock = (areaW: number, areaH: number, iW: number, iH: number, rotated: boolean) => {
          if (areaW < iW || areaH < iH) return { count: 0, cols: 0, rows: 0, w: 0, h: 0 };
          const cols = Math.floor(areaW / iW);
          const rows = Math.floor(areaH / iH);
          return { count: cols * rows, cols, rows, itemW: iW, itemH: iH, rotated, x: 0, y: 0, width: cols * iW, height: rows * iH };
      };

      let best = { count: 0, blocks: [] as any[], description: "" };
      const update = (blocks: any[], desc: string) => {
          const total = blocks.reduce((acc, b) => acc + b.count, 0);
          if (total > best.count) best = { count: total, blocks, description: desc };
      };

      update([calcBlock(P_W, P_H, I_W, I_H, false)], "Dọc");
      update([calcBlock(P_W, P_H, I_H, I_W, true)], "Ngang");

      const maxColsNorm = Math.floor(P_W / I_W);
      for (let c = 1; c <= maxColsNorm; c++) {
          const cutX = c * I_W;
          const b1 = calcBlock(cutX, P_H, I_W, I_H, false);
          const b2 = calcBlock(P_W - cutX, P_H, I_H, I_W, true); b2.x = cutX;
          update([b1, b2], `Mix Dọc (${c}) + Ngang`);
      }
      const maxRowsNorm = Math.floor(P_H / I_H);
      for (let r = 1; r <= maxRowsNorm; r++) {
          const cutY = r * I_H;
          const b1 = calcBlock(P_W, cutY, I_W, I_H, false);
          const b2 = calcBlock(P_W, P_H - cutY, I_H, I_W, true); b2.y = cutY;
          update([b1, b2], `Mix Dọc (${r}) + Ngang`);
      }
      return best;
  }, []);

  const calculateRollUsage = useCallback((RollW: number, I_W: number, I_H: number, Qty: number) => {
    if (RollW < Math.min(I_W, I_H)) return null;
    let bestConfig = null; let maxDensity = -1;
    const maxColsA = Math.floor(RollW / I_W);
    for (let nA = 0; nA <= maxColsA; nA++) {
        const remainingW = RollW - (nA * I_W);
        const nB = Math.floor(remainingW / I_H);
        const density = (nA / I_H) + (nB / I_W);
        if (density > maxDensity) { maxDensity = density; bestConfig = { nA, nB }; }
    }
    if (!bestConfig || maxDensity <= 0) return null;
    const { nA, nB } = bestConfig;
    const totalLength = Math.ceil(Qty / maxDensity);
    const blocks = [];
    if (nA > 0) blocks.push({ type: 'normal', x: 0, y: 0, cols: nA, rows: 1, itemW: I_W, itemH: I_H, width: nA * I_W, height: I_H });
    if (nB > 0) blocks.push({ type: 'rotated', x: nA * I_W, y: 0, cols: nB, rows: 1, itemW: I_H, itemH: I_W, width: nB * I_H, height: I_W });
    let desc = nA > 0 && nB === 0 ? "Dọc toàn bộ" : nA === 0 && nB > 0 ? "Ngang toàn bộ" : `Mix: ${nA} Dọc + ${nB} Ngang`;
    return { totalLength, blocks, description: desc, wasteW: RollW - ((nA * I_W) + (nB * I_H)), density: maxDensity, itemsPerMeter: maxDensity * 1000 };
  }, []);

  // --- Effect: Calculate ---
  useEffect(() => {
    const prodW = parseFloat(String(product.w)), prodH = parseFloat(String(product.h)), qty = parseInt(String(product.qty)) || 1;
    if (!prodW || !prodH) { setResults([]); return; }

    if (mode === 'sheet') {
        const matW = parseFloat(String(sheetMaterial.w)), matH = parseFloat(String(sheetMaterial.h));
        if (!matW || !matH) { setResults([]); return; }
        const yieldData = calculateSheetYield(matW, matH, prodW, prodH);
        
        if (yieldData.count > 0) {
            const sheetsNeeded = Math.ceil(qty / yieldData.count);
            const totalCost = sheetsNeeded * sheetMaterial.price;
            setResults([{ 
                type: 'sheet', 
                id: 'sheet-1',
                yieldPerUnit: yieldData.count, 
                totalMaterial: sheetsNeeded, 
                totalCost, 
                costPerItem: totalCost / qty, 
                blocks: yieldData.blocks, 
                description: yieldData.description, 
                materialInfo: sheetMaterial,
                isBest: true 
            }]);
            setSelectedResultIndex(0);
        } else {
             setResults([{ error: "Sản phẩm lớn hơn khổ giấy!" }]);
             setSelectedResultIndex(0);
        }
    } else {
        // ROLL MODE: Loop through all widths
        const calculatedOptions: any[] = [];
        
        rollMaterial.widths.forEach((width, idx) => {
             const matW = parseFloat(String(width));
             if (!matW) return;
             
             const usageData = calculateRollUsage(matW, prodW, prodH, qty);
             if (usageData) {
                 let pricePerMeter = rollMaterial.priceMode === 'area' 
                    ? rollMaterial.areaPrice * (matW / 1000) 
                    : rollMaterial.price; 
                 
                 const totalCost = usageData.totalLength * (pricePerMeter / 1000);
                 
                 calculatedOptions.push({
                     type: 'roll',
                     id: `roll-${idx}`,
                     yieldPerUnit: Math.round(usageData.itemsPerMeter * 100) / 100,
                     totalMaterial: usageData.totalLength / 1000,
                     totalCost: totalCost,
                     costPerItem: totalCost / qty,
                     blocks: usageData.blocks,
                     description: usageData.description,
                     materialInfo: { ...rollMaterial, w: matW }, // width riêng từng option
                     wasteW: usageData.wasteW,
                     widthLabel: matW
                 });
             }
        });

        if (calculatedOptions.length > 0) {
            // Sort by Total Cost ASC
            calculatedOptions.sort((a, b) => a.totalCost - b.totalCost);
            // Mark best option
            calculatedOptions[0].isBest = true;
            
            setResults(calculatedOptions);
            setSelectedResultIndex(0); // Mặc định chọn cái tốt nhất
        } else {
            setResults([{ error: "Không tìm thấy khổ phù hợp hoặc chưa nhập khổ!" }]);
            setSelectedResultIndex(0);
        }
    }
  }, [mode, product, sheetMaterial, rollMaterial, calculateSheetYield, calculateRollUsage]);

  // --- Effect: Canvas Draw ---
  useEffect(() => {
      const activeResult = results[selectedResultIndex];
      if (!showPreview || !canvasRef.current || !activeResult || activeResult.error) return;
      
      const isSheet = activeResult.type === 'sheet';
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let drawW = activeResult.materialInfo.w, drawH = isSheet ? activeResult.materialInfo.h : (activeResult.blocks?.[0]?.itemH || 100) * 2.5;
      const margin = 20, availW = canvas.width - margin * 2, availH = canvas.height - margin * 2, scale = Math.min(availW / drawW, availH / drawH);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const originX = (canvas.width - drawW * scale) / 2, originY = (canvas.height - drawH * scale) / 2;

      // Draw Background
      ctx.fillStyle = isSheet ? '#fff' : '#f8fafc';
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
      if (isSheet) {
          ctx.shadowColor = "rgba(0,0,0,0.1)"; ctx.shadowBlur = 15; ctx.shadowOffsetY = 5;
          ctx.fillRect(originX, originY, drawW * scale, drawH * scale);
          ctx.shadowColor = "transparent";
          ctx.strokeRect(originX, originY, drawW * scale, drawH * scale);
      } else {
          const rollH = drawH * scale, rollW = drawW * scale;
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(originX, originY, rollW, rollH);
          ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(originX, originY + rollH); ctx.moveTo(originX + rollW, originY); ctx.lineTo(originX + rollW, originY + rollH); ctx.stroke();
          ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(originX, originY + rollH); ctx.lineTo(originX + rollW, originY + rollH); ctx.stroke(); ctx.setLineDash([]);
      }

      // Draw Blocks
      const drawCell = (x: number, y: number, w: number, h: number, color: string) => {
          ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, w, h);
      };

      if (activeResult.blocks) {
          activeResult.blocks.forEach((block: any, bIdx: number) => {
              const bX = originX + (block.x * scale), bY = originY + (block.y * scale);
              const cellW = block.itemW * scale, cellH = block.itemH * scale;
              const color = bIdx === 0 ? '#60a5fa' : '#34d399'; 
              if (isSheet) {
                  for (let r = 0; r < block.rows; r++) for (let c = 0; c < block.cols; c++) drawCell(bX + c * cellW, bY + r * cellH, cellW, cellH, color);
              } else {
                  const rowsToDraw = Math.ceil(drawH / block.itemH) + 1;
                  for (let r = 0; r < rowsToDraw; r++) for (let c = 0; c < block.cols; c++) {
                      const cellY = originY + (r * cellH) - (cellH * 0.5); 
                      if (cellY + cellH > originY && cellY < originY + drawH * scale) drawCell(bX + c * cellW, cellY, cellW, cellH, color);
                  }
              }
          });
      }
      ctx.fillStyle = '#64748b'; ctx.font = '500 11px Inter, sans-serif';
      ctx.fillText(`${drawW}mm`, originX, originY - 6);
  }, [results, selectedResultIndex, showPreview]);

  const activeResult = results[selectedResultIndex];

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans pb-28">
      {/* 1. Mobile Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-blue-200 shadow-md">
            <Calculator className="w-5 h-5" />
          </div>
          Tính Vật Tư
        </h1>
        <div className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md">v2.1</div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6">
        <ModeSwitcher mode={mode} setMode={setMode} />

        {/* 3. Product Input Card */}
        <div className="space-y-6">
            <section className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                    <Box className="w-3 h-3" /> Sản phẩm (Thành phẩm)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="Chiều Dài" value={product.w} onChange={(v: number) => setProduct({...product, w: v})} suffix="mm" />
                    <NumberInput label="Chiều Rộng" value={product.h} onChange={(v: number) => setProduct({...product, h: v})} suffix="mm" />
                </div>
                <div className="flex gap-3">
                    <div className="flex-1">
                        <NumberInput label="Số lượng cần" value={product.qty} onChange={(v: number) => setProduct({...product, qty: v})} suffix="cái" className="text-blue-600 font-bold" />
                    </div>
                    <button 
                        onClick={() => setProduct({...product, w: product.h, h: product.w})} 
                        className="w-12 h-[50px] mt-[26px] bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
                        title="Đảo chiều"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </section>

            {/* 4. Material Input Card */}
            <section className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                    <Settings className="w-3 h-3" /> {mode === 'sheet' ? 'Khổ Giấy Nguyên Liệu' : 'Khổ Cuộn Nguyên Liệu'}
                </h3>
                
                {mode === 'sheet' ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <NumberInput label="Khổ Dài" value={sheetMaterial.w} onChange={(v: number) => setSheetMaterial({...sheetMaterial, w: v})} suffix="mm" />
                            <NumberInput label="Khổ Rộng" value={sheetMaterial.h} onChange={(v: number) => setSheetMaterial({...sheetMaterial, h: v})} suffix="mm" />
                        </div>
                        <NumberInput label="Giá nhập (tờ lớn)" value={sheetMaterial.price} onChange={(v: number) => setSheetMaterial({...sheetMaterial, price: v})} suffix="đ" className="text-emerald-600" />
                    </>
                ) : (
                    <>
                         {/* Multi-Width Inputs */}
                        <div className="space-y-2 mb-4">
                            <label className="block text-xs font-medium text-gray-500">Khổ Rộng (Nhập nhiều để so sánh)</label>
                            {rollMaterial.widths.map((w, idx) => (
                                <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-bottom-2 duration-300">
                                    <NumberInput 
                                        value={w} 
                                        onChange={(val: number) => updateRollWidth(idx, val)} 
                                        suffix="mm" 
                                        className="font-bold"
                                    />
                                    {rollMaterial.widths.length > 1 && (
                                        <button 
                                            onClick={() => removeRollWidth(idx)}
                                            className="w-10 h-[50px] bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button 
                                onClick={addRollWidth}
                                className="w-full py-2 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-500 transition-colors text-sm font-semibold"
                            >
                                <Plus className="w-4 h-4" /> Thêm khổ khác
                            </button>
                        </div>
                        
                        <div className="bg-gray-50 p-1 rounded-xl flex mb-2">
                             <button onClick={() => setRollMaterial({...rollMaterial, priceMode: 'area'})} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${rollMaterial.priceMode === 'area' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Giá theo m²</button>
                             <button onClick={() => setRollMaterial({...rollMaterial, priceMode: 'linear'})} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${rollMaterial.priceMode === 'linear' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Giá theo md</button>
                        </div>

                        {rollMaterial.priceMode === 'area' ? (
                            <div className="space-y-2">
                                <NumberInput label="Đơn giá m²" value={rollMaterial.areaPrice} onChange={(v: number) => setRollMaterial({...rollMaterial, areaPrice: v})} suffix="đ/m²" className="text-emerald-600" />
                                {activeResult && activeResult.type === 'roll' && (
                                    <div className="text-[10px] text-gray-400 px-2 flex items-center gap-1">
                                        <ArrowRight className="w-3 h-3" /> 
                                        Đang xem khổ {activeResult.widthLabel}mm: {((rollMaterial.areaPrice * activeResult.widthLabel) / 1000).toLocaleString('vi-VN')} đ/md
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <NumberInput label="Đơn giá mét dài" value={rollMaterial.price} onChange={(v: number) => setRollMaterial({...rollMaterial, price: v})} suffix="đ/md" className="text-emerald-600" />
                                <div className="text-[10px] text-amber-500 px-2 mt-1">
                                    *Lưu ý: Giá md này sẽ áp dụng cho tất cả các khổ đang nhập.
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>
        
            {/* 5. Compare Results & Preview */}
            {activeResult && !activeResult.error && (
                <section className="pt-2">
                    {/* Comparison List (Only for Roll Multi-Width) */}
                    {mode === 'roll' && results.length > 1 && (
                        <div className="mb-4 space-y-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">So sánh phương án</h3>
                            {results.map((res, idx) => (
                                <div 
                                    key={res.id}
                                    onClick={() => setSelectedResultIndex(idx)}
                                    className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${idx === selectedResultIndex ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${res.isBest ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {res.isBest ? <Trophy className="w-4 h-4" /> : idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">Khổ {res.widthLabel}mm</div>
                                            <div className="text-xs text-gray-500">{res.yieldPerUnit} con/m</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold text-sm ${res.isBest ? 'text-blue-600' : 'text-gray-600'}`}>
                                            {Math.round(res.costPerItem).toLocaleString('vi-VN')} đ
                                        </div>
                                        {res.isBest && <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">Tốt nhất</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                        <div 
                            className="px-4 py-3 flex justify-between items-center bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
                            onClick={() => setShowPreview(!showPreview)}
                        >
                            <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Maximize className="w-3 h-3" /> Sơ đồ cắt ({mode === 'roll' ? `Khổ ${activeResult.widthLabel}mm` : 'Giấy lớn'})
                            </span>
                            {showPreview ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                        {showPreview && (
                            <div className="p-4 flex justify-center bg-white">
                                <canvas ref={canvasRef} width={350} height={250} className="w-full h-auto max-w-full" />
                            </div>
                        )}
                         <div className="bg-white px-4 py-3 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs">
                             <div>
                                 <span className="block text-gray-400 mb-0.5">Kiểu ghép</span>
                                 <span className="font-semibold text-gray-700">{activeResult.description}</span>
                             </div>
                             <div className="text-right">
                                 <span className="block text-gray-400 mb-0.5">{mode === 'sheet' ? 'Con / Tờ' : 'Con / Mét'}</span>
                                 <span className="font-bold text-blue-600 text-sm">{activeResult.yieldPerUnit}</span>
                             </div>
                             {activeResult.wasteW !== undefined && (
                                <div className="col-span-2 flex justify-between pt-2 border-t border-gray-50">
                                    <span className="text-gray-400">Bù hao biên (mép thừa)</span>
                                    <span className="font-medium text-red-500">{activeResult.wasteW.toFixed(1)} mm</span>
                                </div>
                             )}
                         </div>
                    </div>
                </section>
            )}

            {/* Error Message */}
            {activeResult?.error && (
                <div className="bg-red-50 p-4 rounded-xl text-red-600 text-sm flex items-center gap-2 animate-pulse border border-red-100">
                    <AlertCircle className="w-5 h-5" /> {activeResult.error}
                </div>
            )}
            
            <div className="h-8"></div>
        </div>
      </div>

      {/* 6. Sticky Footer */}
      {activeResult && !activeResult.error && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 px-4 py-2 safe-area-pb">
              <div className="max-w-md mx-auto grid grid-cols-3 gap-4 items-center">
                   <div>
                        <div className="text-[10px] text-gray-400 font-semibold uppercase">Vật tư</div>
                        <div className="text-base font-bold text-gray-900">
                            {activeResult.totalMaterial.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                            <span className="text-xs font-normal text-gray-500 ml-1">{mode === 'sheet' ? 'tờ' : 'm'}</span>
                        </div>
                   </div>
                   <div className="text-center border-l border-r border-gray-100">
                         <div className="text-[10px] text-gray-400 font-semibold uppercase">Đơn giá</div>
                         <div className="text-base font-bold text-emerald-600">
                             {Math.round(activeResult.costPerItem).toLocaleString('vi-VN')}
                             <span className="text-[10px] text-gray-400 ml-0.5">đ</span>
                        </div>
                   </div>
                   <div className="text-right">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase">Tổng tiền</div>
                        <div className="text-base font-bold text-blue-600">
                            {Math.round(activeResult.totalCost).toLocaleString('vi-VN')}
                            <span className="text-[10px] text-gray-400 ml-0.5">đ</span>
                        </div>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================

type Screen = 'home' | 'paper_calc' | 'imposition_calc' | 'material_calc';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  const handleBack = () => {
    setCurrentScreen('home');
  };

  const renderContent = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
             {/* Menu Grid */}
             <div className="grid grid-cols-2 gap-4 mt-2">
                
                {/* Menu Item 1: Tính giấy cắt */}
                <button 
                  onClick={() => setCurrentScreen('paper_calc')}
                  className="bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 group transition-all duration-200 active:scale-95 shadow-lg"
                >
                  <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 group-hover:text-blue-300 group-hover:bg-blue-500/20 transition-colors">
                    <Scissors size={28} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">Tính giấy cắt</h3>
                    <p className="text-slate-500 text-[10px] mt-1">Paper Calculator</p>
                  </div>
                </button>

                {/* Menu Item 2: Tính bình trang */}
                <button 
                  onClick={() => setCurrentScreen('imposition_calc')}
                  className="bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 group transition-all duration-200 active:scale-95 shadow-lg"
                >
                  <div className="w-14 h-14 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-400 group-hover:text-purple-300 group-hover:bg-purple-500/20 transition-colors">
                    <LayoutTemplate size={28} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">Tính bình trang</h3>
                    <p className="text-slate-500 text-[10px] mt-1">Imposition Calc</p>
                  </div>
                </button>

                {/* Menu Item 3: Tính vật tư */}
                <button 
                  onClick={() => setCurrentScreen('material_calc')}
                  className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 group transition-all duration-200 active:scale-95 shadow-lg"
                >
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 group-hover:text-emerald-300 group-hover:bg-emerald-500/20 transition-colors">
                    <Package size={28} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">Tính vật tư</h3>
                    <p className="text-slate-500 text-[10px] mt-1">Material Calc</p>
                  </div>
                </button>

             </div>
          </div>
        );

      case 'paper_calc':
        return (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Sub-page Header */}
            <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
              <button 
                onClick={handleBack}
                className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all active:scale-90"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="ml-2 text-lg font-semibold text-white">Tính giấy cắt</h2>
            </div>
            
            {/* Main Tool Content - Rendered with light theme background as per original code */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-gray-50">
               <PaperCalculator />
            </div>
          </div>
        );

      case 'imposition_calc':
        return (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Sub-page Header */}
            <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
              <button 
                onClick={handleBack}
                className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all active:scale-90"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="ml-2 text-lg font-semibold text-white">Tính bình trang</h2>
            </div>
            
            {/* Content Placeholder */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-slate-500 space-y-4 opacity-60">
               <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-2">
                <LayoutTemplate size={40} className="text-purple-500/50" />
              </div>
              <p>Nội dung đang cập nhật...</p>
            </div>
          </div>
        );

      case 'material_calc':
        return (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Sub-page Header */}
            <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
              <button 
                onClick={handleBack}
                className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all active:scale-90"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="ml-2 text-lg font-semibold text-white">Tính vật tư</h2>
            </div>
            
            {/* Content Placeholder */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-white">
                <MaterialCalculator />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-purple-500/30">
      {/* Mobile Wrapper */}
      <div className="max-w-md mx-auto min-h-screen relative flex flex-col bg-[#020617] shadow-2xl overflow-hidden">
        
        {/* Top Header with Logo - Visible ONLY on Home */}
        {currentScreen === 'home' && (
          <div className="pt-[5px] pb-1 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 flex justify-center">
              <div className="w-full">
                 <GoXPrintLogo />
              </div>
          </div>
        )}

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative z-10">
          {renderContent()}
        </div>

        {/* Background Gradients for Atmosphere */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-slate-900 to-transparent opacity-50 pointer-events-none z-0"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-900/10 rounded-full blur-[80px] pointer-events-none z-0"></div>
      </div>
    </div>
  );
};

export default App;