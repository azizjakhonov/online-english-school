import { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmLeaveModalProps {
    open: boolean;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    /** If true, the confirm button is rendered red. */
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Reusable "Leave class?" confirmation modal.
 *
 * Design matches the existing classroom exit modal (same bg-white / rounded-2xl /
 * shadow-2xl / backdrop-blur-sm). All text is overridable via props.
 */
export default function ConfirmLeaveModal({
    open,
    title = 'Leave class?',
    description,
    confirmText = 'Leave',
    cancelText = 'Stay',
    danger = true,
    onConfirm,
    onCancel,
}: ConfirmLeaveModalProps) {
    // Keyboard: ESC → cancel
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
                            <AlertTriangle size={17} className={danger ? 'text-red-500' : 'text-amber-500'} />
                        </div>
                        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                        aria-label="Close"
                    >
                        <X size={17} />
                    </button>
                </div>

                {/* Body */}
                {description && (
                    <p className="px-5 py-4 text-sm text-gray-600 leading-relaxed">
                        {description}
                    </p>
                )}

                {/* Actions */}
                <div className="flex gap-3 px-5 pb-5 pt-2">
                    {/* Stay / Cancel — primary visual weight */}
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                        {cancelText}
                    </button>

                    {/* Leave / Confirm */}
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${danger
                            ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400'
                            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
