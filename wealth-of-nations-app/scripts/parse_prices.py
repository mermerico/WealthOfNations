import csv
import json
import os

commodities = ['Food', 'Energy', 'Labor', 'Ore', 'Capital']
market_prices_dir = '../Market Prices'
output_file = 'src/utils/marketPrices.ts'

all_prices = {}
starting_quantities = {}

# Parse individual commodity prices
for commodity in commodities:
    filename = f'Prices - {commodity}.csv'
    filepath = os.path.join(market_prices_dir, filename)
    
    steps = []
    with open(filepath, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            steps.append({
                'sell': int(row['Sell Price']),
                'buy': int(row['Buy Price']),
                'barter': float(row['Barter Price'])
            })
    
    all_prices[commodity] = steps

# Parse starting quantities from Full-Empty CSV
full_empty_path = os.path.join(market_prices_dir, 'Prices - Full-Empty.csv')
with open(full_empty_path, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        resource = row['Resource']
        # Handle potential leading space in column name
        qty_key = ' Starting Quantity' if ' Starting Quantity' in row else 'Starting Quantity'
        starting_quantities[resource] = int(row[qty_key])

with open(output_file, 'w', encoding='utf-8') as f:
    f.write('import type { CommodityType } from "../types/gameState";\n')
    f.write('import type { MarketStep } from "./marketDefinitions";\n\n')
    
    f.write('export const MARKET_PRICE_MAP: Record<CommodityType, MarketStep[]> = ')
    f.write(json.dumps(all_prices, indent=4))
    f.write(';\n\n')
    
    f.write('export const MARKET_STARTING_QUANTITIES: Record<CommodityType, number> = ')
    f.write(json.dumps(starting_quantities, indent=4))
    f.write(';\n')

print(f"Successfully generated {output_file}")
