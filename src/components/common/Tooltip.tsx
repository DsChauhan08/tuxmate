'use client';

import React, { useState, useEffect, useRef } from 'react';
import { type TooltipState } from '@/hooks/useTooltip';

interface TooltipProps {
    tooltip: TooltipState | null;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    setRef?: (el: HTMLDivElement | null) => void;
}

/**
 * Follow-cursor tooltip that appears on hover.
 * Desktop only - mobile users don't have a cursor to follow.
 * Supports markdown-ish formatting: **bold**, `code`, and [links](url).
 */
export function Tooltip({ tooltip, onMouseEnter, onMouseLeave, setRef }: TooltipProps) {
    const [current, setCurrent] = useState<TooltipState | null>(null);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (tooltip) {
            // eslint-disable-next-line
            setCurrent(tooltip);
            requestAnimationFrame(() => setVisible(true));
        } else {
            setVisible(false);
            timeoutRef.current = setTimeout(() => setCurrent(null), 60);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [tooltip]);

    if (!current) return null;

    const renderContent = (text: string) => {
        return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-medium text-[var(--text-primary)]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={i} className="px-1 py-0.5 rounded bg-black/20 font-mono text-[var(--accent)] text-[11px]">{part.slice(1, -1)}</code>;
            }
            if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
                const match = part.match(/\[(.*?)\]\((.*?)\)/);
                if (match) {
                    return (
                        <a key={i} href={match[2]} target="_blank" rel="noopener noreferrer"
                            className="text-[var(--accent)] underline underline-offset-2 hover:brightness-125 transition-all"
                            onClick={(e) => e.stopPropagation()}>
                            {match[1]}
                        </a>
                    );
                }
            }
            return <span key={i}>{part}</span>;
        });
    };

    const isRightAnchored = typeof window !== 'undefined' && (current.x + 300 > window.innerWidth);
    const contentTransform = isRightAnchored ? 'translateX(-278px)' : 'translateX(-22px)';

    return (
        <div
            ref={setRef}
            role="tooltip"
            className="fixed hidden md:block pointer-events-auto z-[9999]"
            style={{ left: current.x, top: current.y - 12 }} // Moved up slightly to clear cursor
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className={`
                absolute left-0 bottom-0
                transition-opacity duration-75
                ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}>
                {/* AccessGuide-style tooltip - rectangular with left border accent */}
                <div
                    className="px-3.5 py-2.5 shadow-lg overflow-hidden border-l-4 relative"
                    style={{
                        minWidth: '300px',
                        maxWidth: '300px',
                        backgroundColor: 'var(--bg-secondary)',
                        borderLeftColor: 'var(--accent)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                        transform: contentTransform, // Shift tooltip so arrow aligns with mouse
                    }}
                >
                    <p className="text-[13px] leading-[1.55] text-[var(--text-secondary)] break-words" style={{ wordBreak: 'break-word' }}>
                        {renderContent(current.content)}
                    </p>
                </div>

                {/* Arrow aligned to mouse position */}
                {/* Arrow at left: 16px matches the visual design, so we shift wrapper -22px to align 16px + 6px(half arrow) approx to 0 */}
                <div className="absolute left-0 -bottom-[6px]" style={{ transform: 'translateX(-6px)' }}>
                    <div
                        className="w-3 h-3 rotate-45"
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            boxShadow: '2px 2px 4px rgba(0,0,0,0.15)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
