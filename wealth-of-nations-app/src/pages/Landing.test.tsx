import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from './Landing';
import type { ComponentProps } from 'react';

function renderLanding(overrides: Partial<ComponentProps<typeof Landing>> = {}) {
    const props: ComponentProps<typeof Landing> = {
        onCreateLobby: vi.fn(),
        onJoinLobby: vi.fn(),
        onStartLocalGame: vi.fn(),
        connectionState: 'connected',
        lastError: null,
        recentLobbyCode: null,
        ...overrides
    };

    const user = userEvent.setup();
    const view = render(<Landing {...props} />);
    return { props, user, view };
}

describe('Landing', () => {
    it('prefills join code input when a recent lobby exists', () => {
        renderLanding({ recentLobbyCode: 'ABCDE' });
        const input = screen.getByLabelText(/join code/i) as HTMLInputElement;
        expect(input.value).toBe('ABCDE');
    });

    it('disables rejoin button when offline', () => {
        render(<Landing
            onCreateLobby={vi.fn()}
            onJoinLobby={vi.fn()}
            onStartLocalGame={vi.fn()}
            connectionState="disconnected"
            lastError={null}
            recentLobbyCode="ABCDE"
        />);

        const button = screen.getByRole('button', { name: /rejoin lobby/i }) as HTMLButtonElement;
        expect(button.disabled).to.be.true;
    });

    it('calls onJoinLobby with stored code when clicking rejoin', async () => {
        const onJoinLobby = vi.fn();
        const { user } = renderLanding({
            recentLobbyCode: 'ABCDE',
            onJoinLobby,
            connectionState: 'connected'
        });

        const rejoinButton = screen.getByRole('button', { name: /rejoin lobby/i });
        await user.click(rejoinButton);

        expect(onJoinLobby).toHaveBeenCalledWith('ABCDE');
    });
});
