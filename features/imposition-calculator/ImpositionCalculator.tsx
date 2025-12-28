import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Calculator,
    RefreshCw,
    Box,
    ChevronDown,
    ChevronUp,
    Trophy,
    Maximize,
    AlertCircle,
    Square,
    Circle,
    RectangleHorizontal,
    Grid3X3,
    Check
} from 'lucide-react';
import NumberInput from '../../components/NumberInput';
import { calculateLayout, LayoutPlan } from './layoutSolver';

// Các khổ giấy preset (chỉ lưu kích thước trang, vùng in tự tính)
const PAPER_PRESETS = [
    { label: '32x43', w: 320, h: 430 },
    { label: '32x47', w: 320, h: 470 },
    { label: '31x42.5', w: 310, h: 425 },
    { label: 'A4', w: 210, h: 297 },
    { label: 'A3', w: 297, h: 420 },
];

const SHAPES = [
    { value: 'rect' as const, label: 'Chữ nhật', icon: Square },
    { value: 'circle' as const, label: 'Tròn', icon: Circle },
    { value: 'oval' as const, label: 'Oval', icon: RectangleHorizontal },
];

const ImpositionCalculator: React.FC = () => {
    // Config state
    const [shape, setShape] = useState<'rect' | 'circle' | 'oval'>('rect');
    const [itemW, setItemW] = useState(100);
    const [itemH, setItemH] = useState(120);
    const [padding, setPadding] = useState(0);

    // Page settings
    const [pageW, setPageW] = useState(330);
    const [pageH, setPageH] = useState(480);
    const [printW, setPrintW] = useState(310);
    const [printH, setPrintH] = useState(450);
    const [usePrintArea, setUsePrintArea] = useState(false); // Mặc định tắt

    // Order & Pricing
    const [totalOrder, setTotalOrder] = useState(1000);
    const [unitPrice, setUnitPrice] = useState(10000);

    // Results
    const [plans, setPlans] = useState<LayoutPlan[]>([]);
    const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
    const [showPreview, setShowPreview] = useState(true);
    const [showPlanModal, setShowPlanModal] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calculate layout khi config thay đổi
    useEffect(() => {
        const timer = setTimeout(() => {
            const effectiveItemH = shape === 'circle' ? itemW : itemH;
            // Sử dụng vùng in thực tế nếu bật, hoặc dùng toàn bộ trang
            const effectivePrintW = usePrintArea ? printW : pageW;
            const effectivePrintH = usePrintArea ? printH : pageH;
            const result = calculateLayout({
                shape,
                itemW,
                itemH: effectiveItemH,
                padding,
                printW: effectivePrintW,
                printH: effectivePrintH,
                pageW,
                pageH
            });
            setPlans(result);
            if (currentPlanIndex >= result.length) {
                setCurrentPlanIndex(0);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [shape, itemW, itemH, padding, printW, printH, pageW, pageH, usePrintArea]);

    // Draw canvas preview
    useEffect(() => {
        const currentPlan = plans[currentPlanIndex];
        if (!showPreview || !canvasRef.current || !currentPlan) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const margin = 20;
        const availW = canvas.width - margin * 2;
        const availH = canvas.height - margin * 2;
        const scale = Math.min(availW / pageW, availH / pageH);

        const drawW = pageW * scale;
        const drawH = pageH * scale;
        const originX = (canvas.width - drawW) / 2;
        const originY = (canvas.height - drawH) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Vẽ trang giấy
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillRect(originX, originY, drawW, drawH);
        ctx.shadowColor = 'transparent';

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(originX, originY, drawW, drawH);

        // Vẽ vùng in (print area) - chỉ hiện khi bật
        if (usePrintArea) {
            const printOffsetX = (pageW - printW) / 2 * scale;
            const printOffsetY = (pageH - printH) / 2 * scale;
            ctx.strokeStyle = '#fda4af';
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(originX + printOffsetX, originY + printOffsetY, printW * scale, printH * scale);
            ctx.setLineDash([]);
        }

        const effectiveItemH = shape === 'circle' ? itemW : itemH;

        // Vẽ các items
        currentPlan.items.forEach((item, idx) => {
            const actualW = item.rot ? effectiveItemH : itemW;
            const actualH = item.rot ? itemW : effectiveItemH;

            const x = originX + item.x * scale;
            const y = originY + item.y * scale;
            const w = actualW * scale;
            const h = actualH * scale;

            // Màu theo cluster
            const color = idx < (currentPlan.items.length / 2) ? '#60a5fa' : '#34d399';

            ctx.fillStyle = color;

            if (shape === 'circle') {
                ctx.beginPath();
                ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            } else if (shape === 'oval') {
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            } else {
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, w, h);
            }
        });

        // Hiển thị kích thước
        ctx.fillStyle = '#64748b';
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillText(`${pageW}×${pageH}mm`, originX, originY - 6);

    }, [plans, currentPlanIndex, showPreview, pageW, pageH, printW, printH, shape, itemW, itemH, usePrintArea]);

    const currentPlan = plans[currentPlanIndex];
    const sheets = currentPlan && currentPlan.qty > 0 ? Math.ceil(totalOrder / currentPlan.qty) : 0;
    const totalCost = sheets * unitPrice;
    const pricePerItem = currentPlan && currentPlan.qty > 0 && sheets > 0
        ? totalCost / (sheets * currentPlan.qty)
        : 0;

    // Tự động tính vùng in khi thay đổi kích thước trang
    const handlePreset = (preset: typeof PAPER_PRESETS[0]) => {
        setPageW(preset.w);
        setPageH(preset.h);
        setPrintW(Math.max(0, preset.w - 20));
        setPrintH(Math.max(0, preset.h - 30));
        // Chỉ bật vùng in thực tế khi chọn 32x43 (decal)
        if (preset.label === '32x43') {
            setUsePrintArea(true);
        } else {
            setUsePrintArea(false);
        }
    };

    // Auto-update print area khi page size thay đổi thủ công
    const handlePageWChange = (v: number | null) => {
        const newW = v || 0;
        setPageW(newW);
        setPrintW(Math.max(0, newW - 20));
    };

    const handlePageHChange = (v: number | null) => {
        const newH = v || 0;
        setPageH(newH);
        setPrintH(Math.max(0, newH - 30));
    };

    const swapDims = () => {
        setPageW(pageH);
        setPageH(pageW);
        setPrintW(printH);
        setPrintH(printW);
    };

    return (
        <div className="min-h-screen bg-white text-gray-800 font-sans pb-28">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-purple-200 shadow-md">
                        <Grid3X3 className="w-5 h-5" />
                    </div>
                    Tính Bình Trang
                </h1>
                <div className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md">v1.0</div>
            </div>

            <div className="max-w-md mx-auto px-4 pt-6">
                <div className="space-y-6">

                    {/* Shape Selector */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                            <Box className="w-3 h-3" /> Hình dạng sản phẩm
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {SHAPES.map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => setShape(s.value)}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all ${shape === s.value
                                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}
                                >
                                    <s.icon className="w-5 h-5" />
                                    <span className="text-xs font-semibold">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Item Dimensions */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                            Kích thước sản phẩm
                        </h3>
                        <div className={`grid gap-3 ${shape === 'circle' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            <NumberInput
                                label="Chiều rộng"
                                value={itemW}
                                onChange={(v) => setItemW(v || 0)}
                                suffix="mm"
                            />
                            {shape !== 'circle' && (
                                <NumberInput
                                    label="Chiều cao"
                                    value={itemH}
                                    onChange={(v) => setItemH(v || 0)}
                                    suffix="mm"
                                />
                            )}
                            <NumberInput
                                label="Khoảng cách"
                                value={padding}
                                onChange={(v) => setPadding(v || 0)}
                                suffix="mm"
                            />
                        </div>
                    </section>

                    {/* Page Settings */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                            <Grid3X3 className="w-3 h-3" /> Khổ giấy in
                        </h3>

                        {/* Presets */}
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                            {PAPER_PRESETS.map(preset => (
                                <button
                                    key={preset.label}
                                    onClick={() => handlePreset(preset)}
                                    className={`px-3 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${pageW === preset.w && pageH === preset.h
                                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Custom size */}
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <NumberInput label="Rộng" value={pageW} onChange={handlePageWChange} suffix="mm" />
                            </div>
                            <button
                                onClick={swapDims}
                                className="w-12 h-[50px] bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                            <div className="flex-1">
                                <NumberInput label="Cao" value={pageH} onChange={handlePageHChange} suffix="mm" />
                            </div>
                        </div>

                        {/* Print area - với checkbox toggle */}
                        <div className={`rounded-xl p-3 space-y-2 transition-all ${usePrintArea ? 'bg-rose-50' : 'bg-gray-50'}`}>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={usePrintArea}
                                    onChange={(e) => setUsePrintArea(e.target.checked)}
                                    className="rounded text-rose-600 focus:ring-rose-500"
                                />
                                <span className={`text-[10px] font-bold uppercase ${usePrintArea ? 'text-rose-600' : 'text-gray-400'}`}>
                                    Vùng in thực tế (Áp dụng cho decal)
                                </span>
                            </label>
                            {usePrintArea && (
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberInput value={printW} onChange={(v) => setPrintW(v || 0)} suffix="mm" />
                                    <NumberInput value={printH} onChange={(v) => setPrintH(v || 0)} suffix="mm" />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Order & Price */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                            <Calculator className="w-3 h-3" /> Đơn hàng & Giá
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <NumberInput
                                label="Số lượng đặt"
                                value={totalOrder}
                                onChange={(v) => setTotalOrder(v || 0)}
                                suffix="cái"
                            />
                            <NumberInput
                                label="Giá in/tờ"
                                value={unitPrice}
                                onChange={(v) => setUnitPrice(v || 0)}
                                suffix="đ"
                            />
                        </div>
                    </section>

                    {/* Results Summary */}
                    {currentPlan && (
                        <div className="sticky bottom-0 left-0 right-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-lg z-40">
                            <div className="grid grid-cols-4 gap-2 items-center text-center">
                                <div>
                                    <div className="text-[10px] text-gray-400 font-semibold uppercase">Tem/tờ</div>
                                    <div className="text-lg font-bold text-purple-600">{currentPlan.qty}</div>
                                </div>
                                <div className="border-l border-gray-100">
                                    <div className="text-[10px] text-gray-400 font-semibold uppercase">Số tờ</div>
                                    <div className="text-lg font-bold text-gray-900">{sheets.toLocaleString()}</div>
                                </div>
                                <div className="border-l border-gray-100">
                                    <div className="text-[10px] text-gray-400 font-semibold uppercase">Đ/tem</div>
                                    <div className="text-base font-bold text-emerald-600">{Math.round(pricePerItem).toLocaleString()}</div>
                                </div>
                                <div className="border-l border-gray-100">
                                    <div className="text-[10px] text-gray-400 font-semibold uppercase">Tổng</div>
                                    <div className="text-base font-bold text-blue-600">{totalCost.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Plan Selector & Preview */}
                    {currentPlan ? (
                        <section className="pt-2 space-y-3">
                            {/* Select Plan Button */}
                            <button
                                onClick={() => setShowPlanModal(true)}
                                className="w-full p-3 bg-purple-50 border-2 border-purple-200 rounded-xl flex justify-between items-center hover:bg-purple-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                                        {currentPlanIndex + 1}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-purple-800 text-sm">{currentPlan.name}</div>
                                        <div className="text-xs text-purple-600">{currentPlan.description}</div>
                                    </div>
                                </div>
                                <div className="text-purple-600 text-xs font-semibold">
                                    {plans.length} phương án
                                </div>
                            </button>

                            {/* Preview */}
                            <div className="bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                                <div
                                    className="px-4 py-3 flex justify-between items-center bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
                                    onClick={() => setShowPreview(!showPreview)}
                                >
                                    <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                        <Maximize className="w-3 h-3" /> Sơ đồ xếp hình
                                    </span>
                                    {showPreview ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </div>
                                {showPreview && (
                                    <div className="p-4 flex justify-center bg-white">
                                        <canvas ref={canvasRef} width={350} height={300} className="w-full h-auto max-w-full" />
                                    </div>
                                )}
                            </div>
                        </section>
                    ) : (
                        <div className="bg-red-50 p-4 rounded-xl text-red-600 text-sm flex items-center gap-2 border border-red-100">
                            <AlertCircle className="w-5 h-5" />
                            Không tìm thấy phương án phù hợp. Hãy thử giảm kích thước sản phẩm.
                        </div>
                    )}

                    <div className="h-8"></div>
                </div>
            </div>

            {/* Plan Selection Modal */}
            {showPlanModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowPlanModal(false)}>
                    <div
                        className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900">Chọn phương án</h3>
                            <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500">
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-auto max-h-[60vh] space-y-2">
                            {plans.map((plan, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => { setCurrentPlanIndex(idx); setShowPlanModal(false); }}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${idx === currentPlanIndex
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-purple-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {idx === 0 ? <Trophy className="w-5 h-5" /> : idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800">{plan.name}</div>
                                                <div className="text-xs text-gray-500">{plan.description}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-purple-600">{plan.qty}</div>
                                            <div className="text-xs text-gray-400">tem/tờ</div>
                                        </div>
                                    </div>
                                    {idx === currentPlanIndex && (
                                        <div className="mt-2 flex items-center justify-center gap-1 text-purple-600 text-xs font-semibold">
                                            <Check className="w-4 h-4" /> Đang chọn
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImpositionCalculator;
