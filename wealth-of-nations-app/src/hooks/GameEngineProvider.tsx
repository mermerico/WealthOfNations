import { createContext, useContext, type ReactNode } from 'react';
import { useGameEngine } from './useGameEngine';

const GameEngineContext = createContext<ReturnType<typeof useGameEngine> | null>(null);

export function GameEngineProvider({ children }: { children: ReactNode }) {
    const engine = useGameEngine();
    return (
        <GameEngineContext.Provider value={engine}>
            {children}
        </GameEngineContext.Provider>
    );
}

export function useGameEngineContext() {
    const context = useContext(GameEngineContext);
    if (!context) {
        throw new Error('useGameEngineContext must be used within a GameEngineProvider');
    }
    return context;
}
