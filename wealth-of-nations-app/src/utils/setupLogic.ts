export interface DraftRoundInfo {
    direction: 'clockwise' | 'counterClockwise';
    totalRounds: number;
}

export function getDraftRoundInfo(playerCount: number, round: number): DraftRoundInfo {
    let totalRounds = 2; // Default for 5 and 6 players

    if (playerCount === 3) {
        totalRounds = 4;
    } else if (playerCount === 4) {
        totalRounds = 3;
    }

    // Determine direction based on round number
    // Even rounds (0, 2, 4...): clockwise
    // Odd rounds (1, 3, 5...): counter-clockwise (snake draft)
    const direction = round % 2 === 0 ? 'clockwise' : 'counterClockwise';

    return { direction, totalRounds };
}

export function getNextPlayerIndex(
    currentIndex: number,
    playerCount: number,
    direction: 'clockwise' | 'counterClockwise'
): number {
    if (direction === 'clockwise') {
        return (currentIndex + 1) % playerCount;
    } else {
        return (currentIndex - 1 + playerCount) % playerCount;
    }
}

export function getDraftOrder(
    round: number,
    playerCount: number,
    firstPlayerIndex: number
): number[] {
    const { direction } = getDraftRoundInfo(playerCount, round);

    // For snake draft: odd rounds start from the last player of the previous round
    // Round 0: start from firstPlayerIndex, go clockwise
    // Round 1: start from (firstPlayerIndex - 1), go counter-clockwise (which reverses the order)
    let startIndex = firstPlayerIndex;
    if (round % 2 === 1) {
        // For counter-clockwise rounds, start from the player before firstPlayer
        // This creates the snake effect
        startIndex = (firstPlayerIndex - 1 + playerCount) % playerCount;
    }

    const order: number[] = [];
    let currentIndex = startIndex;
    for (let i = 0; i < playerCount; i++) {
        order.push(currentIndex);
        currentIndex = getNextPlayerIndex(currentIndex, playerCount, direction);
    }

    return order;
}
