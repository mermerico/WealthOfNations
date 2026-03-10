// One-time script to upload a save file to Upstash Redis
import { Redis } from '@upstash/redis';
import { readFileSync } from 'fs';
import { join } from 'path';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
});

const SAVE_KEY_PREFIX = 'won:save:';
const SAVE_INDEX_KEY = 'won:saves';

async function uploadSave(lobbyCode: string) {
    const filePath = join(process.cwd(), 'saves', `${lobbyCode}.json`);

    console.log(`Reading save file: ${filePath}`);
    const content = readFileSync(filePath, 'utf-8');

    const key = `${SAVE_KEY_PREFIX}${lobbyCode.toUpperCase()}`;

    console.log(`Uploading to Redis key: ${key}`);
    await redis.set(key, content);
    await redis.sadd(SAVE_INDEX_KEY, lobbyCode.toUpperCase());

    console.log(`Successfully uploaded ${lobbyCode} to Upstash Redis!`);
}

const code = process.argv[2];
if (!code) {
    console.error('Usage: npx tsx uploadSave.ts <LOBBY_CODE>');
    process.exit(1);
}

uploadSave(code).catch(err => {
    console.error('Upload failed:', err);
    process.exit(1);
});
