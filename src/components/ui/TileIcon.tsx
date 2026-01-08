import { useId } from 'react';
import type { IndustryType, CommodityType } from '../../types/gameState';
import { TILE_DEFINITIONS } from '../../utils/tileDefinitions';

interface TileIconProps {
    type: IndustryType;
    size?: number;
}

const COMMODITY_COLORS: Record<CommodityType | string, string> = {
    Food: '#facc15',
    Energy: '#3b82f6',
    Labor: '#ef4444',
    Ore: '#9ca3af',
    Capital: '#000000',
    Money: '#a855f7',
};

// Calculate hex points for a given radius
function calculateHexPoints(radius: number, cx: number, cy: number): string {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i;
        const angle_rad = Math.PI / 180 * angle_deg;
        const x = cx + radius * Math.cos(angle_rad);
        const y = cy + radius * Math.sin(angle_rad);
        points.push(`${x},${y}`);
    }
    return points.join(' ');
}

// Edge angles (N=0, NE=1, SE=2, S=3, SW=4, NW=5)
const EDGE_ANGLES = [270, 330, 30, 90, 150, 210];
// Corner angles
const CORNER_ANGLES = [300, 0, 60, 120, 180, 240];

export function TileIcon({ type, size = 24 }: TileIconProps) {
    const uniqueId = useId();
    const def = TILE_DEFINITIONS[type];
    if (!def) return null;

    const radius = size / 2;
    const cx = size / 2;
    const cy = size / 2;
    const hexPoints = calculateHexPoints(radius * 0.9, cx, cy);
    const featureRadius = radius * 0.18;

    const features: React.ReactNode[] = [];

    // Center dot
    if (def.hasCenterDot) {
        const centerColor = def.features[0]?.commodity ? COMMODITY_COLORS[def.features[0].commodity] : 'white';
        features.push(
            <circle key="center" cx={cx} cy={cy} r={radius * 0.22} fill={centerColor} stroke="white" strokeWidth="0.5" />
        );
    }

    // Edge and corner features
    def.features.forEach((feat, idx) => {
        const color = feat.commodity ? COMMODITY_COLORS[feat.commodity] : 'white';

        if (feat.type === 'Edge') {
            const angleDeg = EDGE_ANGLES[feat.position];
            const angleRad = angleDeg * Math.PI / 180;
            const dist = (Math.sqrt(3) / 2) * radius * 0.9;
            const fx = cx + dist * Math.cos(angleRad);
            const fy = cy + dist * Math.sin(angleRad);
            features.push(
                <circle key={`edge-${idx}`} cx={fx} cy={fy} r={featureRadius} fill={color} stroke="white" strokeWidth="0.5" />
            );
        } else if (feat.type === 'Corner') {
            const angleDeg = CORNER_ANGLES[feat.position];
            const angleRad = angleDeg * Math.PI / 180;
            const fx = cx + radius * 0.9 * Math.cos(angleRad);
            const fy = cy + radius * 0.9 * Math.sin(angleRad);
            features.push(
                <circle key={`corner-${idx}`} cx={fx} cy={fy} r={featureRadius} fill={color} stroke="white" strokeWidth="0.5" />
            );
        }
    });

    const clipId = `tile-icon-clip-${uniqueId}`;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <defs>
                <clipPath id={clipId}>
                    <polygon points={hexPoints} />
                </clipPath>
            </defs>
            <polygon points={hexPoints} fill="#555" stroke="#666" strokeWidth="1" />
            <g clipPath={`url(#${clipId})`}>
                {features}
            </g>
        </svg>
    );
}
