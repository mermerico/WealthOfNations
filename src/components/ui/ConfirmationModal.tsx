import React from 'react';
import './ConfirmationModal.css';

interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'secondary';
  className?: string;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  message: string;
  actions?: ModalAction[];
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onConfirm, onCancel, message, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <p>{message}</p>
        <div className="modal-actions">
          {actions ? (
            actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`modal-btn ${action.variant || 'primary'} ${action.className || ''}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  // Default styles based on variant if no className provided, 
                  // typically CSS handles this but inline fallback helpful
                  background: action.variant === 'danger' ? '#dc2626' :
                    action.variant === 'secondary' ? '#6b7280' :
                      '#3b82f6',
                  color: 'white',
                  ...((action.variant === 'secondary') ? { background: '#4b5563' } : {})
                }}
              >
                {action.label}
              </button>
            ))
          ) : (
            <>
              <button onClick={onConfirm} className="modal-confirm">
                Confirm
              </button>
              <button onClick={onCancel} className="modal-cancel">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
