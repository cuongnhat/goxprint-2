import React from 'react';
import { StickyNote, Scroll } from 'lucide-react';

interface ModeSwitcherProps {
    mode: 'sheet' | 'roll';
    setMode: (mode: 'sheet' | 'roll') => void;
}

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({ mode, setMode }) => (
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

export default ModeSwitcher;
