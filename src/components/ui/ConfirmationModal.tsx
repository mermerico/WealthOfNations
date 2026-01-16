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
  message: React.ReactNode;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  actions?: ModalAction[];
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onConfirm, onCancel, message, title, confirmText, cancelText, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" data-testid="modal-overlay">
      <div className="modal-content" data-testid="modal-content">
        {title && <h2 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '20px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>{title}</h2>}
        <div style={{ marginBottom: '20px' }}>{message}</div>
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
              <button onClick={onConfirm} className="modal-confirm" data-testid="modal-confirm-button" style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', background: '#3b82f6', color: 'white' }}>
                {confirmText || 'Confirm'}
              </button>
              <button onClick={onCancel} className="modal-cancel" data-testid="modal-cancel-button" style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', background: '#4b5563', color: 'white' }}>
                {cancelText || 'Cancel'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
