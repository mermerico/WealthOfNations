import React from 'react';
import type { HexCell, Player } from '../../types/gameState';
import { Hex } from './Hex';

import type { IndustryType } from '../../types/gameState';

interface BoardProps {
    board: Record<string, HexCell>;
    players: Player[];
    onCellClick?: (cell: HexCell) => void;
    selectedCellId?: string;
    ghostTile?: { id: string, type: IndustryType, orientation: number } | null;
    highlightedCells?: string[];
    hoverHighlightedCells?: string[];
}

export const Board: React.FC<BoardProps> = ({ board, players, onCellClick, selectedCellId, ghostTile, highlightedCells, hoverHighlightedCells }) => {
    const cells = Object.values(board);

    // Auto-fit logic (simplified)
    // const bounds = useMemo(() => {
    //     if (cells.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    //     return { minX: -400, maxX: 400, minY: -400, maxY: 400 };
    // }, [cells.length]);

    // const width = bounds.maxX - bounds.minX + 100;
    // const height = bounds.maxY - bounds.minY + 100;
    // const viewBox = `${bounds.minX - 50} ${bounds.minY - 50} ${width} ${height}`;

    return (
        <svg style={{ width: '100%', height: '100%', cursor: 'grab' }} viewBox="-500 -500 1000 1000">
            <g>
                {/* First pass: render all hex fills and content */}
                <g>
                    {cells.map((cell) => {
                        const id = `${cell.q},${cell.r}`;
                        const isGhost = ghostTile && ghostTile.id === id;
                        const isHighlighted = highlightedCells ? highlightedCells.includes(id) : false;
                        const isHoverHighlighted = hoverHighlightedCells ? hoverHighlightedCells.includes(id) : false;

                        return (
                            <Hex
                                key={id}
                                cell={cell}
                                board={board}
                                players={players}
                                onClick={onCellClick}
                                isSelected={selectedCellId === id}
                                ghostTile={isGhost ? { type: ghostTile.type, orientation: ghostTile.orientation } : undefined}
                                isHighlighted={isHighlighted}
                                isHoverHighlighted={isHoverHighlighted}
                                renderBorder={false}
                            />
                        );
                    })}
                </g>
                {/* Second pass: render all borders on top */}
                <g>
                    {/* First render non-highlighted, non-selected borders */}
                    {cells.filter((cell) => {
                        const id = `${cell.q},${cell.r}`;
                        const isHighlighted = highlightedCells ? highlightedCells.includes(id) : false;
                        const isHoverHighlighted = hoverHighlightedCells ? hoverHighlightedCells.includes(id) : false;
                        const isSelected = selectedCellId === id;
                        return !isHighlighted && !isHoverHighlighted && !isSelected;
                    }).map((cell) => {
                        const id = `${cell.q},${cell.r}`;
                        const isGhost = ghostTile && ghostTile.id === id;

                        return (
                            <Hex
                                key={`border-${id}`}
                                cell={cell}
                                board={board}
                                players={players}
                                isSelected={false}
                                ghostTile={isGhost ? { type: ghostTile.type, orientation: ghostTile.orientation } : undefined}
                                isHighlighted={false}
                                isHoverHighlighted={false}
                                renderBorder={true}
                            />
                        );
                    })}
                    {/* Then render highlighted/hover highlighted borders */}
                    {cells.filter((cell) => {
                        const id = `${cell.q},${cell.r}`;
                        const isHighlighted = highlightedCells ? highlightedCells.includes(id) : false;
                        const isHoverHighlighted = hoverHighlightedCells ? hoverHighlightedCells.includes(id) : false;
                        const isSelected = selectedCellId === id;
                        return (isHighlighted || isHoverHighlighted) && !isSelected;
                    }).map((cell) => {
                        const id = `${cell.q},${cell.r}`;
                        const isGhost = ghostTile && ghostTile.id === id;
                        const isHighlighted = highlightedCells ? highlightedCells.includes(id) : false;
                        const isHoverHighlighted = hoverHighlightedCells ? hoverHighlightedCells.includes(id) : false;

                        return (
                            <Hex
                                key={`border-${id}`}
                                cell={cell}
                                board={board}
                                players={players}
                                isSelected={false}
                                ghostTile={isGhost ? { type: ghostTile.type, orientation: ghostTile.orientation } : undefined}
                                isHighlighted={isHighlighted}
                                isHoverHighlighted={isHoverHighlighted}
                                renderBorder={true}
                            />
                        );
                    })}
                    {/* Finally render selected borders on top of everything */}
                    {cells.filter((cell) => {
                        const id = `${cell.q},${cell.r}`;
                        return selectedCellId === id;
                    }).map((cell) => {
                        const id = `${cell.q},${cell.r}`;
                        const isGhost = ghostTile && ghostTile.id === id;

                        return (
                            <Hex
                                key={`border-${id}`}
                                cell={cell}
                                board={board}
                                players={players}
                                isSelected={true}
                                ghostTile={isGhost ? { type: ghostTile.type, orientation: ghostTile.orientation } : undefined}
                                isHighlighted={false}
                                isHoverHighlighted={false}
                                renderBorder={true}
                            />
                        );
                    })}
                </g>
            </g>
        </svg>
    );
};
