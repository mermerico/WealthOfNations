import { ResourceIcon } from '../ui/ResourceIcon';
import { TileIcon } from '../ui/TileIcon';
import './PlayerAid.css';

interface PlayerAidProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PlayerAid({ isOpen, onClose }: PlayerAidProps) {
    if (!isOpen) return null;

    return (
        <div className="player-aid-overlay" onClick={onClose}>
            <div className="player-aid-modal" onClick={e => e.stopPropagation()}>
                <button className="player-aid-close" onClick={onClose}>×</button>
                <h2 className="player-aid-title">Player Aid</h2>

                <div className="player-aid-sections">
                    {/* Trade Phase */}
                    <div className="player-aid-section trade">
                        <h3>1. Trade Phase</h3>

                        <h4>Buy / Sell to Market</h4>
                        <p>Buy prices are higher than sell prices. One cube per action.</p>

                        <h4>Barter</h4>
                        <p>Trade commodities or money with another player.</p>

                        <h4>Promissory Notes</h4>
                        <ul>
                            <li>Take: $20 minus notes held</li>
                            <li>Repay: $25 each</li>
                        </ul>
                    </div>

                    {/* Develop Phase */}
                    <div className="player-aid-section develop">
                        <h3>2. Develop Phase</h3>

                        <table className="cost-table">
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="section-row">
                                    <td className="action-name">Place Flag</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Labor" size={16} /></div></td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="table-divider"></div>
                        <h4>Build Industry Tile</h4>
                        <p className="table-note">Industries require a flag to build</p>

                        <table className="cost-table">
                            <tbody>
                                <tr>
                                    <td className="action-name"><TileIcon type="Farm" size={20} /> Farm</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Ore" size={16} /><ResourceIcon type="Capital" size={16} /></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Generator" size={20} /> Generator</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Ore" size={16} /><ResourceIcon type="Capital" size={16} /></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Academy" size={20} /> Academy</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Ore" size={16} /><ResourceIcon type="Capital" size={16} /></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Mine" size={20} /> Mine</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Labor" size={16} /><ResourceIcon type="Energy" size={16} /><ResourceIcon type="Capital" size={16} /></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Factory" size={20} /> Factory</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Labor" size={16} /><ResourceIcon type="Ore" size={16} /><ResourceIcon type="Ore" size={16} /></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Bank" size={20} /> Bank</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Energy" size={16} /><ResourceIcon type="Ore" size={16} /><ResourceIcon type="Capital" size={16} /></div></td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="table-divider"></div>

                        <table className="cost-table">
                            <tbody>
                                <tr>
                                    <td className="action-name">Move (up to 3)</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Capital" size={16} /></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name">Force Placement</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Capital" size={16} /></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name">Automate</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Energy" size={16} /><ResourceIcon type="Capital" size={16} /><ResourceIcon type="Capital" size={16} /></div></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Produce Phase */}
                    <div className="player-aid-section produce">
                        <h3>3. Produce Phase</h3>

                        <table className="cost-table produce-table">
                            <thead>
                                <tr>
                                    <th>Tile</th>
                                    <th>Power</th>
                                    <th>Feed</th>
                                    <th>Output</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="action-name"><TileIcon type="Farm" size={18} /> Farm</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Energy" size={14} /></div></td>
                                    <td className="text-cell">Free</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Food" size={14} /><span>/dot</span></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Generator" size={18} /> Generator</td>
                                    <td className="text-cell">Free</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Food" size={14} /><span>/tile</span></div></td>
                                    <td><div className="cost-icons"><ResourceIcon type="Energy" size={14} /><span>/dot</span></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Academy" size={18} /> Academy</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Energy" size={14} /></div></td>
                                    <td><div className="cost-icons"><ResourceIcon type="Food" size={14} /><span>/tile</span></div></td>
                                    <td><div className="cost-icons"><ResourceIcon type="Labor" size={14} /><span>/dot</span></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Mine" size={18} /> Mine</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Energy" size={14} /></div></td>
                                    <td><div className="cost-icons"><ResourceIcon type="Food" size={14} /><span>/tile</span></div></td>
                                    <td><div className="cost-icons"><ResourceIcon type="Ore" size={14} /><span>/dot</span></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Factory" size={18} /> Factory</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Energy" size={14} /></div></td>
                                    <td><div className="cost-icons"><ResourceIcon type="Food" size={14} /><span>/tile</span></div></td>
                                    <td><div className="cost-icons"><ResourceIcon type="Capital" size={14} /><span>/dot</span></div></td>
                                </tr>
                                <tr>
                                    <td className="action-name"><TileIcon type="Bank" size={18} /> Bank</td>
                                    <td><div className="cost-icons"><ResourceIcon type="Energy" size={14} /></div></td>
                                    <td><div className="cost-icons"><ResourceIcon type="Food" size={14} /><span>/tile</span></div></td>
                                    <td className="text-cell">$30/dot</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="automation-note">
                            <strong>Automation:</strong> Feed entire bloc with 1 <ResourceIcon type="Ore" size={14} /> instead of Food
                        </div>
                    </div>
                </div>

                {/* Victory Points */}
                <div className="victory-section">
                    <h3>🏆 Victory Points</h3>
                    <div className="victory-items">
                        <div className="victory-item positive">
                            <span className="vp-value">+4 VP</span>
                            <span>per Industry tile</span>
                        </div>
                        <div className="victory-item positive">
                            <span className="vp-value">+1 VP</span>
                            <span>per $10</span>
                        </div>
                        <div className="victory-item negative">
                            <span className="vp-value">−3 VP</span>
                            <span>per Promissory Note</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
