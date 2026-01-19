import React, { useMemo, useEffect, useState, useRef } from 'react';
import type { Player, GameState, CommodityType } from '../../types/gameState';
import { END_GAME_STEPS } from '../../utils/automatedFinalTrade';
import './EndGameSequenceModal.css';

interface EndGameSequenceModalProps {
    gameState: GameState;
    playerId: string;
    onNextStep: () => void;
    onNewGame: () => void;
}

// Hook for animating number changes
const useAnimatedNumber = (targetValue: number, duration: number = 600): number => {
    const [displayValue, setDisplayValue] = useState(targetValue);
    const rafRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);
    const startValueRef = useRef<number>(targetValue);

    useEffect(() => {
        if (displayValue === targetValue) return;

        const startValue = displayValue;
        startValueRef.current = startValue;
        startTimeRef.current = performance.now();

        const animate = (currentTime: number) => {
            if (!startTimeRef.current) return;

            const elapsed = currentTime - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = startValueRef.current + (targetValue - startValueRef.current) * easeOut;

            setDisplayValue(Math.round(current));

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            }
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [targetValue, displayValue, duration]);

    return displayValue;
};

const STEPS_INFO: Record<number, { title: string; description: string; stepKey?: string }> = {
    [END_GAME_STEPS.SUMMARY]: {
        title: '🏁 Game Complete',
        description: 'The final round has ended. Let\'s settle all accounts.',
        stepKey: 'summary'
    },
    [END_GAME_STEPS.INTEREST]: {
        title: '💳 Interest Payment',
        description: 'Players pay $1 interest per promissory note held.',
        stepKey: 'interest'
    },
    [END_GAME_STEPS.LIQUIDATE_FOOD]: {
        title: '🌾 Selling Food',
        description: 'All Food is being sold at current market prices.',
        stepKey: 'food'
    },
    [END_GAME_STEPS.LIQUIDATE_ENERGY]: {
        title: '⚡ Selling Energy',
        description: 'All Energy is being sold at current market prices.',
        stepKey: 'energy'
    },
    [END_GAME_STEPS.LIQUIDATE_LABOR]: {
        title: '👷 Selling Labor',
        description: 'All Labor is being sold at current market prices.',
        stepKey: 'labor'
    },
    [END_GAME_STEPS.LIQUIDATE_ORE]: {
        title: '⛏️ Selling Ore',
        description: 'All Ore is being sold at current market prices.',
        stepKey: 'ore'
    },
    [END_GAME_STEPS.LIQUIDATE_CAPITAL]: {
        title: '🏭 Selling Capital',
        description: 'All Capital is being sold at current market prices.',
        stepKey: 'capital'
    },
    [END_GAME_STEPS.PAY_LOANS]: {
        title: '🏦 Repaying Loans',
        description: 'Players repay $25 per loan from their final cash.',
        stepKey: 'loans'
    },
    [END_GAME_STEPS.VICTORY]: {
        title: '🏆 Final Standings',
        description: 'The winner has been determined!',
        stepKey: 'victory'
    },
};

const COMMODITY_TO_CLASS: Record<CommodityType, string> = {
    Food: 'commodity-food',
    Energy: 'commodity-energy',
    Labor: 'commodity-labor',
    Ore: 'commodity-ore',
    Capital: 'commodity-capital',
};

const LIQUIDATION_COMMODITIES: Record<number, CommodityType> = {
    [END_GAME_STEPS.LIQUIDATE_FOOD]: 'Food',
    [END_GAME_STEPS.LIQUIDATE_ENERGY]: 'Energy',
    [END_GAME_STEPS.LIQUIDATE_LABOR]: 'Labor',
    [END_GAME_STEPS.LIQUIDATE_ORE]: 'Ore',
    [END_GAME_STEPS.LIQUIDATE_CAPITAL]: 'Capital',
};

const COMMODITY_ICONS: Record<CommodityType, string> = {
    Food: '🌾',
    Energy: '⚡',
    Labor: '👷',
    Ore: '⛏️',
    Capital: '🏭',
};

// Animated number display component
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
    const animatedValue = useAnimatedNumber(value, 600);
    return <>{animatedValue}</>;
};

export const EndGameSequenceModal: React.FC<EndGameSequenceModalProps> = ({
    gameState,
    playerId,
    onNextStep,
    onNewGame
}) => {
    const { endGameSequence, players } = gameState;

    if (!endGameSequence || !endGameSequence.isActive) return null;

    const currentStep = endGameSequence.currentStep;
    const stepInfo = STEPS_INFO[currentStep];
    const isHost = gameState.players[gameState.firstPlayerIndex].id === playerId;
    const isVictoryStep = currentStep === END_GAME_STEPS.VICTORY;
    const activeCommodity = LIQUIDATION_COMMODITIES[currentStep];

    // Calculate victory scores using full VP formula: tiles*4 + money/10 - loans*3
    const rankedPlayers = useMemo(() => {
        return [...players]
            .map(p => {
                // Count industry tiles for this player
                const industryTiles = Object.values(gameState.board).filter(
                    cell => cell.occupant?.type === 'Industry' && cell.occupant?.playerId === p.id
                ).length;
                const industryPoints = industryTiles * 4;
                const moneyPoints = Math.floor(p.money / 10);
                const loanPenalty = p.loans * 3;

                return {
                    ...p,
                    victoryScore: industryPoints + moneyPoints - loanPenalty
                };
            })
            .sort((a, b) => b.victoryScore - a.victoryScore);
    }, [players, gameState.board]);

    const winnerId = rankedPlayers[0]?.id;

    const renderResourceCell = (value: number, commodity: CommodityType) => {
        const isBeingLiquidated = activeCommodity === commodity;
        const isZeroed = value === 0;
        const baseClass = COMMODITY_TO_CLASS[commodity];

        return (
            <td
                className={`resource-cell ${baseClass} ${isBeingLiquidated ? 'liquidating' : ''} ${isZeroed ? 'zeroed' : ''}`}
            >
                <AnimatedNumber value={value} />
            </td>
        );
    };

    const renderPlayerRow = (player: Player) => {
        return (
            <tr key={player.id}>
                <td>
                    <div className="player-cell">
                        <img
                            src={`/flags/${player.flag}`}
                            className="endgame-player-flag"
                            alt={player.name}
                        />
                        <span className="player-name" style={{ color: player.color }}>
                            {player.name}
                        </span>
                    </div>
                </td>
                <td className="money-cell">$<AnimatedNumber value={player.money} /></td>
                <td className="loans-cell"><AnimatedNumber value={player.loans} /></td>
                {renderResourceCell(player.resources.Food, 'Food')}
                {renderResourceCell(player.resources.Energy, 'Energy')}
                {renderResourceCell(player.resources.Labor, 'Labor')}
                {renderResourceCell(player.resources.Ore, 'Ore')}
                {renderResourceCell(player.resources.Capital, 'Capital')}
            </tr>
        );
    };

    const renderVictoryPanel = () => (
        <div className="victory-panel">
            <h3 className="victory-title">🎉 Final Standings 🎉</h3>
            <div className="victory-scores">
                {rankedPlayers.map((player, index) => (
                    <div
                        key={player.id}
                        className={`victory-row ${player.id === winnerId ? 'winner' : ''}`}
                    >
                        <div className="victory-player">
                            {player.id === winnerId && <span className="crown">👑</span>}
                            <img
                                src={`/flags/${player.flag}`}
                                className="endgame-player-flag"
                                alt={player.name}
                            />
                            <span className="player-name" style={{ color: player.color }}>
                                {index + 1}. {player.name}
                            </span>
                        </div>
                        <span className={`victory-score ${player.victoryScore >= 0 ? 'positive' : 'negative'}`}>
                            {player.victoryScore} VP
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderLiquidationEffect = () => {
        if (!activeCommodity) return null;

        const totalCommodity = players.reduce((sum, p) => sum + p.resources[activeCommodity], 0);
        if (totalCommodity === 0) return null;

        return (
            <div className="liquidation-effect">
                <div className={`liquidation-cube ${activeCommodity.toLowerCase()}`}>
                    {COMMODITY_ICONS[activeCommodity]}
                </div>
                <span className="liquidation-arrow">→</span>
                <div className="liquidation-money">
                    $
                </div>
            </div>
        );
    };

    return (
        <div className="endgame-overlay">
            <div
                className="endgame-modal"
                data-step={stepInfo?.stepKey || 'summary'}
            >
                {/* Liquidation Visual Effect */}
                {renderLiquidationEffect()}

                {/* Header */}
                <div className="endgame-header">
                    <h2 className="endgame-title">{stepInfo?.title}</h2>
                    <p className="endgame-description">{stepInfo?.description}</p>

                    {/* Progress Steps */}
                    <div className="endgame-progress">
                        {Object.keys(STEPS_INFO).map((step) => {
                            const stepNum = parseInt(step);
                            if (stepNum >= END_GAME_STEPS.VICTORY) return null;
                            const isActive = stepNum === currentStep;
                            const isCompleted = stepNum < currentStep;
                            return (
                                <div
                                    key={step}
                                    className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Victory Panel (only on final step) */}
                {isVictoryStep && renderVictoryPanel()}

                {/* Players Table */}
                {!isVictoryStep && (
                    <div className="endgame-players">
                        <table className="endgame-table">
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>Money</th>
                                    <th>Loans</th>
                                    <th className="commodity-food">Food</th>
                                    <th className="commodity-energy">Energy</th>
                                    <th className="commodity-labor">Labor</th>
                                    <th className="commodity-ore">Ore</th>
                                    <th className="commodity-capital">Cap</th>
                                </tr>
                            </thead>
                            <tbody>
                                {players.map(renderPlayerRow)}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="endgame-footer">
                    {isHost ? (
                        <button
                            onClick={isVictoryStep ? onNewGame : onNextStep}
                            className="next-step-button"
                            data-testid="endgame-next-step"
                        >
                            {isVictoryStep ? 'New Game' : 'Next Step'}
                            <span className="arrow">→</span>
                        </button>
                    ) : (
                        <div className="waiting-indicator">
                            <span className="pulse-dot" />
                            Waiting for host to proceed...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
