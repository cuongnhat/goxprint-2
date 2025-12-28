import React, { useState } from 'react';

interface NumberInputProps {
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    className?: string;
    placeholder?: string;
    suffix?: string;
    label?: string;
    [key: string]: any;
}

const NumberInput: React.FC<NumberInputProps> = ({
    value,
    onChange,
    className = '',
    placeholder,
    suffix,
    label,
    ...props
}) => {
    const [localValue, setLocalValue] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        setLocalValue(inputValue);
        setIsEditing(true);

        const rawValue = inputValue.replace(/\./g, '').replace(/,/g, '.');
        if (rawValue === '') {
            onChange(null);
            return;
        }
        const numberValue = parseFloat(rawValue);
        if (!isNaN(numberValue)) onChange(numberValue);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (localValue === '') {
            setLocalValue('');
            onChange(null);
        }
    };

    const displayValue = isEditing ? localValue : (
        value !== undefined && value !== null && value !== 0
            ? value.toLocaleString('vi-VN', { maximumFractionDigits: 10 })
            : ''
    );

    return (
        <div className="relative w-full group">
            {label && <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    inputMode="decimal"
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
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

export default NumberInput;
