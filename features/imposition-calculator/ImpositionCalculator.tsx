import React, { useState, useEffect, useRef, useCallback } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
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
    Check,
    RotateCcw,
    HelpCircle
} from 'lucide-react';
import NumberInput from '../../components/NumberInput';
import { calculateLayout, LayoutPlan } from './layoutSolver';
import { useI18n } from '../../i18n';

// Các khổ giấy preset (chỉ lưu kích thước trang, vùng in tự tính)
const PAPER_PRESETS = [
    { label: '32x43', w: 320, h: 430 },
    { label: '32x47', w: 320, h: 470 },
    { label: '31x42.5', w: 310, h: 425 },
    { label: 'A4', w: 210, h: 297 },
    { label: 'A3', w: 297, h: 420 },
];

const ImpositionCalculator: React.FC = () => {
    const { t } = useI18n();

    // Default values for reset
    const defaults = {
        shape: 'rect' as 'rect' | 'circle' | 'oval',
        itemW: 100,
        itemH: 120,
        padding: 0,
        pageW: 330,
        pageH: 480,
        printW: 310,
        printH: 450,
        usePrintArea: false,
        totalOrder: 1000,
        unitPrice: 10000
    };

    // Load from localStorage or use defaults
    const loadState = <T,>(key: string, defaultValue: T): T => {
        try {
            const saved = localStorage.getItem(`impCalc_${key}`);
            return saved ? JSON.parse(saved) : defaultValue;
        } catch {
            return defaultValue;
        }
    };

    // Config state
    const [shape, setShape] = useState<'rect' | 'circle' | 'oval'>(() => loadState('shape', defaults.shape));
    const [itemW, setItemW] = useState(() => loadState('itemW', defaults.itemW));
    const [itemH, setItemH] = useState(() => loadState('itemH', defaults.itemH));
    const [padding, setPadding] = useState(() => loadState('padding', defaults.padding));

    // Page settings
    const [pageW, setPageW] = useState(() => loadState('pageW', defaults.pageW));
    const [pageH, setPageH] = useState(() => loadState('pageH', defaults.pageH));
    const [printW, setPrintW] = useState(() => loadState('printW', defaults.printW));
    const [printH, setPrintH] = useState(() => loadState('printH', defaults.printH));
    const [usePrintArea, setUsePrintArea] = useState(() => loadState('usePrintArea', defaults.usePrintArea));

    // Order & Pricing
    const [totalOrder, setTotalOrder] = useState(() => loadState('totalOrder', defaults.totalOrder));
    const [unitPrice, setUnitPrice] = useState(() => loadState('unitPrice', defaults.unitPrice));

    // Results
    const [plans, setPlans] = useState<LayoutPlan[]>([]);
    const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
    const [showPreview, setShowPreview] = useState(true);
    const [showPlanModal, setShowPlanModal] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Save to localStorage when inputs change
    useEffect(() => { localStorage.setItem('impCalc_shape', JSON.stringify(shape)); }, [shape]);
    useEffect(() => { localStorage.setItem('impCalc_itemW', JSON.stringify(itemW)); }, [itemW]);
    useEffect(() => { localStorage.setItem('impCalc_itemH', JSON.stringify(itemH)); }, [itemH]);
    useEffect(() => { localStorage.setItem('impCalc_padding', JSON.stringify(padding)); }, [padding]);
    useEffect(() => { localStorage.setItem('impCalc_pageW', JSON.stringify(pageW)); }, [pageW]);
    useEffect(() => { localStorage.setItem('impCalc_pageH', JSON.stringify(pageH)); }, [pageH]);
    useEffect(() => { localStorage.setItem('impCalc_printW', JSON.stringify(printW)); }, [printW]);
    useEffect(() => { localStorage.setItem('impCalc_printH', JSON.stringify(printH)); }, [printH]);
    useEffect(() => { localStorage.setItem('impCalc_usePrintArea', JSON.stringify(usePrintArea)); }, [usePrintArea]);
    useEffect(() => { localStorage.setItem('impCalc_totalOrder', JSON.stringify(totalOrder)); }, [totalOrder]);
    useEffect(() => { localStorage.setItem('impCalc_unitPrice', JSON.stringify(unitPrice)); }, [unitPrice]);

    // Reset function
    const handleReset = () => {
        setShape(defaults.shape);
        setItemW(defaults.itemW);
        setItemH(defaults.itemH);
        setPadding(defaults.padding);
        setPageW(defaults.pageW);
        setPageH(defaults.pageH);
        setPrintW(defaults.printW);
        setPrintH(defaults.printH);
        setUsePrintArea(defaults.usePrintArea);
        setTotalOrder(defaults.totalOrder);
        setUnitPrice(defaults.unitPrice);
        setCurrentPlanIndex(0);
    };

    // Tour state - auto-start for first-time visitors
    const [runTour, setRunTour] = useState(() => {
        const hasSeenTour = localStorage.getItem('impCalc_tourSeen');
        return !hasSeenTour;
    });
    const [tourStepIndex, setTourStepIndex] = useState(0);
    const [countdown, setCountdown] = useState(5);
    const TOUR_DELAY = 5;

    const tourContents = [
        t('tourImpWelcome'),
        t('tourImpShape'),
        t('tourImpItemSize'),
        t('tourImpPadding'),
        t('tourImpPaperPreset'),
        t('tourImpPaperSize'),
        t('tourImpLayout'),
        t('tourImpPreview'),
        t('tourImpOrder'),
        t('tourImpResult'),
    ];

    const tourSteps: Step[] = [
        { target: 'body', content: '', placement: 'center' as const, disableBeacon: true },
        { target: '#shape-section', content: '', placement: 'bottom' as const },
        { target: '#item-size-section', content: '', placement: 'bottom' as const },
        { target: '#padding-section', content: '', placement: 'bottom' as const },
        { target: '#paper-preset-section', content: '', placement: 'bottom' as const },
        { target: '#paper-size-section', content: '', placement: 'bottom' as const },
        { target: '#layout-section', content: '', placement: 'bottom' as const },
        { target: '#preview-section', content: '', placement: 'top' as const },
        { target: '#order-section', content: '', placement: 'top' as const },
        { target: '#result-section', content: '', placement: 'top' as const },
    ].map((step, idx) => ({
        ...step,
        content: (
            <div>
                <div>{tourContents[idx]}</div>
                <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <span className="inline-block w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></span>
                    {countdown}s
                </div>
            </div>
        ),
    }));

    // Countdown timer
    useEffect(() => {
        if (!runTour) return;

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    if (tourStepIndex < tourContents.length - 1) {
                        setTourStepIndex(i => i + 1);
                    } else {
                        setRunTour(false);
                        localStorage.setItem('impCalc_tourSeen', 'true');
                    }
                    return TOUR_DELAY;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [runTour, tourStepIndex, tourContents.length]);

    const handleTourCallback = (data: CallBackProps) => {
        const { status, action, index, type } = data;

        if (type === 'step:after') {
            if (action === 'next') {
                setTourStepIndex(index + 1);
                setCountdown(TOUR_DELAY);
            } else if (action === 'prev') {
                setTourStepIndex(index - 1);
                setCountdown(TOUR_DELAY);
            }
        }

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRunTour(false);
            setTourStepIndex(0);
            setCountdown(TOUR_DELAY);
            localStorage.setItem('impCalc_tourSeen', 'true');
        }
    };

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
                pageH,
                translations: {
                    straightLayout: t('straightLayout'),
                    honeycombLayout: t('honeycombLayout'),
                    honeycombDesc: t('honeycombDesc'),
                    landscapeLayout: t('landscapeLayout'),
                    cols: t('cols'),
                    rows: t('rows'),
                    rotated: t('rotated')
                }
            });
            setPlans(result);
            if (currentPlanIndex >= result.length) {
                setCurrentPlanIndex(0);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [shape, itemW, itemH, padding, printW, printH, pageW, pageH, usePrintArea, t]);

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
            {/* Joyride Tour */}
            <Joyride
                steps={tourSteps}
                run={runTour}
                stepIndex={tourStepIndex}
                continuous
                showProgress
                showSkipButton
                callback={handleTourCallback}
                locale={{
                    back: t('tourBack'),
                    close: t('close'),
                    last: t('tourFinish'),
                    next: t('tourNext'),
                    skip: t('tourSkip'),
                }}
                styles={{
                    options: {
                        primaryColor: '#9333ea',
                        zIndex: 10000,
                    },
                    tooltip: {
                        borderRadius: 12,
                    },
                }}
            />

            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-purple-200 shadow-md">
                        <Grid3X3 className="w-5 h-5" />
                    </div>
                    {t('impTitle')}
                </h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setTourStepIndex(0); setCountdown(TOUR_DELAY); setRunTour(true); }} className="p-2 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition" title={t('startTour')}>
                        <HelpCircle className="w-5 h-5" />
                    </button>
                    <button onClick={handleReset} className="p-2 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-600 transition" title={t('reset')}>
                        <RotateCcw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 pt-6">
                <div className="space-y-6">

                    {/* Shape Selector */}
                    <section id="shape-section" className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                            <Box className="w-3 h-3" /> {t('shapeLabel')}
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'rect' as const, labelKey: 'shapeRect' as const, icon: Square },
                                { value: 'circle' as const, labelKey: 'shapeCircle' as const, icon: Circle },
                                { value: 'oval' as const, labelKey: 'shapeOval' as const, icon: RectangleHorizontal },
                            ].map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => setShape(s.value)}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all ${shape === s.value
                                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}
                                >
                                    <s.icon className="w-5 h-5" />
                                    <span className="text-xs font-semibold">{t(s.labelKey)}</span>
                                </button>
                            ))}
                        </div>
                    </section>


                    {/* Item Dimensions */}
                    <section id="item-size-section" className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                            {t('productSize')}
                        </h3>
                        <div className={`grid gap-3 ${shape === 'circle' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            <NumberInput
                                label={t('width')}
                                value={itemW}
                                onChange={(v) => setItemW(v || 0)}
                                suffix={t('mm')}
                            />
                            {shape !== 'circle' && (
                                <NumberInput
                                    label={t('height')}
                                    value={itemH}
                                    onChange={(v) => setItemH(v || 0)}
                                    suffix={t('mm')}
                                />
                            )}
                            <NumberInput
                                label={t('spacing')}
                                value={padding}
                                onChange={(v) => setPadding(v || 0)}
                                suffix={t('mm')}
                            />
                        </div>
                    </section>

                    {/* Page Settings */}
                    <section id="paper-size-section" className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                            <Grid3X3 className="w-3 h-3" /> {t('paperSize')}
                        </h3>

                        {/* Presets */}
                        <div id="paper-preset-section" className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
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
                                <NumberInput label={t('pageWidth')} value={pageW} onChange={handlePageWChange} suffix={t('mm')} />
                            </div>
                            <button
                                onClick={swapDims}
                                className="w-12 h-[50px] bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                            <div className="flex-1">
                                <NumberInput label={t('pageHeight')} value={pageH} onChange={handlePageHChange} suffix={t('mm')} />
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
                                    {t('printArea')}
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
                    <section id="order-section" className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                            <Calculator className="w-3 h-3" /> {t('orderPrice')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <NumberInput
                                label={t('orderQty')}
                                value={totalOrder}
                                onChange={(v) => setTotalOrder(v || 0)}
                                suffix={t('pcs')}
                            />
                            <NumberInput
                                label={t('pricePerSheet')}
                                value={unitPrice}
                                onChange={(v) => setUnitPrice(v || 0)}
                                suffix={t('currency')}
                            />
                        </div>
                    </section>

                    {/* Results Summary */}
                    {currentPlan && (
                        <div id="result-section" className="sticky bottom-0 left-0 right-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-lg z-40">
                            <div className="grid grid-cols-4 gap-2 items-center text-center">
                                <div>
                                    <div className="text-[10px] text-gray-400 font-semibold uppercase">{t('itemsPerSheet')}</div>
                                    <div className="text-lg font-bold text-purple-600">{currentPlan.qty}</div>
                                </div>
                                <div className="border-l border-gray-100">
                                    <div className="text-[10px] text-gray-400 font-semibold uppercase">{t('totalSheets')}</div>
                                    <div className="text-lg font-bold text-gray-900">{sheets.toLocaleString()}</div>
                                </div>
                                <div className="border-l border-gray-100">
                                    <div className="text-[10px] text-gray-400 font-semibold uppercase">{t('pricePerItem')}</div>
                                    <div className="text-base font-bold text-emerald-600">{Math.round(pricePerItem).toLocaleString()}</div>
                                </div>
                                <div className="border-l border-gray-100">
                                    <div className="text-[10px] text-gray-400 font-semibold uppercase">{t('totalCost')}</div>
                                    <div className="text-base font-bold text-blue-600">{totalCost.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Plan Selector & Preview */}
                    {currentPlan ? (
                        <section id="layout-section" className="pt-2 space-y-3">
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
                                    {plans.length} {t('plans')}
                                </div>
                            </button>

                            {/* Preview */}
                            <div id="preview-section" className="bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                                <div
                                    className="px-4 py-3 flex justify-between items-center bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
                                    onClick={() => setShowPreview(!showPreview)}
                                >
                                    <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                        <Maximize className="w-3 h-3" /> {t('layoutDiagram')}
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
                            {t('noLayoutFound')}
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
                            <h3 className="font-bold text-lg text-gray-900">{t('selectPlan')}</h3>
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
                                            <div className="text-xs text-gray-400">{t('itemsPerSheet')}</div>
                                        </div>
                                    </div>
                                    {idx === currentPlanIndex && (
                                        <div className="mt-2 flex items-center justify-center gap-1 text-purple-600 text-xs font-semibold">
                                            <Check className="w-4 h-4" /> {t('selected')}
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
