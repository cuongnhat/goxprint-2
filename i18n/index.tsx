import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Supported languages
export type Language = 'vi' | 'en';

// Translation keys
export const translations = {
    vi: {
        // Home
        appName: 'GoXPrint',
        appTagline: 'Công cụ in ấn chuyên nghiệp',
        paperCalc: 'Tính giấy cắt',
        paperCalcSub: 'Paper Calculator',
        impositionCalc: 'Tính bình trang',
        impositionCalcSub: 'Imposition Calc',
        materialCalc: 'Tính vật tư',
        materialCalcSub: 'Material Calc',
        footer: 'Miễn phí cho ngành in',

        // Common
        back: 'Quay lại',
        reset: 'Làm mới',
        version: 'Phiên bản',

        // Imposition Calculator
        impTitle: 'Tính Bình Trang',
        shapeLabel: 'Hình dạng sản phẩm',
        shapeRect: 'Chữ nhật',
        shapeCircle: 'Tròn',
        shapeOval: 'Oval',
        productSize: 'Kích thước sản phẩm',
        width: 'Chiều rộng',
        height: 'Chiều cao',
        spacing: 'Khoảng cách',
        paperSize: 'Khổ giấy in',
        pageWidth: 'Rộng',
        pageHeight: 'Cao',
        printArea: 'Vùng in thực tế (Áp dụng cho decal)',
        orderPrice: 'Đơn hàng & Giá',
        orderQty: 'Số lượng đặt',
        pricePerSheet: 'Giá in/tờ',
        itemsPerSheet: 'Tem/tờ',
        totalSheets: 'Số tờ',
        pricePerItem: 'Đ/tem',
        totalCost: 'Tổng',
        selectPlan: 'Chọn phương án',
        layoutDiagram: 'Sơ đồ xếp hình',
        noLayoutFound: 'Không tìm thấy phương án phù hợp. Hãy thử giảm kích thước sản phẩm.',
        plans: 'phương án',
        selected: 'Đang chọn',
        straightLayout: 'Xếp thẳng',
        honeycombLayout: 'Xếp sole (tối ưu)',
        honeycombDesc: 'Xếp kiểu tổ ong, ~15% hiệu quả hơn',
        landscapeLayout: 'Tất cả ngang',
        cols: 'cột',
        rows: 'hàng',
        rotated: 'xoay',
        pcs: 'cái',
        currency: 'đ',
        mm: 'mm',
    },
    en: {
        // Home
        appName: 'GoXPrint',
        appTagline: 'Professional printing tools',
        paperCalc: 'Paper Calculator',
        paperCalcSub: 'Cut optimization',
        impositionCalc: 'Imposition Calc',
        impositionCalcSub: 'Layout planning',
        materialCalc: 'Material Calc',
        materialCalcSub: 'Cost estimation',
        footer: 'Free for printing industry',

        // Common
        back: 'Back',
        reset: 'Reset',
        version: 'Version',

        // Imposition Calculator
        impTitle: 'Imposition Calculator',
        shapeLabel: 'Product Shape',
        shapeRect: 'Rectangle',
        shapeCircle: 'Circle',
        shapeOval: 'Oval',
        productSize: 'Product Size',
        width: 'Width',
        height: 'Height',
        spacing: 'Spacing',
        paperSize: 'Paper Size',
        pageWidth: 'Width',
        pageHeight: 'Height',
        printArea: 'Print Area (For decals)',
        orderPrice: 'Order & Price',
        orderQty: 'Order Quantity',
        pricePerSheet: 'Price/Sheet',
        itemsPerSheet: 'Items/Sheet',
        totalSheets: 'Sheets',
        pricePerItem: '$/Item',
        totalCost: 'Total',
        selectPlan: 'Select Layout',
        layoutDiagram: 'Layout Diagram',
        noLayoutFound: 'No suitable layout found. Try reducing product size.',
        plans: 'layouts',
        selected: 'Selected',
        straightLayout: 'Straight',
        honeycombLayout: 'Honeycomb (optimal)',
        honeycombDesc: 'Honeycomb pattern, ~15% more efficient',
        landscapeLayout: 'All Landscape',
        cols: 'cols',
        rows: 'rows',
        rotated: 'rotated',
        pcs: 'pcs',
        currency: '$',
        mm: 'mm',
    }
};

interface I18nContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: (key: keyof typeof translations.vi) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Detect browser language
const detectLanguage = (): Language => {
    // Check localStorage first
    const saved = localStorage.getItem('goxprint_lang');
    if (saved === 'vi' || saved === 'en') return saved;

    // Check browser language
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
    if (browserLang.startsWith('vi')) return 'vi';

    return 'en';
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [lang, setLangState] = useState<Language>('vi');

    useEffect(() => {
        setLangState(detectLanguage());
    }, []);

    const setLang = (newLang: Language) => {
        setLangState(newLang);
        localStorage.setItem('goxprint_lang', newLang);
    };

    const t = (key: keyof typeof translations.vi): string => {
        return translations[lang][key] || key;
    };

    return (
        <I18nContext.Provider value={{ lang, setLang, t }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within I18nProvider');
    }
    return context;
};
