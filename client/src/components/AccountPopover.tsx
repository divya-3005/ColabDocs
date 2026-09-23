import React, { useState, useRef, useEffect } from 'react';
import { useAuth, DEMO_PROFILES } from '../context/AuthContext';
import { LogOut, Check, HelpCircle } from 'lucide-react';
import './AccountPopover.css';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export const AccountPopover: React.FC = () => {
  const {
    currentUser,
    loginWithDemo,
    loginWithGoogle,
    logout,
    googleClientId,
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [showOauthModal, setShowOauthModal] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // If real Google Client ID is configured, load GIS script and render button
  useEffect(() => {
    if (!googleClientId) return;

    const existingScript = document.getElementById('google-gsi-client');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogleBtn();
      document.body.appendChild(script);
    } else {
      initGoogleBtn();
    }

    function initGoogleBtn() {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: any) => {
            if (response.credential) {
              loginWithGoogle(response.credential);
              setIsOpen(false);
            }
          },
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'medium',
          width: 280,
          text: 'signin_with',
          shape: 'pill',
        });
      }
    }
  }, [googleClientId, isOpen]);

  const avatarInitial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="account-popover-container" ref={popoverRef}>
      {/* 1. Header Trigger Avatar */}
      <button
        className="account-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={`Google Account: ${currentUser.name} (${currentUser.email})`}
      >
        {currentUser.avatar_url ? (
          <img
            src={currentUser.avatar_url}
            alt={currentUser.name}
            className="account-avatar-img"
          />
        ) : (
          <div
            className="account-avatar-circle"
            style={{ backgroundColor: currentUser.color || '#2563eb' }}
          >
            {avatarInitial}
          </div>
        )}
      </button>

      {/* 2. Floating Google Account Card */}
      {isOpen && (
        <div className="account-card-dropdown">
          {/* Header email */}
          <div className="account-card-header">
            <span className="account-card-email" title={currentUser.email}>
              {currentUser.email}
            </span>
          </div>

          {/* Large Profile circle */}
          <div className="account-card-profile">
            {currentUser.avatar_url ? (
              <div className="account-card-avatar-large">
                <img src={currentUser.avatar_url} alt={currentUser.name} />
              </div>
            ) : (
              <div
                className="account-card-avatar-large"
                style={{ backgroundColor: currentUser.color || '#2563eb' }}
              >
                {avatarInitial}
              </div>
            )}
            <div className="account-card-name">Hi, {currentUser.name}!</div>
          </div>

          <div className="account-card-divider" />

          {/* Quick Demo Profiles Switcher */}
          <div className="account-section-title">Collaborator Profiles (1-Click)</div>
          <div className="account-profiles-list">
            {DEMO_PROFILES.map((profile) => {
              const isCurrent = profile.id === currentUser.id;
              return (
                <button
                  key={profile.id}
                  className={`account-profile-item ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => {
                    loginWithDemo(profile);
                    setIsOpen(false);
                  }}
                >
                  <div className="account-profile-left">
                    <div
                      className="account-profile-mini-avatar"
                      style={{ backgroundColor: profile.color }}
                    >
                      {profile.name.charAt(0)}
                    </div>
                    <div className="account-profile-info">
                      <span className="account-profile-name">{profile.name}</span>
                    </div>
                  </div>
                  {isCurrent && <Check size={16} color="#1a73e8" />}
                </button>
              );
            })}
          </div>

          <div className="account-card-divider" />

          {/* Real Google Cloud OAuth Section */}
          <div className="google-oauth-row">
            {googleClientId ? (
              <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
            ) : (
              <button
                className="google-auth-button"
                onClick={() => {
                  setIsOpen(false);
                  setShowOauthModal(true);
                }}
              >
                <svg className="google-g-icon" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.14 0 9.9 0 12s.45 3.86 1.24 5.42l4.04-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Google Cloud OAuth (Setup)</span>
                <HelpCircle size={14} color="#70757a" />
              </button>
            )}
          </div>

          <div className="account-card-divider" />

          {/* Footer / Sign Out */}
          <div className="account-card-footer">
            <button
              className="account-signout-btn"
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Google Cloud OAuth Help / Credentials Modal */}
      {showOauthModal && (
        <div className="oauth-info-modal-backdrop" onClick={() => setShowOauthModal(false)}>
          <div className="oauth-info-card" onClick={(e) => e.stopPropagation()}>
            <div className="oauth-info-title">
              <svg className="google-g-icon" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.14 0 9.9 0 12s.45 3.86 1.24 5.42l4.04-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Google Cloud OAuth Setup</span>
            </div>

            <p className="oauth-info-desc">
              ColabDocs is fully equipped for <strong>Google Identity Services (GIS)</strong>! To enable live Google Sign-In with your own Google Cloud account:
            </p>

            <div className="oauth-steps-box">
              <ol style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li>Create an OAuth 2.0 Web Client ID in the <strong>Google Cloud Console</strong>.</li>
                <li>Add <code>http://localhost:5173</code> to <strong>Authorized JavaScript origins</strong>.</li>
                <li>
                  Add your Client ID to <code>client/.env</code>:
                  <div style={{ marginTop: 4 }}>
                    <code>VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com</code>
                  </div>
                </li>
              </ol>
            </div>

            <p className="oauth-info-desc" style={{ fontSize: 12 }}>
              💡 <em>In the meantime, the 1-Click Collaborator Profiles above allow immediate full-featured testing and multi-user live editing!</em>
            </p>

            <button className="oauth-modal-close-btn" onClick={() => setShowOauthModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
