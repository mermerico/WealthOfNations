import React from 'react';
import type { HexCell, CommodityType, TileFeature, IndustryType } from '../../types/gameState';
import { HEX_SIZE, hexToPixel, coordsToString, getNeighbor, getNeighbors } from '../../utils/hexUtils';
import { TILE_DEFINITIONS } from '../../utils/tileDefinitions';

interface HexProps {
    cell: HexCell;
    board?: Record<string, HexCell>;
    players?: import('../../types/gameState').Player[];
    onClick?: (cell: HexCell) => void;
    isSelected?: boolean;
    ghostTile?: { type: import('../../types/gameState').IndustryType, orientation: number };
    isHighlighted?: boolean;
    isHoverHighlighted?: boolean;
    renderBorder?: boolean;
}

const HEX_POINTS = calculateHexPoints(HEX_SIZE);

function calculateHexPoints(radius: number): string {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i;
        const angle_rad = Math.PI / 180 * angle_deg;
        const x = radius * Math.cos(angle_rad);
        const y = radius * Math.sin(angle_rad);
        points.push(`${x},${y}`);
    }
    return points.join(' ');
}

const COMMODITY_COLORS: Record<CommodityType | string, string> = {
    Food: '#facc15',   // Yellow
    Energy: '#3b82f6', // Blue
    Labor: '#ef4444',  // Red
    Ore: '#9ca3af',    // Gray/White
    Capital: '#000000',// Black
    Money: '#a855f7',  // Purple (Bank)
};

// Angles for Edges (0=N, 1=NE, etc.)
// N is 270 deg (-90), NE is 330 (-30), SE is 30...
const EDGE_ANGLES = [270, 330, 30, 90, 150, 210];

// Angles for Corners (0=Between N and NE -> Top Right Vertex)
const CORNER_ANGLES = [300, 0, 60, 120, 180, 240];

export const Hex: React.FC<HexProps> = ({ cell, board, players, onClick, isSelected, ghostTile, isHighlighted, isHoverHighlighted, renderBorder = false }) => {
    const { x, y } = hexToPixel(cell.q, cell.r);

    // Central hex is black (forbidden)
    const isCentralHex = cell.q === 0 && cell.r === 0;
    let fill = isCentralHex ? '#000' : '#333';
    let label = `${cell.q},${cell.r}`;
    let features: React.ReactNode[] = [];
    let rotation = 0;

    // Ghost Tile Override
    const activeTileType = ghostTile?.type || (cell.occupant?.type === 'Industry' ? cell.occupant.tile?.type : null);
    const activeOrientation = ghostTile ? ghostTile.orientation : (cell.occupant?.type === 'Industry' ? cell.occupant.tile?.orientation : 0);

    // Standardize feature dot size
    const FEATURE_RADIUS = HEX_SIZE * 0.20;

    // Unique ID for the clip path
    const clipId = `clip-${cell.q}-${cell.r}`;

    if (activeTileType) {
        fill = ghostTile ? '#555555' : '#555';
        label = activeTileType;
        rotation = (activeOrientation || 0) * 60;

        const def = TILE_DEFINITIONS[activeTileType];
        if (def) {
            // Render Center Dot
            if (def.hasCenterDot) {
                const centerColor = def.features[0]?.commodity ? COMMODITY_COLORS[def.features[0].commodity] : 'white';
                features.push(
                    <circle key="center" cx="0" cy="0" r={HEX_SIZE * 0.25} fill={centerColor} stroke="white" strokeWidth="1" />
                );
            }

            // Render Features
            def.features.forEach((feat, idx) => {
                const color = feat.commodity ? COMMODITY_COLORS[feat.commodity] : 'white';
                const key = `feat-${idx}`;
                let opacity = 1.0;

                const myPlayerId = cell.occupant?.playerId;

                if (feat.type === 'Edge' && board && myPlayerId) {
                    // Check neighbor for shared dot
                    const absoluteSide = (feat.position + (activeOrientation || 0)) % 6;
                    const neighborCoords = getNeighbor({ q: cell.q, r: cell.r }, absoluteSide);
                    const neighborId = coordsToString(neighborCoords.q, neighborCoords.r);
                    const neighborCell = board[neighborId];

                    let hasMatchingNeighbor = false;

                    if (neighborCell && neighborCell.occupant?.type === 'Industry' && neighborCell.occupant.tile) {
                        const nTile = neighborCell.occupant.tile;
                        const nDef = TILE_DEFINITIONS[nTile.type];
                        const sideFacingMe = (absoluteSide + 3) % 6;
                        const nDefSideIndex = (sideFacingMe - (nTile.orientation || 0) + 6) % 6;
                        const nFeat = nDef.features.find((f: TileFeature) => f.position === nDefSideIndex && f.type === 'Edge' && f.feature === 'HalfDot');

                        if (nFeat && nFeat.commodity === feat.commodity) {
                            hasMatchingNeighbor = true;
                            const nOwnerId = neighborCell.occupant.playerId;
                            if (nOwnerId !== myPlayerId) {
                                opacity = 0.3; // Shared dot between different players
                            }
                        }
                    }

                    // If no matching neighbor, make it transparent (incomplete dot)
                    if (!hasMatchingNeighbor) {
                        opacity = 0.3;
                    }
                }

                if (feat.type === 'Edge') {
                    const angleDeg = EDGE_ANGLES[feat.position];
                    const angleRad = angleDeg * Math.PI / 180;
                    const dist = (Math.sqrt(3) / 2) * HEX_SIZE;
                    const fx = dist * Math.cos(angleRad);
                    const fy = dist * Math.sin(angleRad);
                    features.push(
                        <circle key={key} cx={fx} cy={fy} r={FEATURE_RADIUS} fill={color} stroke="white" strokeWidth="1" opacity={opacity} />
                    );
                } else if (feat.type === 'Corner') {
                    // Corner Match Logic for Dimming
                    const k = (feat.position + (activeOrientation || 0)) % 6;
                    const neighbors = getNeighbors({ q: cell.q, r: cell.r }, board || {});
                    const n1 = neighbors[k];
                    const n2 = neighbors[(k + 1) % 6];

                    let hasCompleteCorner = false;

                    if (n1 && n1.occupant?.type === 'Industry' && n1.occupant.tile &&
                        n2 && n2.occupant?.type === 'Industry' && n2.occupant.tile &&
                        myPlayerId) {

                        const t1 = n1.occupant.tile;
                        const t2 = n2.occupant.tile;
                        const def1 = TILE_DEFINITIONS[t1.type as IndustryType];
                        const def2 = TILE_DEFINITIONS[t2.type as IndustryType];

                        // Rule: Match k touches n[k] (Corner (k+2)%6) and n[k+1] (Corner (k+4)%6)
                        const n1DefIdx = ((k + 2) % 6 - (t1.orientation || 0) + 6) % 6;
                        const n2DefIdx = ((k + 4) % 6 - (t2.orientation || 0) + 6) % 6;

                        const f1 = def1.features.find((f: TileFeature) => f.type === 'Corner' && f.position === n1DefIdx);
                        const f2 = def2.features.find((f: TileFeature) => f.type === 'Corner' && f.position === n2DefIdx);

                        if (f1 && f2 && f1.commodity === feat.commodity && f2.commodity === feat.commodity) {
                            // Full match - corner is complete
                            hasCompleteCorner = true;

                            // Check ownership - dim if different player
                            if (t1.ownerId !== myPlayerId || t2.ownerId !== myPlayerId) {
                                opacity = 0.3;
                            }
                        }
                    }

                    // If corner is not complete (missing one or both neighbors), make it transparent
                    if (!hasCompleteCorner) {
                        opacity = 0.3;
                    }

                    const angleDeg = CORNER_ANGLES[feat.position];
                    const angleRad = angleDeg * Math.PI / 180;
                    const fx = HEX_SIZE * Math.cos(angleRad);
                    const fy = HEX_SIZE * Math.sin(angleRad);
                    features.push(
                        <circle key={key} cx={fx} cy={fy} r={FEATURE_RADIUS} fill={color} stroke="white" strokeWidth="1" opacity={opacity} />
                    );
                }
            });
        }
    }

    let flagElements: React.ReactNode[] = [];

    // Flag Rendering
    const renderFlag = (playerId: string, size: number, offsetX: number, offsetY: number) => {
        const player = players?.find(p => p.id === playerId);
        const flagFile = player?.flag || (playerId === 'p1' ? 'anglica.svg' : 'bolshevica.svg');
        return (
            <image
                key={`flag-${playerId}-${offsetX}`}
                href={`/flags/${flagFile}`}
                x={offsetX - size} // Center based on 2:1 width
                y={offsetY - size * 0.5}
                width={size * 2}
                height={size}
                style={{ pointerEvents: 'none' }}
            />
        );
    };

    if (cell.occupant) {
        if (cell.occupant.type === 'Flag') {
            flagElements.push(renderFlag(cell.occupant.playerId, 20, 0, 0));
        } else if (cell.occupant.type === 'Industry') {
            // SW is at index 4 in DIRECTIONS. hexToPixel(-1, 1) relative to center is {-1.5S, 0.866S}
            // Increase flag size to 16 height (32 width)
            // Tweak position to ~30% towards edge (closer to center than before)
            flagElements.push(renderFlag(cell.occupant.playerId, 16, -0.45 * HEX_SIZE, 0.26 * HEX_SIZE));
        }
    }

    // Apply rotation only to the industry content group
    const contentTransform = `rotate(${rotation})`;

    const opacity = ghostTile ? 0.6 : 1;
    const strokeDash = ghostTile ? "5,5" : "";

    // Valid Drop Target style
    // Highlighted: green border (placement validation)
    // Hover Highlighted: orange/yellow border (production hover)
    // Selected: white border
    // Ghost: cyan border
    let strokeColor = 'black';
    let strokeWidth = 1;

    if (isSelected) {
        strokeColor = 'white';
        strokeWidth = 3;
    } else if (isHoverHighlighted) {
        strokeColor = '#facc15'; // Yellow/orange for production hover
        strokeWidth = 4;
    } else if (isHighlighted) {
        strokeColor = '#4ade80'; // Green for valid placement
        strokeWidth = 3;
    } else if (ghostTile) {
        strokeColor = 'cyan';
        strokeWidth = 2;
    }

    // If renderBorder is true, only render the border
    if (renderBorder) {
        return (
            <g transform={`translate(${x},${y})`} style={{ pointerEvents: 'none' }}>
                <polygon
                    points={HEX_POINTS}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                    vectorEffect="non-scaling-stroke"
                />
            </g>
        );
    }

    // Otherwise, render everything except the border
    return (
        <g transform={`translate(${x},${y})`} onClick={() => onClick?.(cell)} style={{ cursor: 'pointer', opacity }}>
            <defs>
                <clipPath id={clipId}>
                    <polygon points={HEX_POINTS} />
                </clipPath>
            </defs>

            {/* Base Hex (fill only, no stroke) */}
            <polygon
                points={HEX_POINTS}
                fill={isSelected ? '#666' : fill}
                stroke="none"
            />

            {/* Features Group - Rotated & Clipped */}
            <g transform={contentTransform} clipPath={`url(#${clipId})`}>
                {features}
            </g>

            {/* Flag Overlay - Rendered AFTER clipped features to prevent cutting */}
            {flagElements}

            {/* Automation Token (Hexagon with circular center cutout) */}
            {cell.occupant?.type === 'Industry' && cell.occupant.tile?.automated && (
                <path
                    d="M0,-21 L18.18,-10.5 18.18,10.5 0,21 -18.18,10.5 -18.18,-10.5 Z M0,-9 A9,9 0 1,1 -0.001,-9 Z"
                    fill="#999999ff"
                    stroke="white"
                    strokeWidth="1.5"
                    fillRule="evenodd"
                />
            )}
            {/* Label stays upright, so output it outside the rotated group if we want it to read normally? 
                Or inside if we want it to rotate with tile. Usually easier to read if upright. 
                But features map to N/S/E/W relative to tile orientation? 
                Yes, if I rotate the tile content, features move. 
                The `features` positions are defined relative to "North" 0-index. 
                Applying rotation to the group moves Index 0 to the new position.
            */}
            <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize="10" fill="white" pointerEvents="none" style={{ textShadow: '0px 0px 2px black' }}>
                {cell.occupant?.type !== 'Industry' && label}
                {/* Only show label if not industry, or show industry type maybe? */}
            </text>
        </g>
    );
};
