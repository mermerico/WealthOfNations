import React, { useState, useMemo } from 'react';
import type { IndustryType, CommodityType, TileFeature } from '../types/gameState';
import { TILE_DEFINITIONS } from '../utils/tileDefinitions';
import { validateTileDots } from '../utils/placementLogic';
import './TileSandbox.css';

const INDUSTRY_TYPES: IndustryType[] = ['Farm', 'Generator', 'Academy', 'Mine', 'Factory', 'Bank'];
const DIRECTIONS = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];
const DIRECTION_OFFSETS: Record<string, { q: number; r: number }> = {
    'N': { q: 0, r: -1 },
    'NE': { q: 1, r: -1 },
    'SE': { q: 1, r: 0 },
    'S': { q: 0, r: 1 },
    'SW': { q: -1, r: 1 },
    'NW': { q: -1, r: 0 },
};

const COMMODITY_COLORS: Record<CommodityType | string, string> = {
    Food: '#facc15',
    Energy: '#3b82f6',
    Labor: '#ef4444',
    Ore: '#9ca3af',
    Capital: '#000000',
    Money: '#a855f7',
};

const HEX_SIZE = 30;
const EDGE_ANGLES = [270, 330, 30, 90, 150, 210];
const CORNER_ANGLES = [300, 0, 60, 120, 180, 240];

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

const HEX_POINTS = calculateHexPoints(HEX_SIZE);

interface MiniHexProps {
    type: IndustryType;
    orientation: number;
    x: number;
    y: number;
    label?: string;
}

const MiniHex: React.FC<MiniHexProps> = ({ type, orientation, x, y, label }) => {
    const def = TILE_DEFINITIONS[type];
    const rotation = orientation * 60;

    const primaryCommodity = (type === 'Bank') ? 'Money' :
        (type === 'Factory') ? 'Capital' :
            (def?.features[0]?.commodity || 'Ore');

    const tints: Record<string, string> = {
        Food: '#5a5848',
        Energy: '#484d5a',
        Labor: '#5a4848',
        Ore: '#555555',
        Capital: '#4d4d4d',
        Money: '#52485a',
    };

    const fill = tints[primaryCommodity] || '#555';
    const FEATURE_RADIUS = HEX_SIZE * 0.18;

    const features: React.ReactNode[] = [];

    if (def.hasCenterDot) {
        const centerColor = def.features[0]?.commodity ? COMMODITY_COLORS[def.features[0].commodity] : 'white';
        features.push(
            <circle key="center" cx="0" cy="0" r={HEX_SIZE * 0.22} fill={centerColor} stroke="white" strokeWidth="0.5" />
        );
    }

    def.features.forEach((feat: TileFeature, idx: number) => {
        const color = feat.commodity ? COMMODITY_COLORS[feat.commodity] : 'white';
        const key = `feat-${idx}`;

        if (feat.type === 'Edge') {
            const angleDeg = EDGE_ANGLES[feat.position];
            const angleRad = angleDeg * Math.PI / 180;
            const dist = (Math.sqrt(3) / 2) * HEX_SIZE;
            const fx = dist * Math.cos(angleRad);
            const fy = dist * Math.sin(angleRad);
            features.push(
                <circle key={key} cx={fx} cy={fy} r={FEATURE_RADIUS} fill={color} stroke="white" strokeWidth="0.5" />
            );
        } else if (feat.type === 'Corner') {
            const angleDeg = CORNER_ANGLES[feat.position];
            const angleRad = angleDeg * Math.PI / 180;
            const fx = HEX_SIZE * Math.cos(angleRad);
            const fy = HEX_SIZE * Math.sin(angleRad);
            features.push(
                <circle key={key} cx={fx} cy={fy} r={FEATURE_RADIUS} fill={color} stroke="white" strokeWidth="0.5" />
            );
        }
    });

    return (
        <g transform={`translate(${x},${y})`}>
            <polygon points={HEX_POINTS} fill={fill} stroke="#666" strokeWidth="1" />
            <g transform={`rotate(${rotation})`}>
                {features}
            </g>
            {label && (
                <text x="0" y={HEX_SIZE + 12} textAnchor="middle" fill="white" fontSize="10">
                    {label}
                </text>
            )}
        </g>
    );
};

export const TileSandbox: React.FC = () => {
    const [industryA, setIndustryA] = useState<IndustryType>('Academy');
    const [industryB, setIndustryB] = useState<IndustryType>('Factory');
    const [direction, setDirection] = useState<string>('NW');

    // Build a mock board and check validity for each orientation combination
    const validityGrid = useMemo(() => {
        const grid: boolean[][] = [];
        const dirOffset = DIRECTION_OFFSETS[direction];

        for (let orientA = 0; orientA < 6; orientA++) {
            const row: boolean[] = [];
            for (let orientB = 0; orientB < 6; orientB++) {
                // "B position relative to A" means B is at dirOffset from A
                // A is at origin (0,0), B is at dirOffset
                // We're checking if placing A at (0,0) is valid given B exists at dirOffset
                const board = {
                    // B (existing tile) is at the direction offset
                    [`${dirOffset.q},${dirOffset.r}`]: {
                        q: dirOffset.q, r: dirOffset.r,
                        occupant: {
                            type: 'Industry' as const,
                            playerId: 'p1',
                            tile: {
                                id: `${dirOffset.q},${dirOffset.r}`,
                                type: industryB,
                                ownerId: 'p1',
                                orientation: orientB,
                                active: true,
                                automated: false
                            }
                        }
                    },
                    // A (tile being placed) is at the origin
                    '0,0': {
                        q: 0, r: 0,
                        occupant: null
                    }
                };

                // Check if placing tile A at (0,0) with orientA is valid
                const result = validateTileDots(board, '0,0', industryA, orientA);
                row.push(result.isValid);
            }
            grid.push(row);
        }
        return grid;
    }, [industryA, industryB, direction]);

    // Calculate hex positions for the paired visualization
    const getHexPairPositions = (dir: string) => {
        const spacing = HEX_SIZE * 1.8;
        const dirIndex = DIRECTIONS.indexOf(dir);
        const angle = (dirIndex * 60 + 270) * Math.PI / 180; // Start from N

        return {
            aX: 0,
            aY: 0,
            bX: Math.cos(angle) * spacing,
            bY: Math.sin(angle) * spacing
        };
    };

    const hexPairPos = getHexPairPositions(direction);

    return (
        <div className="tile-sandbox">
            <h1>Tile Orientation Compatibility Sandbox</h1>

            <div className="controls">
                <div className="control-group">
                    <label>Industry A (placing):</label>
                    <select value={industryA} onChange={e => setIndustryA(e.target.value as IndustryType)}>
                        {INDUSTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div className="control-group">
                    <label>Industry B (existing):</label>
                    <select value={industryB} onChange={e => setIndustryB(e.target.value as IndustryType)}>
                        {INDUSTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div className="control-group">
                    <label>B position relative to A:</label>
                    <select value={direction} onChange={e => setDirection(e.target.value)}>
                        {DIRECTIONS.map((d, i) => <option key={d} value={d}>{d} (Edge {i})</option>)}
                    </select>
                </div>
            </div>

            <div className="legend">
                <span className="legend-item valid">✓ Valid</span>
                <span className="legend-item invalid">✗ Invalid (dot mismatch)</span>
            </div>

            <div className="grid-container">
                <table className="orientation-grid">
                    <thead>
                        <tr>
                            <th></th>
                            {[0, 1, 2, 3, 4, 5].map(o => (
                                <th key={o}>B orient {o}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[0, 1, 2, 3, 4, 5].map(orientA => (
                            <tr key={orientA}>
                                <th>A orient {orientA}</th>
                                {[0, 1, 2, 3, 4, 5].map(orientB => {
                                    const isValid = validityGrid[orientA]?.[orientB] ?? true;
                                    return (
                                        <td key={orientB} className={isValid ? 'valid' : 'invalid'}>
                                            <svg width="100" height="100" viewBox="-50 -50 100 100">
                                                <MiniHex
                                                    type={industryA}
                                                    orientation={orientA}
                                                    x={-hexPairPos.bX * 0.5}
                                                    y={-hexPairPos.bY * 0.5}
                                                />
                                                <MiniHex
                                                    type={industryB}
                                                    orientation={orientB}
                                                    x={hexPairPos.bX * 0.5}
                                                    y={hexPairPos.bY * 0.5}
                                                />
                                            </svg>
                                            <div className="validity-indicator">
                                                {isValid ? '✓' : '✗'}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="summary">
                <h3>Summary</h3>
                <p>
                    Valid combinations: {validityGrid.flat().filter(v => v).length} / 36
                </p>
            </div>
        </div>
    );
};

export default TileSandbox;
