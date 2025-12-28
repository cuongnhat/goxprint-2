import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';

// Lazy load logo to prevent animation running when not on Home screen
const GoXPrintLogo = lazy(() => import('./components/GoXPrintLogo'));

// Import separated components
import NumberInput from './components/NumberInput';
import MaterialCalculator from './features/material-calculator/MaterialCalculator';
import ImpositionCalculator from './features/imposition-calculator/ImpositionCalculator';
import { I18nProvider, useI18n, Language } from './i18n';

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
  CheckCircle,
  Printer,
  BookOpen
} from 'lucide-react';

// ==========================================
// PAPER CALCULATOR COMPONENT
// ==========================================
const PaperCalculator: React.FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('optimize');
  const [showPreview, setShowPreview] = useState(true);

  // --- Global Inputs ---
  const [paper, setPaper] = useState({ w: 790, h: 1090 });
  const [paperPrice, setPaperPrice] = useState(0); // Giá tiền giấy lớn
  const [cutterMaxLength, setCutterMaxLength] = useState(800); // Chiều dài tối đa máy xén (mm)

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

  // --- Loading States ---
  const [isCalculating, setIsCalculating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation state for blinking cells
  const [blinkIndex, setBlinkIndex] = useState(0);
  const [isBlinking, setIsBlinking] = useState(true);

  // Cutting guide lightbox
  const [showCuttingGuide, setShowCuttingGuide] = useState(false);

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
    setIsCalculating(true);

    setTimeout(() => {
      const P_W = Number(paper.w);
      const P_H = Number(paper.h);
      const I_W = Number(item.w);
      const I_H = Number(item.h);

      if (P_W <= 0 || P_H <= 0 || !I_W || !I_H) {
        setIsCalculating(false);
        return;
      }

      const result = getBestYield(P_W, P_H, I_W, I_H);
      if (result.total === 0) {
        setOptimizationResult({ error: "Kích thước sản phẩm quá lớn!" });
      } else {
        setOptimizationResult(result);
      }
      setIsCalculating(false);
    }, 100);
  };

  // ==========================================
  // LOGIC 2: DIVIDE
  // ==========================================
  const calculateDivisionOptions = () => {
    setIsCalculating(true);

    setTimeout(() => {
      const P_W = Number(paper.w);
      const P_H = Number(paper.h);
      const Qty = parseInt(String(targetQuantity));

      if (P_W <= 0 || P_H <= 0 || !Qty || Qty <= 0) {
        setDivisionOptions([]);
        setIsCalculating(false);
        return;
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

      setIsCalculating(false);
    }, 100);
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

  useEffect(() => {
    if (activeTab === 'optimize') {
      const timer = setTimeout(() => calculateOptimization(), 200);
      return () => clearTimeout(timer);
    }
  }, [paper, item, activeTab, getBestYield]);
  useEffect(() => {
    if (activeTab === 'divide') {
      const timer = setTimeout(() => calculateDivisionOptions(), 400);
      return () => clearTimeout(timer);
    }
  }, [paper, targetQuantity, minSize, maxSize, activeTab, getBestYield]);

  // Cutting animation - Optimized sequence for paper cutter:
  // 1. Split clusters (if 2 blocks)
  // 2. Cut cluster with FEWER cuts FIRST (faster to finish = pack sooner, reduce space)
  // 3. Cut lines go from EDGE of paper (includes waste automatically)
  const [cutPhase, setCutPhase] = useState<'split' | 'first_h' | 'first_v' | 'second_h' | 'second_v'>('split');
  const [cutLineIndex, setCutLineIndex] = useState(0);
  const [firstClusterIdx, setFirstClusterIdx] = useState(0); // Which cluster to cut first

  useEffect(() => {
    if (!isBlinking) return;
    const blocksToRender = activeTab === 'optimize'
      ? (optimizationResult && !optimizationResult.error ? optimizationResult.blocks : [])
      : (activeTab === 'divide' && selectedGrid ? selectedGrid.blocks : []);

    if (!blocksToRender || blocksToRender.length === 0) return;

    // Find the main split cut (boundary between 2 clusters)
    const hasSplit = blocksToRender.length > 1;

    // Calculate cuts for each cluster
    const cluster1 = blocksToRender[0];
    const c1HCount = cluster1.rows - 1;
    const c1VCount = cluster1.cols - 1;
    const c1TotalCuts = c1HCount + c1VCount;
    // Số đường cắt ngang cho ra thành phẩm hoàn chỉnh (rows = số sản phẩm theo chiều dọc)
    const c1CutsToProduct = Math.min(c1HCount, c1VCount);

    let c2HCount = 0, c2VCount = 0, c2TotalCuts = 0, c2CutsToProduct = 0;
    const cluster2 = hasSplit && blocksToRender[1] ? blocksToRender[1] : null;
    if (cluster2) {
      c2HCount = cluster2.rows - 1;
      c2VCount = cluster2.cols - 1;
      c2TotalCuts = c2HCount + c2VCount;
      c2CutsToProduct = Math.min(c2HCount, c2VCount);
    }

    // Ưu tiên cụm ra thành phẩm SỚM nhất:
    // - Cụm nào có ít đường cắt hơn để ra thành phẩm hoàn chỉnh → cắt trước
    // - Nếu bằng nhau thì ưu tiên cụm có ít tổng đường cắt hơn
    let cutCluster1First = true;
    if (hasSplit && cluster2) {
      if (c1CutsToProduct !== c2CutsToProduct) {
        cutCluster1First = c1CutsToProduct <= c2CutsToProduct;
      } else {
        cutCluster1First = c1TotalCuts <= c2TotalCuts;
      }
    }
    const firstIdx = cutCluster1First ? 0 : 1;

    // Get cut counts for first and second clusters
    const firstHCuts = firstIdx === 0 ? c1HCount : c2HCount;
    const firstVCuts = firstIdx === 0 ? c1VCount : c2VCount;
    const secondHCuts = firstIdx === 0 ? c2HCount : c1HCount;
    const secondVCuts = firstIdx === 0 ? c2VCount : c1VCount;

    const interval = setInterval(() => {
      if (cutPhase === 'split') {
        setFirstClusterIdx(firstIdx);
        setCutPhase('first_h');
        setCutLineIndex(0);
      } else if (cutPhase === 'first_h') {
        if (firstHCuts > 0 && cutLineIndex < firstHCuts - 1) {
          setCutLineIndex(prev => prev + 1);
        } else {
          setCutPhase('first_v');
          setCutLineIndex(0);
        }
      } else if (cutPhase === 'first_v') {
        if (firstVCuts > 0 && cutLineIndex < firstVCuts - 1) {
          setCutLineIndex(prev => prev + 1);
        } else {
          if (hasSplit) {
            setCutPhase('second_h');
          } else {
            setCutPhase('split');
          }
          setCutLineIndex(0);
        }
      } else if (cutPhase === 'second_h') {
        if (secondHCuts > 0 && cutLineIndex < secondHCuts - 1) {
          setCutLineIndex(prev => prev + 1);
        } else {
          setCutPhase('second_v');
          setCutLineIndex(0);
        }
      } else if (cutPhase === 'second_v') {
        if (secondVCuts > 0 && cutLineIndex < secondVCuts - 1) {
          setCutLineIndex(prev => prev + 1);
        } else {
          setCutPhase('split');
          setCutLineIndex(0);
        }
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [activeTab, optimizationResult, selectedGrid, isBlinking, cutPhase, cutLineIndex]);

  useEffect(() => {
    if (!showPreview || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const P_W = Number(paper.w);
    const P_H = Number(paper.h);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!P_W || !P_H) return;

    // Padding for dimension labels - minimized for max content size
    const dimPadding = 35;
    const availableW = canvas.width - dimPadding * 2;
    const availableH = canvas.height - dimPadding * 2;

    const scaleX = availableW / P_W;
    const scaleY = availableH / P_H;
    const scale = Math.min(scaleX, scaleY); // Always 100% fit
    const drawW = P_W * scale;
    const drawH = P_H * scale;
    // Center the drawing in the canvas
    const startX = dimPadding + (availableW - drawW) / 2;
    const startY = dimPadding + (availableH - drawH) / 2;

    // Draw paper background
    ctx.fillStyle = '#f5f5f5';
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.fillRect(startX, startY, drawW, drawH);
    ctx.strokeRect(startX, startY, drawW, drawH);

    const drawCell = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    };

    // Function to draw dimension line with arrows
    const drawDimensionLine = (x1: number, y1: number, x2: number, y2: number, label: string, position: 'top' | 'left' | 'bottom' | 'right') => {
      const arrowSize = 10;
      const offset = position === 'top' || position === 'bottom' ? 0 : 0;

      ctx.strokeStyle = '#374151';
      ctx.fillStyle = '#374151';
      ctx.lineWidth = 1;

      // Draw main line
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw arrows
      if (position === 'top' || position === 'bottom') {
        // Left arrow
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + arrowSize, y1 - arrowSize / 2);
        ctx.lineTo(x1 + arrowSize, y1 + arrowSize / 2);
        ctx.closePath();
        ctx.fill();
        // Right arrow
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - arrowSize, y2 - arrowSize / 2);
        ctx.lineTo(x2 - arrowSize, y2 + arrowSize / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        // Top arrow
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - arrowSize / 2, y1 + arrowSize);
        ctx.lineTo(x1 + arrowSize / 2, y1 + arrowSize);
        ctx.closePath();
        ctx.fill();
        // Bottom arrow
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - arrowSize / 2, y2 - arrowSize);
        ctx.lineTo(x2 + arrowSize / 2, y2 - arrowSize);
        ctx.closePath();
        ctx.fill();
      }

      // Draw label with background
      const fontSize = 20;
      ctx.font = `bold ${fontSize}px Arial`;
      const textWidth = ctx.measureText(label).width;
      const padding = 6;

      let labelX: number, labelY: number;
      if (position === 'top' || position === 'bottom') {
        labelX = (x1 + x2) / 2;
        labelY = y1;
      } else {
        labelX = x1;
        labelY = (y1 + y2) / 2;
      }

      // Draw background
      ctx.fillStyle = '#fff';
      if (position === 'top' || position === 'bottom') {
        ctx.fillRect(labelX - textWidth / 2 - padding, labelY - fontSize / 2 - padding / 2, textWidth + padding * 2, fontSize + padding);
      } else {
        ctx.save();
        ctx.translate(labelX, labelY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillRect(-textWidth / 2 - padding, -fontSize / 2 - padding / 2, textWidth + padding * 2, fontSize + padding);
        ctx.restore();
      }

      // Draw text
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (position === 'top' || position === 'bottom') {
        ctx.fillText(label, labelX, labelY);
      } else {
        ctx.save();
        ctx.translate(labelX, labelY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    };

    const blocksToRender = activeTab === 'optimize'
      ? (optimizationResult && !optimizationResult.error ? optimizationResult.blocks : [])
      : (activeTab === 'divide' && selectedGrid ? selectedGrid.blocks : []);

    // Calculate total width and height of all blocks
    let maxBlockRight = 0;
    let maxBlockBottom = 0;
    blocksToRender?.forEach((block: any) => {
      const right = block.x + block.cols * block.itemW;
      const bottom = block.y + block.rows * block.itemH;
      if (right > maxBlockRight) maxBlockRight = right;
      if (bottom > maxBlockBottom) maxBlockBottom = bottom;
    });

    // Calculate waste areas
    const wasteRight = P_W - maxBlockRight;
    const wasteBottom = P_H - maxBlockBottom;

    // Determine optimal corner placement to minimize cuts
    // If waste is on right: need 1 vertical cut
    // If waste is on bottom: need 1 horizontal cut  
    // If both: need 2 cuts
    // Placing blocks at corner closest to waste minimizes cuts
    // Priority: align to corner with LEAST waste (main product area)
    // So waste goes to opposite corner

    // Place blocks at bottom-right (waste at top-left) - most intuitive for cutting
    // This means fewer cuts needed for the main product area
    const rightAlignOffsetX = wasteRight * scale;  // Push blocks right
    const bottomAlignOffsetY = wasteBottom * scale; // Push blocks down

    // Track row boundaries for phase 1 animation
    // Draw cells
    blocksToRender?.forEach((block: any, idx: number) => {
      // Apply alignment offset
      const bX = startX + (block.x * scale) + rightAlignOffsetX;
      const bY = startY + (block.y * scale) + bottomAlignOffsetY;
      const cellW = block.itemW * scale;
      const cellH = block.itemH * scale;
      let baseColor = '#3b82f6';
      if (activeTab === 'divide') baseColor = idx === 0 ? '#f59e0b' : '#10b981';
      else if (idx > 0) baseColor = '#10b981';

      // Draw all cells with base color
      for (let r = 0; r < block.rows; r++) {
        for (let c = 0; c < block.cols; c++) {
          drawCell(bX + c * cellW, bY + r * cellH, cellW, cellH, baseColor);
        }
      }
    });

    // Collect ALL unique cut positions (like a real paper cutter)
    // Horizontal cuts go from LEFT edge to RIGHT edge of paper
    // Vertical cuts go from TOP edge to BOTTOM edge of paper
    const hCutPositions = new Set<number>();
    const vCutPositions = new Set<number>();

    blocksToRender?.forEach((block: any) => {
      // All horizontal cut lines
      for (let r = 1; r <= block.rows; r++) {
        const y = block.y + r * block.itemH;
        if (y < P_H) hCutPositions.add(y);
      }
      if (block.y > 0) hCutPositions.add(block.y);

      // All vertical cut lines
      for (let c = 1; c <= block.cols; c++) {
        const x = block.x + c * block.itemW;
        if (x < P_W) vCutPositions.add(x);
      }
      if (block.x > 0) vCutPositions.add(block.x);
    });

    const hCuts = Array.from(hCutPositions).sort((a, b) => a - b);
    const vCuts = Array.from(vCutPositions).sort((a, b) => a - b);

    // Prepare cluster-specific cut data
    const hasSplit = blocksToRender.length > 1;
    let splitCut: { type: 'v' | 'h'; pos: number } | null = null;

    if (hasSplit && blocksToRender[1]) {
      const block2 = blocksToRender[1];
      if (block2.x > 0) {
        splitCut = { type: 'v', pos: block2.x };
      } else if (block2.y > 0) {
        splitCut = { type: 'h', pos: block2.y };
      }
    }

    // Cluster 1 data (with null check for cut animation drawing)
    const cluster1 = blocksToRender?.[0];
    let c1Right = 0, c1Bottom = 0;
    const c1HCuts: number[] = [];
    const c1VCuts: number[] = [];

    if (cluster1) {
      c1Right = cluster1.x + cluster1.cols * cluster1.itemW;
      c1Bottom = cluster1.y + cluster1.rows * cluster1.itemH;

      for (let r = 1; r < cluster1.rows; r++) {
        c1HCuts.push(cluster1.y + r * cluster1.itemH);
      }
      for (let c = 1; c < cluster1.cols; c++) {
        c1VCuts.push(cluster1.x + c * cluster1.itemW);
      }
    }

    // Cluster 2 data
    let cluster2: any = null;
    let c2Right = 0, c2Bottom = 0;
    const c2HCuts: number[] = [];
    const c2VCuts: number[] = [];

    if (hasSplit && blocksToRender[1]) {
      cluster2 = blocksToRender[1];
      c2Right = cluster2.x + cluster2.cols * cluster2.itemW;
      c2Bottom = cluster2.y + cluster2.rows * cluster2.itemH;

      for (let r = 1; r < cluster2.rows; r++) {
        c2HCuts.push(cluster2.y + r * cluster2.itemH);
      }
      for (let c = 1; c < cluster2.cols; c++) {
        c2VCuts.push(cluster2.x + c * cluster2.itemW);
      }
    }

    // Draw cut lines with animation - OPTIMIZED SEQUENCE
    // First cluster = fewer cuts = faster to finish = pack sooner
    if (isBlinking && cluster1) {
      ctx.lineWidth = 5;

      // Determine which cluster to cut first based on total cuts
      const c1TotalCuts = c1HCuts.length + c1VCuts.length;
      const c2TotalCuts = c2HCuts.length + c2VCuts.length;
      const cutCluster1First = !hasSplit || c1TotalCuts <= c2TotalCuts;

      const firstCluster = cutCluster1First ? cluster1 : cluster2;
      const secondCluster = cutCluster1First ? cluster2 : cluster1;
      const firstHCuts = cutCluster1First ? c1HCuts : c2HCuts;
      const firstVCuts = cutCluster1First ? c1VCuts : c2VCuts;
      const secondHCuts = cutCluster1First ? c2HCuts : c1HCuts;
      const secondVCuts = cutCluster1First ? c2VCuts : c1VCuts;
      const firstRight = cutCluster1First ? c1Right : c2Right;
      const firstBottom = cutCluster1First ? c1Bottom : c2Bottom;
      const secondRight = cutCluster1First ? c2Right : c1Right;
      const secondBottom = cutCluster1First ? c2Bottom : c1Bottom;
      const firstLabel = cutCluster1First ? 'CỤM1' : 'CỤM2';
      const secondLabel = cutCluster1First ? 'CỤM2' : 'CỤM1';

      // Phase 0: SPLIT CUT (separate clusters)
      if (cutPhase === 'split' && splitCut) {
        ctx.strokeStyle = '#ef4444';
        ctx.setLineDash([15, 8]);
        ctx.beginPath();

        if (splitCut.type === 'v') {
          const lineX = startX + (splitCut.pos + (P_W - maxBlockRight)) * scale;
          ctx.moveTo(lineX, startY);
          ctx.lineTo(lineX, startY + drawH);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 20px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✂ CHIA CỤM', lineX, startY + drawH / 2);
        } else {
          const lineY = startY + (splitCut.pos + (P_H - maxBlockBottom)) * scale;
          ctx.moveTo(startX, lineY);
          ctx.lineTo(startX + drawW, lineY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 20px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✂ CHIA CỤM', startX + drawW / 2, lineY);
        }
      }

      // Show completed split cut in later phases
      if (cutPhase !== 'split' && splitCut) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.beginPath();
        if (splitCut.type === 'v') {
          const lineX = startX + (splitCut.pos + (P_W - maxBlockRight)) * scale;
          ctx.moveTo(lineX, startY);
          ctx.lineTo(lineX, startY + drawH);
        } else {
          const lineY = startY + (splitCut.pos + (P_H - maxBlockBottom)) * scale;
          ctx.moveTo(startX, lineY);
          ctx.lineTo(startX + drawW, lineY);
        }
        ctx.stroke();
      }

      // FIRST CLUSTER horizontal cuts (from EDGE - includes waste)
      if (firstCluster && (cutPhase === 'first_h' || cutPhase === 'first_v' || cutPhase === 'second_h' || cutPhase === 'second_v')) {
        const isFirstHDone = cutPhase !== 'first_h';
        ctx.lineWidth = 4;

        firstHCuts.forEach((y, idx) => {
          const isCurrent = cutPhase === 'first_h' && idx === cutLineIndex;
          const isCompleted = isFirstHDone || (cutPhase === 'first_h' && idx < cutLineIndex);

          if (isCurrent || isCompleted) {
            const lineY = startY + (y + (P_H - maxBlockBottom)) * scale;
            // Cut from LEFT EDGE of paper (includes waste automatically)
            const lineStartX = startX;
            const lineEndX = startX + (firstRight + (P_W - maxBlockRight)) * scale;

            ctx.strokeStyle = isCurrent ? '#ef4444' : '#22c55e';
            ctx.setLineDash(isCurrent ? [15, 8] : []);
            ctx.beginPath();
            ctx.moveTo(lineStartX, lineY);
            ctx.lineTo(lineEndX, lineY);
            ctx.stroke();
            ctx.setLineDash([]);

            if (isCurrent) {
              ctx.fillStyle = '#ef4444';
              ctx.font = 'bold 14px Arial';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(`✂ ${firstLabel}-H${idx + 1} (ưu tiên)`, lineStartX + 5, lineY - 12);
            }
          }
        });
      }

      // FIRST CLUSTER vertical cuts (from EDGE - includes waste)
      if (firstCluster && (cutPhase === 'first_v' || cutPhase === 'second_h' || cutPhase === 'second_v')) {
        const isFirstVDone = cutPhase !== 'first_v';
        ctx.lineWidth = 4;

        firstVCuts.forEach((x, idx) => {
          const isCurrent = cutPhase === 'first_v' && idx === cutLineIndex;
          const isCompleted = isFirstVDone || (cutPhase === 'first_v' && idx < cutLineIndex);

          if (isCurrent || isCompleted) {
            const lineX = startX + (x + (P_W - maxBlockRight)) * scale;
            // Cut from TOP EDGE of paper (includes waste automatically)
            const lineStartY = startY;
            const lineEndY = startY + (firstBottom + (P_H - maxBlockBottom)) * scale;

            ctx.strokeStyle = isCurrent ? '#ef4444' : '#22c55e';
            ctx.setLineDash(isCurrent ? [15, 8] : []);
            ctx.beginPath();
            ctx.moveTo(lineX, lineStartY);
            ctx.lineTo(lineX, lineEndY);
            ctx.stroke();
            ctx.setLineDash([]);

            if (isCurrent) {
              ctx.save();
              ctx.translate(lineX + 12, lineStartY + 30);
              ctx.rotate(Math.PI / 2);
              ctx.fillStyle = '#ef4444';
              ctx.font = 'bold 14px Arial';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(`✂ ${firstLabel}-V${idx + 1}`, 0, 0);
              ctx.restore();
            }
          }
        });
      }

      // SECOND CLUSTER horizontal cuts
      if (secondCluster && (cutPhase === 'second_h' || cutPhase === 'second_v')) {
        const isSecondHDone = cutPhase !== 'second_h';
        ctx.lineWidth = 4;

        secondHCuts.forEach((y, idx) => {
          const isCurrent = cutPhase === 'second_h' && idx === cutLineIndex;
          const isCompleted = isSecondHDone || (cutPhase === 'second_h' && idx < cutLineIndex);

          if (isCurrent || isCompleted) {
            const lineY = startY + (y + (P_H - maxBlockBottom)) * scale;
            const lineStartX = startX + (secondCluster.x + (P_W - maxBlockRight)) * scale;
            const lineEndX = startX + (secondRight + (P_W - maxBlockRight)) * scale;

            ctx.strokeStyle = isCurrent ? '#3b82f6' : '#22c55e'; // Blue for second cluster
            ctx.setLineDash(isCurrent ? [15, 8] : []);
            ctx.beginPath();
            ctx.moveTo(lineStartX, lineY);
            ctx.lineTo(lineEndX, lineY);
            ctx.stroke();
            ctx.setLineDash([]);

            if (isCurrent) {
              ctx.fillStyle = '#3b82f6';
              ctx.font = 'bold 14px Arial';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(`✂ ${secondLabel}-H${idx + 1}`, lineStartX + 5, lineY - 12);
            }
          }
        });
      }

      // SECOND CLUSTER vertical cuts
      if (secondCluster && cutPhase === 'second_v') {
        ctx.lineWidth = 4;

        secondVCuts.forEach((x, idx) => {
          const isCurrent = idx === cutLineIndex;
          const isCompleted = idx < cutLineIndex;

          if (isCurrent || isCompleted) {
            const lineX = startX + (x + (P_W - maxBlockRight)) * scale;
            const lineStartY = startY + (secondCluster.y + (P_H - maxBlockBottom)) * scale;
            const lineEndY = startY + (secondBottom + (P_H - maxBlockBottom)) * scale;

            ctx.strokeStyle = isCurrent ? '#3b82f6' : '#22c55e';
            ctx.setLineDash(isCurrent ? [15, 8] : []);
            ctx.beginPath();
            ctx.moveTo(lineX, lineStartY);
            ctx.lineTo(lineX, lineEndY);
            ctx.stroke();
            ctx.setLineDash([]);

            if (isCurrent) {
              ctx.save();
              ctx.translate(lineX + 12, lineStartY + 30);
              ctx.rotate(Math.PI / 2);
              ctx.fillStyle = '#3b82f6';
              ctx.font = 'bold 14px Arial';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(`✂ ${secondLabel}-V${idx + 1}`, 0, 0);
              ctx.restore();
            }
          }
        });
      }

      // Draw WASTE BORDER - show the waste area edges
      const wasteTop = P_H - maxBlockBottom;
      const wasteLeft = P_W - maxBlockRight;

      if (wasteTop > 0 || wasteLeft > 0) {
        ctx.strokeStyle = '#f97316'; // Orange for waste
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);

        // Draw top waste line (if there's top waste)
        if (wasteTop > 0) {
          const lineY = startY + wasteTop * scale;
          ctx.beginPath();
          ctx.moveTo(startX, lineY);
          ctx.lineTo(startX + drawW, lineY);
          ctx.stroke();

          // Label for top waste
          ctx.setLineDash([]);
          ctx.fillStyle = '#f97316';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`↑ Thừa ${wasteTop}mm`, startX + drawW / 2, lineY - 3);
        }

        // Draw left waste line (if there's left waste)
        if (wasteLeft > 0) {
          const lineX = startX + wasteLeft * scale;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(lineX, startY);
          ctx.lineTo(lineX, startY + drawH);
          ctx.stroke();

          // Label for left waste
          ctx.setLineDash([]);
          ctx.save();
          ctx.translate(lineX - 3, startY + drawH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = '#f97316';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`← Thừa ${wasteLeft}mm`, 0, 0);
          ctx.restore();
        }

        ctx.setLineDash([]);
      }
    }

    // Collect all intersection points (all X and Y positions from all blocks) with right alignment
    const allXPositions: { x: number; realX: number }[] = [{ x: startX, realX: 0 }];
    const allYPositions: { y: number; realY: number }[] = [{ y: startY, realY: 0 }];

    blocksToRender?.forEach((block: any) => {
      // Apply right alignment offset
      const bX = startX + (block.x * scale) + rightAlignOffsetX;
      const bY = startY + (block.y * scale) + bottomAlignOffsetY;
      const cellW = block.itemW * scale;
      const cellH = block.itemH * scale;

      // Add all X positions (vertical lines)
      for (let c = 0; c <= block.cols; c++) {
        const xPos = bX + c * cellW;
        const realX = block.x + c * block.itemW + (P_W - maxBlockRight);
        if (!allXPositions.find(p => Math.abs(p.x - xPos) < 1)) {
          allXPositions.push({ x: xPos, realX });
        }
      }

      // Add all Y positions (horizontal lines)
      for (let r = 0; r <= block.rows; r++) {
        const yPos = bY + r * cellH;
        const realY = block.y + r * block.itemH + (P_H - maxBlockBottom);
        if (!allYPositions.find(p => Math.abs(p.y - yPos) < 1)) {
          allYPositions.push({ y: yPos, realY });
        }
      }
    });

    // Add paper edges
    if (!allXPositions.find(p => Math.abs(p.x - (startX + drawW)) < 1)) {
      allXPositions.push({ x: startX + drawW, realX: P_W });
    }
    if (!allYPositions.find(p => Math.abs(p.y - (startY + drawH)) < 1)) {
      allYPositions.push({ y: startY + drawH, realY: P_H });
    }

    // Sort positions
    allXPositions.sort((a, b) => a.x - b.x);
    allYPositions.sort((a, b) => a.y - b.y);

    // Helper function to draw edge segments
    const drawEdgeSegments = (
      positions: { x?: number; y?: number; realX?: number; realY?: number }[],
      dimPos: number,
      isHorizontal: boolean,
      isReversed: boolean = false
    ) => {
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < positions.length - 1; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 1];

        if (isHorizontal) {
          const x1 = p1.x!, x2 = p2.x!;
          const segmentWidth = Math.round(p2.realX! - p1.realX!);
          if (segmentWidth <= 0) continue;

          const midX = (x1 + x2) / 2;
          const segW = x2 - x1;

          // Draw dimension line
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, dimPos);
          ctx.lineTo(x2, dimPos);
          ctx.stroke();

          // Draw end ticks
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, dimPos - 6);
          ctx.lineTo(x1, dimPos + 6);
          ctx.moveTo(x2, dimPos - 6);
          ctx.lineTo(x2, dimPos + 6);
          ctx.stroke();

          // Draw label
          const label = `${segmentWidth}`;
          const textWidth = ctx.measureText(label).width;
          if (segW > textWidth + 8) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(midX - textWidth / 2 - 4, dimPos - 10, textWidth + 8, 20);
            ctx.fillStyle = '#1f2937';
            ctx.fillText(label, midX, dimPos);
          }
        } else {
          const y1 = p1.y!, y2 = p2.y!;
          const segmentHeight = Math.round(p2.realY! - p1.realY!);
          if (segmentHeight <= 0) continue;

          const midY = (y1 + y2) / 2;
          const segH = y2 - y1;

          // Draw dimension line
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(dimPos, y1);
          ctx.lineTo(dimPos, y2);
          ctx.stroke();

          // Draw end ticks
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(dimPos - 6, y1);
          ctx.lineTo(dimPos + 6, y1);
          ctx.moveTo(dimPos - 6, y2);
          ctx.lineTo(dimPos + 6, y2);
          ctx.stroke();

          // Draw label (rotated)
          const label = `${segmentHeight}`;
          const textWidth = ctx.measureText(label).width;
          if (segH > textWidth + 8) {
            ctx.save();
            ctx.translate(dimPos, midY);
            ctx.rotate(isReversed ? Math.PI / 2 : -Math.PI / 2);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-textWidth / 2 - 4, -10, textWidth + 8, 20);
            ctx.fillStyle = '#1f2937';
            ctx.fillText(label, 0, 0);
            ctx.restore();
          }
        }
      }
    };

    // Draw segments on each edge (outside)
    drawEdgeSegments(allXPositions, startY - 18, true);
    drawEdgeSegments(allXPositions, startY + drawH + 18, true);
    drawEdgeSegments(allYPositions, startX - 18, false);
    drawEdgeSegments(allYPositions, startX + drawW + 18, false, true);

    // Draw dimensions INSIDE cells - WIDTH on top edge, HEIGHT on left edge
    blocksToRender?.forEach((block: any) => {
      // Apply right alignment offset
      const bX = startX + (block.x * scale) + rightAlignOffsetX;
      const bY = startY + (block.y * scale) + bottomAlignOffsetY;
      const cellW = block.itemW * scale;
      const cellH = block.itemH * scale;

      // Calculate font size based on cell size
      const fontSize = Math.min(Math.max(14, Math.min(cellW, cellH) / 4), 28);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw WIDTH label at TOP of each cell (horizontal)
      for (let r = 0; r < block.rows; r++) {
        for (let c = 0; c < block.cols; c++) {
          const cellX = bX + c * cellW;
          const cellY = bY + r * cellH;

          // Width label at top center of cell
          const widthLabel = `${block.itemW}`;
          const widthTextWidth = ctx.measureText(widthLabel).width;
          const topLabelX = cellX + cellW / 2;
          const topLabelY = cellY + fontSize / 2 + 8;

          if (cellW > widthTextWidth + 16) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(topLabelX - widthTextWidth / 2 - 6, topLabelY - fontSize / 2 - 4, widthTextWidth + 12, fontSize + 8, 4);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(widthLabel, topLabelX, topLabelY);
          }

          // Height label at left center of cell (rotated)
          const heightLabel = `${block.itemH}`;
          const heightTextWidth = ctx.measureText(heightLabel).width;
          const leftLabelX = cellX + fontSize / 2 + 8;
          const leftLabelY = cellY + cellH / 2;

          if (cellH > heightTextWidth + 16) {
            ctx.save();
            ctx.translate(leftLabelX, leftLabelY);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(-heightTextWidth / 2 - 6, -fontSize / 2 - 4, heightTextWidth + 12, fontSize + 8, 4);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(heightLabel, 0, 0);
            ctx.restore();
          }
        }
      }
    });

  }, [paper, activeTab, optimizationResult, selectedGrid, showPreview, blinkIndex, isBlinking, cutPhase, cutLineIndex]);

  return (
    <div className="bg-gray-50 text-gray-800 font-sans pb-10 min-h-full">
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-600" />
            {t('paperCalcTitle')}
          </h1>
          <button onClick={() => setShowPreview(!showPreview)} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition">
            {showPreview ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
            <Maximize className="w-4 h-4" /> {t('bigPaperSize')} (mm)
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <NumberInput label={t('length')} value={paper.w} onChange={(v: number | null) => setPaper({ ...paper, w: v || 0 })} suffix="mm" />
            <NumberInput label={t('widthLabel')} value={paper.h} onChange={(v: number | null) => setPaper({ ...paper, h: v || 0 })} suffix="mm" />
          </div>

          <div className="pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> {t('bigPaperPrice')}
                </label>
                <NumberInput
                  value={paperPrice}
                  onChange={(v: number | null) => setPaperPrice(v || 0)}
                  placeholder={t('examplePrice')}
                  suffix={t('currency')}
                  className="text-emerald-600"
                />
              </div>
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Scissors className="w-3 h-3" /> {t('cutterMaxLabel')}
                </label>
                <NumberInput
                  value={cutterMaxLength}
                  onChange={(v: number | null) => setCutterMaxLength(v || 800)}
                  placeholder="VD: 800"
                  suffix="mm"
                  className="text-orange-600"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex p-1 bg-gray-200 rounded-lg mb-4">
          <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'optimize' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('optimize')}>
            {t('tabOptimizeSize')}
          </button>
          <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'divide' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('divide')}>
            {t('tabDivideQty')}
          </button>
        </div>

        {activeTab === 'optimize' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase"><Settings className="w-4 h-4" /> {t('productMM')}</div>
                <button onClick={() => setItem({ w: item.h, h: item.w })} className="text-xs flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"><RotateCcw className="w-3 h-3" /> {t('swapDimension')}</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label={t('length')} value={item.w} onChange={(v: number | null) => setItem({ ...item, w: v || 0 })} suffix="mm" />
                <NumberInput label={t('widthLabel')} value={item.h} onChange={(v: number | null) => setItem({ ...item, h: v || 0 })} suffix="mm" />
              </div>
            </div>

            {isCalculating ? (
              <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl text-center mb-4">
                <RefreshCw className="w-8 h-8 text-blue-600 mx-auto mb-2 animate-spin" />
                <div className="text-blue-600 font-medium">{t('calculating')}</div>
              </div>
            ) : optimizationResult && !optimizationResult.error ? (
              <div className="bg-blue-600 text-white p-5 rounded-xl shadow-lg mb-4 text-center">
                <div className="text-blue-100 text-xs uppercase font-bold tracking-wider mb-1">{t('maxQty')}</div>
                <div className="text-5xl font-bold mb-2">{optimizationResult.total} <span className="text-xl font-normal">{t('unit')}</span></div>
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
            ) : (
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center">
                <div className="text-gray-400 text-sm">{t('inputSizeToCalc')}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'divide' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 uppercase">
                <List className="w-4 h-4" /> {t('qtyAndFilter')}
              </div>
              <div className="relative mb-4">
                <NumberInput
                  value={targetQuantity}
                  onChange={(v: number | null) => setTargetQuantity(Math.max(1, v || 0))}
                  className="text-3xl font-bold text-center text-blue-600"
                />
                <div className="text-center text-xs text-gray-400 mt-2">{t('findLargestSize')}</div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                  <Filter className="w-3 h-3" /> {t('sizeFilter')}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <NumberInput label={t('minLen')} value={minSize.w} onChange={(v: number | null) => setMinSize({ ...minSize, w: v || 0 })} placeholder="Min W" className="text-sm text-center" />
                  <NumberInput label={t('maxLen')} value={maxSize.w} onChange={(v: number | null) => setMaxSize({ ...maxSize, w: v || 0 })} placeholder="Max W" className="text-sm text-center" />
                  <NumberInput label={t('minWid')} value={minSize.h} onChange={(v: number | null) => setMinSize({ ...minSize, h: v || 0 })} placeholder="Min H" className="text-sm text-center" />
                  <NumberInput label={t('maxWid')} value={maxSize.h} onChange={(v: number | null) => setMaxSize({ ...maxSize, h: v || 0 })} placeholder="Max H" className="text-sm text-center" />
                </div>
              </div>
            </div>

            {isCalculating ? (
              <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl text-center mb-4">
                <RefreshCw className="w-8 h-8 text-blue-600 mx-auto mb-2 animate-spin" />
                <div className="text-blue-600 font-medium">{t('calculating')}</div>
              </div>
            ) : divisionOptions.length > 0 ? (
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-400 uppercase ml-1 flex justify-between">
                  <span>{t('optimizeResult')}:</span>
                  <span>{divisionOptions.length} {t('optionsCount')}</span>
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
                          <span>Diện tích: {Math.round(opt.area / 100) / 10} cm²</span>
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
                <p>Không tìm thấy phương án phù hợp</p>
                <p className="text-xs mt-1">(Thử điều chỉnh số lượng hoặc kích thước Min/Max)</p>
              </div>
            )}
          </div>
        )}

        <div className={`transition-all duration-300 ${showPreview ? 'opacity-100' : 'opacity-0 max-h-0 overflow-hidden'} mt-4 -mx-4`}>
          {/* Header line 1: Title + Legends */}
          <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
            <span className="text-sm font-bold text-white uppercase tracking-wider">✂️ Mô phỏng cắt</span>
            <div className="flex gap-3 text-xs text-gray-300">
              {activeTab === 'optimize' ? (
                <>
                  {optimizationResult?.blocks && optimizationResult.blocks.length > 1 && (
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
          {/* Header line 2: Action buttons */}
          <div className="bg-gray-700 px-4 py-2 flex justify-center gap-2">
            <button
              onClick={() => setIsBlinking(!isBlinking)}
              className={`flex items-center gap-1 px-3 py-1 ${isBlinking ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-500 hover:bg-gray-600'} text-white rounded-md text-xs font-medium transition`}
            >
              {isBlinking ? '⏸ Dừng' : '▶ Chạy'}
            </button>
            <button
              onClick={() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                // Temporarily disable blinking for print
                setIsBlinking(false);
                setTimeout(() => {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Mô phỏng cắt - GoXPrint</title>
                          <style>
                            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
                            img { max-width: 100%; height: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                            @media print { body { background: white; } img { box-shadow: none; } }
                          </style>
                        </head>
                        <body>
                          <img src="${canvas.toDataURL('image/png')}" />
                          <script>window.onload = function() { window.print(); }</script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                }, 100);
              }}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition"
            >
              <Printer className="w-3 h-3" /> In
            </button>
            <button
              onClick={() => setShowCuttingGuide(true)}
              className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-medium transition"
            >
              <BookOpen className="w-3 h-3" /> Hướng dẫn
            </button>
          </div>
          <div className="bg-gray-100 p-1 flex justify-center overflow-hidden">
            <canvas ref={canvasRef} width={1200} height={Math.max(900, Math.round(1200 * (Number(paper.h) || 900) / (Number(paper.w) || 1200)) + 100)} className="w-full h-auto shadow-lg bg-white rounded-lg" />
          </div>
        </div>

        {/* Cutting Guide Lightbox - DYNAMIC */}
        {showCuttingGuide && (() => {
          // Get actual data from current result
          const blocksToRender = activeTab === 'optimize'
            ? (optimizationResult && !optimizationResult.error ? optimizationResult.blocks : [])
            : (activeTab === 'divide' && selectedGrid ? selectedGrid.blocks : []);

          const hasTwoClusters = blocksToRender && blocksToRender.length > 1;
          const cluster1 = blocksToRender?.[0];
          const cluster2 = blocksToRender?.[1];

          const c1Rows = cluster1?.rows || 0;
          const c1Cols = cluster1?.cols || 0;
          const c1HCuts = c1Rows - 1;
          const c1VCuts = c1Cols - 1;
          const c1Total = c1Rows * c1Cols;
          const c1CutsToProduct = Math.min(c1HCuts, c1VCuts); // Số đường cắt tối thiểu để ra 1 thành phẩm

          const c2Rows = cluster2?.rows || 0;
          const c2Cols = cluster2?.cols || 0;
          const c2HCuts = c2Rows - 1;
          const c2VCuts = c2Cols - 1;
          const c2Total = c2Rows * c2Cols;
          const c2CutsToProduct = Math.min(c2HCuts, c2VCuts);

          const totalProducts = c1Total + c2Total;

          // Xác định cụm ưu tiên (giống logic animation)
          let priorityFirst = true; // true = cluster1 first
          if (hasTwoClusters && cluster2) {
            if (c1CutsToProduct !== c2CutsToProduct) {
              priorityFirst = c1CutsToProduct <= c2CutsToProduct;
            } else {
              priorityFirst = (c1HCuts + c1VCuts) <= (c2HCuts + c2VCuts);
            }
          }

          // Sắp xếp lại theo thứ tự ưu tiên
          const firstCluster = priorityFirst ? { rows: c1Rows, cols: c1Cols, h: c1HCuts, v: c1VCuts, total: c1Total, label: 'Cụm 1', color: 'blue' }
            : { rows: c2Rows, cols: c2Cols, h: c2HCuts, v: c2VCuts, total: c2Total, label: 'Cụm 2', color: 'green' };
          const secondCluster = priorityFirst ? { rows: c2Rows, cols: c2Cols, h: c2HCuts, v: c2VCuts, total: c2Total, label: 'Cụm 2', color: 'green' }
            : { rows: c1Rows, cols: c1Cols, h: c1HCuts, v: c1VCuts, total: c1Total, label: 'Cụm 1', color: 'blue' };

          return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCuttingGuide(false)}>
              <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-t-2xl">
                  <div className="flex justify-between items-center">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                      <Scissors className="w-5 h-5" /> Hướng dẫn cắt - {totalProducts} sản phẩm
                    </h2>
                    <button onClick={() => setShowCuttingGuide(false)} className="text-white/80 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Thông tin tổng quan */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <div className="text-blue-800 text-sm font-medium text-center">
                      📋 Giấy <strong>{paper.w} x {paper.h}mm</strong> → <strong>{totalProducts}</strong> sản phẩm
                      {hasTwoClusters && <span className="text-blue-600"> (2 cụm)</span>}
                    </div>
                  </div>

                  {/* Bước 1: Chia cụm */}
                  {hasTwoClusters && (
                    <div className="border border-red-200 rounded-xl p-4 bg-red-50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                        <h3 className="font-bold text-gray-800">Cắt chia 2 cụm</h3>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 mb-2">
                        <div className="flex items-center justify-center gap-3">
                          <div className="text-center">
                            <div className={`w-16 h-16 ${firstCluster.color === 'blue' ? 'bg-blue-200 border-blue-400' : 'bg-green-200 border-green-400'} border-2 rounded flex items-center justify-center text-xs font-bold`}>
                              {firstCluster.rows}x{firstCluster.cols}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{firstCluster.total} sp ⭐</div>
                          </div>
                          <div className="text-red-500 font-bold text-2xl">✂</div>
                          <div className="text-center">
                            <div className={`w-14 h-16 ${secondCluster.color === 'blue' ? 'bg-blue-200 border-blue-400' : 'bg-green-200 border-green-400'} border-2 rounded flex items-center justify-center text-xs font-bold`}>
                              {secondCluster.rows}x{secondCluster.cols}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{secondCluster.total} sp</div>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm">Cắt 1 đường để tách 2 cụm. <span className="text-blue-600 font-semibold">⭐ = Ưu tiên cắt trước</span></p>
                    </div>
                  )}

                  {/* Bước 2: Cắt cụm ưu tiên */}
                  <div className={`border ${firstCluster.color === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 ${firstCluster.color === 'blue' ? 'bg-blue-500' : 'bg-green-500'} text-white rounded-full flex items-center justify-center font-bold text-sm`}>{hasTwoClusters ? 2 : 1}</div>
                      <h3 className="font-bold text-gray-800">
                        {hasTwoClusters ? `${firstCluster.label} (⭐ ưu tiên)` : 'Cắt sản phẩm'}
                      </h3>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200 mb-2">
                      <div className="text-center text-xs text-gray-500 mb-2">
                        <strong>{firstCluster.rows} hàng × {firstCluster.cols} cột = {firstCluster.total} sản phẩm</strong>
                      </div>
                      <div className="flex flex-wrap justify-center gap-1 max-w-[200px] mx-auto">
                        {Array.from({ length: Math.min(firstCluster.total, 12) }).map((_, i) => (
                          <div key={i} className={`w-7 h-9 ${firstCluster.color === 'blue' ? 'bg-blue-300 border-blue-400' : 'bg-green-300 border-green-400'} border rounded text-[8px] flex items-center justify-center`}>
                            {i + 1}
                          </div>
                        ))}
                        {firstCluster.total > 12 && <div className="w-7 h-9 flex items-center justify-center text-xs text-gray-400">...</div>}
                      </div>
                      <div className="text-center mt-2 text-xs text-green-600 font-bold">
                        ✓ {firstCluster.h} đường H + {firstCluster.v} đường V = {firstCluster.total} sản phẩm
                      </div>
                      {hasTwoClusters && (
                        <div className="text-center mt-1 text-xs text-amber-600">
                          💡 min({firstCluster.h},{firstCluster.v}) = {Math.min(firstCluster.h, firstCluster.v)} → Ra thành phẩm sớm nhất!
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm">
                      Cắt <strong>{firstCluster.h} đường ngang</strong> rồi <strong>{firstCluster.v} đường dọc</strong>
                    </p>
                  </div>

                  {/* Bước 3: Cắt cụm còn lại (nếu có) */}
                  {hasTwoClusters && secondCluster.total > 0 && (
                    <div className={`border ${secondCluster.color === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'} rounded-xl p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 ${secondCluster.color === 'blue' ? 'bg-blue-500' : 'bg-green-500'} text-white rounded-full flex items-center justify-center font-bold text-sm`}>3</div>
                        <h3 className="font-bold text-gray-800">{secondCluster.label}</h3>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 mb-2">
                        <div className="text-center text-xs text-gray-500 mb-2">
                          <strong>{secondCluster.rows} hàng × {secondCluster.cols} cột = {secondCluster.total} sản phẩm</strong>
                        </div>
                        <div className="flex flex-wrap justify-center gap-1 max-w-[180px] mx-auto">
                          {Array.from({ length: Math.min(secondCluster.total, 9) }).map((_, i) => (
                            <div key={i} className={`w-7 h-8 ${secondCluster.color === 'blue' ? 'bg-blue-300 border-blue-400' : 'bg-green-300 border-green-400'} border rounded text-[8px] flex items-center justify-center`}>
                              {i + 1}
                            </div>
                          ))}
                          {secondCluster.total > 9 && <div className="w-7 h-8 flex items-center justify-center text-xs text-gray-400">...</div>}
                        </div>
                        <div className="text-center mt-2 text-xs text-blue-600">
                          → {secondCluster.h} đường H + {secondCluster.v} đường V = {secondCluster.total} sản phẩm
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm">
                        Cắt <strong>{secondCluster.h} đường ngang</strong> rồi <strong>{secondCluster.v} đường dọc</strong>
                      </p>
                    </div>
                  )}

                  {/* Tổng kết đường cắt */}
                  <div className="bg-gray-100 border border-gray-300 rounded-xl p-3">
                    <div className="text-gray-800 font-bold text-sm mb-1">📊 Tổng kết:</div>
                    <div className="text-gray-700 text-sm">
                      • Tổng đường cắt: <strong>{(hasTwoClusters ? 1 : 0) + firstCluster.h + firstCluster.v + (hasTwoClusters ? secondCluster.h + secondCluster.v : 0)}</strong> đường
                      <br />
                      • Tổng sản phẩm: <strong>{totalProducts}</strong> sản phẩm
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                      💡 Mẹo cắt nhanh
                    </h4>
                    <ul className="text-amber-700 text-sm space-y-1">
                      <li>• Xếp chồng nhiều tờ để cắt 1 lần</li>
                      <li>• Chiều dài máy xén: <strong>{cutterMaxLength}mm</strong></li>
                      <li>• Đường cắt từ mép → bao gồm phần thừa</li>
                    </ul>
                  </div>

                  <button
                    onClick={() => setShowCuttingGuide(false)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
                  >
                    Đã hiểu, đóng
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
};


// Components đã được tách ra files riêng:
// - NumberInput: ./components/NumberInput.tsx
// - MaterialCalculator: ./features/material-calculator/MaterialCalculator.tsx


// ==========================================
// MAIN APP COMPONENT
// ==========================================

type Screen = 'home' | 'paper_calc' | 'imposition_calc' | 'material_calc';

const AppContent: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const { lang, setLang, t } = useI18n();

  const handleBack = () => {
    setCurrentScreen('home');
  };

  const renderContent = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Language Selector */}
            <div className="flex justify-end mb-2">
              <div className="flex items-center gap-1 bg-slate-900/80 rounded-full p-1">
                <button
                  onClick={() => setLang('vi')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${lang === 'vi' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  VI
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${lang === 'en' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  EN
                </button>
              </div>
            </div>

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
                  <h3 className="text-white font-semibold text-sm">{t('paperCalc')}</h3>
                  <p className="text-slate-500 text-[10px] mt-1">{t('paperCalcSub')}</p>
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
                  <h3 className="text-white font-semibold text-sm">{t('impositionCalc')}</h3>
                  <p className="text-slate-500 text-[10px] mt-1">{t('impositionCalcSub')}</p>
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
                  <h3 className="text-white font-semibold text-sm">{t('materialCalc')}</h3>
                  <p className="text-slate-500 text-[10px] mt-1">{t('materialCalcSub')}</p>
                </div>
              </button>

            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-slate-500 text-xs">{t('footer')}</p>
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
              <h2 className="ml-2 text-lg font-semibold text-white">{t('paperCalc')}</h2>
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
              <h2 className="ml-2 text-lg font-semibold text-white">{t('impositionCalc')}</h2>
            </div>

            {/* Imposition Calculator Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-white pb-20">
              <ImpositionCalculator />
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
              <h2 className="ml-2 text-lg font-semibold text-white">{t('materialCalc')}</h2>
            </div>

            {/* Content Placeholder */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-white pb-20">
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

        {/* Top Header with Logo - Visible ONLY on Home (Lazy loaded) */}
        {currentScreen === 'home' && (
          <div className="pt-[5px] pb-1 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 flex justify-center">
            <div className="w-full">
              <Suspense fallback={
                <div className="h-16 flex items-center justify-center">
                  <div className="text-purple-400 text-xl font-bold animate-pulse">GoXPrint</div>
                </div>
              }>
                <GoXPrintLogo />
              </Suspense>
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

// Wrap in I18nProvider
const App: React.FC = () => (
  <I18nProvider>
    <AppContent />
  </I18nProvider>
);

export default App;