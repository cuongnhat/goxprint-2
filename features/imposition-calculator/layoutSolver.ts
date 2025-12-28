// Layout calculation types and functions for imposition (bình trang)

export interface LayoutItem {
    x: number;
    y: number;
    rot: boolean; // true = rotated 90 degrees
}

export interface LayoutPlan {
    name: string;
    qty: number;
    items: LayoutItem[];
    description: string;
}

export interface LayoutConfig {
    shape: 'rect' | 'circle' | 'oval';
    itemW: number;
    itemH: number;
    padding: number;
    printW: number;
    printH: number;
    pageW: number;
    pageH: number;
}

/**
 * Tính toán các phương án xếp hình tối ưu
 * @param config - Cấu hình kích thước
 * @returns Mảng các phương án xếp hình
 */
export function calculateLayout(config: LayoutConfig): LayoutPlan[] {
    const { itemW, itemH, padding, printW, printH, pageW, pageH, shape } = config;

    if (itemW <= 0 || itemH <= 0 || printW <= 0 || printH <= 0) {
        return [];
    }

    // Với hình tròn, itemH = itemW
    const effectiveItemH = shape === 'circle' ? itemW : itemH;

    // Kích thước ô bao gồm padding
    const cellW = itemW + padding;
    const cellH = effectiveItemH + padding;

    // Offset để căn giữa vùng in trong trang
    const offsetX = (pageW - printW) / 2;
    const offsetY = (pageH - printH) / 2;

    const plans: LayoutPlan[] = [];

    // Helper: Tạo grid items với căn giữa trong vùng in
    const createGrid = (cols: number, rows: number, rotated: boolean, w: number, h: number): LayoutItem[] => {
        const items: LayoutItem[] = [];
        const gridW = cols * w + (cols - 1) * padding;
        const gridH = rows * h + (rows - 1) * padding;
        // Căn giữa grid trong vùng in
        const startX = offsetX + (printW - gridW) / 2;
        const startY = offsetY + (printH - gridH) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                items.push({
                    x: startX + c * (w + padding),
                    y: startY + r * (h + padding),
                    rot: rotated
                });
            }
        }
        return items;
    };

    // Helper: Tạo honeycomb/sole layout cho hình tròn (căn giữa)
    const createHoneycombGrid = (diameter: number): LayoutItem[] => {
        const items: LayoutItem[] = [];
        const d = diameter + padding;
        const rowHeight = d * Math.sqrt(3) / 2;

        const cols = Math.floor(printW / d);
        const rows = Math.floor(printH / rowHeight);

        if (cols <= 0 || rows <= 0) return items;

        // Tạm xếp từ góc để đếm số items thực tế
        const tempItems: { r: number; c: number; xOffset: number }[] = [];
        for (let r = 0; r < rows; r++) {
            const isOddRow = r % 2 === 1;
            const xOffset = isOddRow ? d / 2 : 0;
            const actualCols = isOddRow && (cols * d + xOffset > printW) ? cols - 1 : cols;

            for (let c = 0; c < actualCols; c++) {
                const x = c * d + xOffset;
                const y = r * rowHeight;
                if (x + diameter <= printW && y + diameter <= printH) {
                    tempItems.push({ r, c, xOffset });
                }
            }
        }

        if (tempItems.length === 0) return items;

        // Tính bounding box của honeycomb
        let maxX = 0, maxY = 0;
        tempItems.forEach(item => {
            const x = item.c * d + item.xOffset + diameter;
            const y = item.r * rowHeight + diameter;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        });

        // Căn giữa trong vùng in
        const centerOffsetX = offsetX + (printW - maxX) / 2;
        const centerOffsetY = offsetY + (printH - maxY) / 2;

        tempItems.forEach(item => {
            items.push({
                x: centerOffsetX + item.c * d + item.xOffset,
                y: centerOffsetY + item.r * rowHeight,
                rot: false
            });
        });

        return items;
    };

    // 1. Xếp thẳng (Portrait)
    const colsP = Math.floor(printW / cellW);
    const rowsP = Math.floor(printH / cellH);
    if (colsP > 0 && rowsP > 0) {
        plans.push({
            name: 'Xếp thẳng',
            qty: colsP * rowsP,
            items: createGrid(colsP, rowsP, false, itemW, effectiveItemH),
            description: `${colsP} cột × ${rowsP} hàng`
        });
    }

    // 2. Xếp sole/honeycomb (chỉ cho hình tròn)
    if (shape === 'circle') {
        const honeycombItems = createHoneycombGrid(itemW);
        if (honeycombItems.length > 0) {
            plans.push({
                name: 'Xếp sole (tối ưu)',
                qty: honeycombItems.length,
                items: honeycombItems,
                description: `Xếp kiểu tổ ong, ~15% hiệu quả hơn`
            });
        }
    }

    // 3. Tất cả ngang (Landscape) - chỉ cho rect/oval
    if (shape !== 'circle') {
        const colsL = Math.floor(printW / (effectiveItemH + padding));
        const rowsL = Math.floor(printH / (itemW + padding));
        if (colsL > 0 && rowsL > 0) {
            const qtyL = colsL * rowsL;
            if (qtyL !== colsP * rowsP) {
                plans.push({
                    name: 'Tất cả ngang',
                    qty: qtyL,
                    items: createGrid(colsL, rowsL, true, effectiveItemH, itemW),
                    description: `${colsL} cột × ${rowsL} hàng (xoay)`
                });
            }
        }
    }

    // Sắp xếp theo số lượng giảm dần
    plans.sort((a, b) => b.qty - a.qty);

    // Loại bỏ trùng lặp
    const uniquePlans: LayoutPlan[] = [];
    const seenQty = new Set<number>();
    for (const plan of plans) {
        if (!seenQty.has(plan.qty)) {
            seenQty.add(plan.qty);
            uniquePlans.push(plan);
        }
    }

    return uniquePlans.slice(0, 6); // Giới hạn 6 phương án
}

