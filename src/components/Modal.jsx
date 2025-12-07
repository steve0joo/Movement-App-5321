import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, onConfirm, title, children, confirmText = 'OK', cancelText = 'Cancel', type = 'info' }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
        </div>
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-footer">
          {onConfirm && (
            <>
              <button
                onClick={onClose}
                className="modal-btn modal-btn-cancel"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`modal-btn modal-btn-confirm ${type === 'danger' ? 'modal-btn-danger' : ''}`}
              >
                {confirmText}
              </button>
            </>
          )}
          {!onConfirm && (
            <button
              onClick={onClose}
              className="modal-btn modal-btn-confirm"
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
