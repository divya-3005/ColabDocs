import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  color: string;
}

export const DEMO_PROFILES: User[] = [
  {
    id: 'demo-divya',
    name: 'Divya Singh',
    email: 'divya@colabdocs.dev',
    avatar_url: null,
    color: '#2563eb', // Google Blue
  },
  {
    id: 'demo-alex',
    name: 'Alex Chen',
    email: 'alex.chen@colabdocs.dev',
    avatar_url: null,
    color: '#7c3aed', // Purple
  },
  {
    id: 'demo-sarah',
    name: 'Sarah Connor',
    email: 'sarah.c@colabdocs.dev',
    avatar_url: null,
    color: '#059669', // Emerald Green
  },
];

interface AuthContextType {
  currentUser: User;
  isLoggedIn: boolean;
  googleClientId: string;
  loginWithDemo: (profile: User) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  updateUserDisplayName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('colabdocs_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEMO_PROFILES[0];
  });

  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Sync with backend on initial mount
  useEffect(() => {
    const syncUser = async () => {
      try {
        const res = await fetch('http://localhost:1234/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            demoUser: currentUser,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('colabdocs_auth_user', JSON.stringify(data.user));
          }
        }
      } catch (err) {
        console.warn('Could not sync user with backend on startup:', err);
      }
    };
    syncUser();
  }, []);

  const loginWithDemo = async (profile: User) => {
    try {
      const res = await fetch('http://localhost:1234/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoUser: profile }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        localStorage.setItem('colabdocs_auth_user', JSON.stringify(data.user));
      } else {
        setCurrentUser(profile);
        setIsLoggedIn(true);
        localStorage.setItem('colabdocs_auth_user', JSON.stringify(profile));
      }
    } catch {
      setCurrentUser(profile);
      setIsLoggedIn(true);
      localStorage.setItem('colabdocs_auth_user', JSON.stringify(profile));
    }
  };

  const loginWithGoogle = async (credential: string) => {
    try {
      const res = await fetch('http://localhost:1234/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        localStorage.setItem('colabdocs_auth_user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Google login failed:', err);
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    const guestUser: User = {
      id: 'guest-' + Math.random().toString(36).substring(2, 7),
      name: 'Guest User',
      email: 'guest@colabdocs.dev',
      avatar_url: null,
      color: '#6b7280',
    };
    setCurrentUser(guestUser);
    localStorage.removeItem('colabdocs_auth_user');
  };

  const updateUserDisplayName = (name: string) => {
    const updated = { ...currentUser, name };
    setCurrentUser(updated);
    localStorage.setItem('colabdocs_auth_user', JSON.stringify(updated));
    loginWithDemo(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn,
        googleClientId,
        loginWithDemo,
        loginWithGoogle,
        logout,
        updateUserDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
