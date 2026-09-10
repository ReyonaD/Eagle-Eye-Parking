import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserPermit {
  type: string;
  status: string;
  allowedLots: string[];
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  permit: UserPermit;
}

interface UserContextType {
  user: UserProfile;
  updateUser: (updates: Partial<Omit<UserProfile, 'permit'>> & { permit?: Partial<UserPermit> }) => void;
}

const STORAGE_KEY = 'userProfile';

const DEFAULT_USER: UserProfile = {
  name: 'Student User',
  email: 'student@unt.edu',
  phone: '(000) 000-0000',
  permit: {
    type: 'E',
    status: 'Active',
    allowedLots: [],
  },
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored);
        setUser({
          ...DEFAULT_USER,
          ...parsed,
          permit: { ...DEFAULT_USER.permit, ...parsed.permit },
        });
      } catch {
        // Ignore corrupted storage, keep defaults
      }
    });
  }, []);

  const updateUser: UserContextType['updateUser'] = (updates) => {
    setUser((prev) => {
      const next: UserProfile = {
        ...prev,
        ...updates,
        permit: updates.permit ? { ...prev.permit, ...updates.permit } : prev.permit,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <UserContext.Provider value={{ user, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
