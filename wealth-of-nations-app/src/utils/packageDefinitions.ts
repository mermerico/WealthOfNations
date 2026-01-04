import type { IndustryType, CommodityType } from '../types/gameState';

export interface Package {
    id: string;
    name: string;
    type: 'Industry' | 'Commodity';
    tiles: IndustryType[];
    commodities: Partial<Record<CommodityType, number>>;
    money: number;
}

export const INDUSTRY_PACKAGES: Package[] = [
    {
        id: 'I1',
        name: 'I1',
        type: 'Industry',
        tiles: ['Farm', 'Farm', 'Farm'],
        commodities: {},
        money: 0
    },
    {
        id: 'I2',
        name: 'I2',
        type: 'Industry',
        tiles: ['Farm', 'Farm', 'Farm'],
        commodities: {},
        money: 0
    },
    {
        id: 'I3',
        name: 'I3',
        type: 'Industry',
        tiles: ['Generator', 'Generator'],
        commodities: {},
        money: 10
    },
    {
        id: 'I4',
        name: 'I4',
        type: 'Industry',
        tiles: ['Academy', 'Academy'],
        commodities: {},
        money: 10
    },
    {
        id: 'I5',
        name: 'I5',
        type: 'Industry',
        tiles: ['Mine', 'Mine'],
        commodities: {},
        money: 0
    },
    {
        id: 'I6',
        name: 'I6',
        type: 'Industry',
        tiles: ['Factory', 'Factory'],
        commodities: {},
        money: 0
    },
];

export const COMMODITY_PACKAGES: Package[] = [
    {
        id: 'C1',
        name: 'C1',
        type: 'Commodity',
        tiles: [],
        commodities: { Food: 9, Energy: 1 },
        money: 40
    },
    {
        id: 'C2',
        name: 'C2',
        type: 'Commodity',
        tiles: [],
        commodities: { Food: 3, Energy: 2, Labor: 1 },
        money: 40
    },
    {
        id: 'C3',
        name: 'C3',
        type: 'Commodity',
        tiles: [],
        commodities: { Energy: 1, Labor: 3 },
        money: 40
    },
    {
        id: 'C4',
        name: 'C4',
        type: 'Commodity',
        tiles: [],
        commodities: { Labor: 1, Ore: 1, Capital: 1 },
        money: 40
    },
    {
        id: 'C5',
        name: 'C5',
        type: 'Commodity',
        tiles: [],
        commodities: { Ore: 3 },
        money: 40
    },
    {
        id: 'C6',
        name: 'C6',
        type: 'Commodity',
        tiles: [],
        commodities: { Energy: 1, Capital: 2 },
        money: 40
    },
];

export function getAvailablePackages(playerCount: number, takenPackageIds: string[]): Package[] {
    const allPackages = [...INDUSTRY_PACKAGES, ...COMMODITY_PACKAGES];

    // Filter out packages that have already been taken
    let available = allPackages.filter(pkg => !takenPackageIds.includes(pkg.id));

    // For 5 players, remove I2 from the pool
    if (playerCount === 5) {
        available = available.filter(pkg => pkg.id !== 'I2');
    }

    return available;
}
