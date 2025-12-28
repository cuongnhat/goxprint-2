import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Calculator,
    RefreshCw,
    Settings,
    Box,
    ChevronDown,
    ChevronUp,
    Plus,
    X,
    Trophy,
    Maximize,
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import NumberInput from '../../components/NumberInput';
import ModeSwitcher from '../../components/ui/ModeSwitcher';

const MaterialCalculator: React.FC = () => {
    const [mode, setMode] = useState<'sheet' | 'roll'>('sheet');
    const [showPreview, setShowPreview] = useState(true);

    // Inputs
    const [product, setProduct] = useState({ w: 210, h: 148, qty: 1000 });
    const [sheetMaterial, setSheetMaterial] = useState({ w: 790, h: 1090, price: 2000 });

    // Roll Material: Hỗ trợ multi-width
    const [rollMaterial, setRollMaterial] = useState({
        widths: [500],
        price: 100,
        areaPrice: 200000,
        priceMode: 'area' as 'area' | 'linear'
    });

    // Results
    const [results, setResults] = useState<any[]>([]);
    const [selectedResultIndex, setSelectedResultIndex] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Helper: Quản lý khổ cuộn
    const addRollWidth = () => setRollMaterial((prev) => ({ ...prev, widths: [...prev.widths, 0] }));
    const updateRollWidth = (idx: number, val: number) => {
        const newWidths = [...rollMaterial.widths];
        newWidths[idx] = val;
        setRollMaterial((prev) => ({ ...prev, widths: newWidths }));
    };
    const removeRollWidth = (idx: number) => {
        if (rollMaterial.widths.length <= 1) return;
        const newWidths = rollMaterial.widths.filter((_, i) => i !== idx);
        setRollMaterial((prev) => ({ ...prev, widths: newWidths }));
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
                        materialInfo: { ...rollMaterial, w: matW },
                        wasteW: usageData.wasteW,
                        widthLabel: matW
                    });
                }
            });

            if (calculatedOptions.length > 0) {
                calculatedOptions.sort((a, b) => a.totalCost - b.totalCost);
                calculatedOptions[0].isBest = true;
                setResults(calculatedOptions);
                setSelectedResultIndex(0);
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
                            <NumberInput label="Chiều Dài" value={product.w} onChange={(v) => setProduct({ ...product, w: v || 0 })} suffix="mm" />
                            <NumberInput label="Chiều Rộng" value={product.h} onChange={(v) => setProduct({ ...product, h: v || 0 })} suffix="mm" />
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <NumberInput label="Số lượng cần" value={product.qty} onChange={(v) => setProduct({ ...product, qty: v || 0 })} suffix="cái" className="text-blue-600 font-bold" />
                            </div>
                            <button
                                onClick={() => setProduct({ ...product, w: product.h, h: product.w })}
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
                                    <NumberInput label="Khổ Dài" value={sheetMaterial.w} onChange={(v) => setSheetMaterial({ ...sheetMaterial, w: v || 0 })} suffix="mm" />
                                    <NumberInput label="Khổ Rộng" value={sheetMaterial.h} onChange={(v) => setSheetMaterial({ ...sheetMaterial, h: v || 0 })} suffix="mm" />
                                </div>
                                <NumberInput label="Giá nhập (tờ lớn)" value={sheetMaterial.price} onChange={(v) => setSheetMaterial({ ...sheetMaterial, price: v || 0 })} suffix="đ" className="text-emerald-600" />
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
                                                onChange={(val) => updateRollWidth(idx, val || 0)}
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
                                    <button onClick={() => setRollMaterial({ ...rollMaterial, priceMode: 'area' })} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${rollMaterial.priceMode === 'area' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Giá theo m²</button>
                                    <button onClick={() => setRollMaterial({ ...rollMaterial, priceMode: 'linear' })} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${rollMaterial.priceMode === 'linear' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Giá theo md</button>
                                </div>

                                {rollMaterial.priceMode === 'area' ? (
                                    <div className="space-y-2">
                                        <NumberInput label="Đơn giá m²" value={rollMaterial.areaPrice} onChange={(v) => setRollMaterial({ ...rollMaterial, areaPrice: v || 0 })} suffix="đ/m²" className="text-emerald-600" />
                                        {activeResult && activeResult.type === 'roll' && (
                                            <div className="text-[10px] text-gray-400 px-2 flex items-center gap-1">
                                                <ArrowRight className="w-3 h-3" />
                                                Đang xem khổ {activeResult.widthLabel}mm: {((rollMaterial.areaPrice * activeResult.widthLabel) / 1000).toLocaleString('vi-VN')} đ/md
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <NumberInput label="Đơn giá mét dài" value={rollMaterial.price} onChange={(v) => setRollMaterial({ ...rollMaterial, price: v || 0 })} suffix="đ/md" className="text-emerald-600" />
                                        <div className="text-[10px] text-amber-500 px-2 mt-1">
                                            *Lưu ý: Giá md này sẽ áp dụng cho tất cả các khổ đang nhập.
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {/* Footer Summary - now above preview */}
                    {activeResult && !activeResult.error && (
                        <div className="sticky bottom-0 left-0 right-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-lg z-40">
                            <div className="grid grid-cols-3 gap-4 items-center">
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
        </div>
    );
};

export default MaterialCalculator;
