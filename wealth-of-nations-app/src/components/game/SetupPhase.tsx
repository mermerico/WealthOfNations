import type { GameState } from '../../types/gameState';
import { getAvailablePackages } from '../../utils/packageDefinitions';
import PackageCard from './PackageCard';
import './SetupPhase.css';

interface SetupPhaseProps {
    gameState: GameState;
    onSelectPackage: (packageId: string) => void;
}

export default function SetupPhase({ gameState, onSelectPackage }: SetupPhaseProps) {
    if (!gameState.setupPhase) return null;

    const { step, draftRound, takenPackageIds } = gameState.setupPhase;
    const playerCount = gameState.players.length;

    // Package Selection step
    if (step === 'selectPackage') {
        let availablePackages = getAvailablePackages(playerCount, takenPackageIds);

        // Round 0 (first round): Only Industry packages allowed
        if (draftRound === 0) {
            availablePackages = availablePackages.filter(pkg => pkg.type === 'Industry');
        }

        return (
            <div className="setup-phase">
                <div className="setup-header">
                    <h2>Setup Phase - Round {draftRound + 1}/2 - Package Selection</h2>
                </div>
                <div className="setup-content">
                    <div className="package-grid">
                        {availablePackages.map(pkg => (
                            <PackageCard
                                key={pkg.id}
                                package={pkg}
                                onSelect={() => onSelectPackage(pkg.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}