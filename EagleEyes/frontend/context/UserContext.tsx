import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserPermit {
  type: string;
  status: string;
  allowedLots: string[];
}

export interface ParkingProfile {
  plateState: string;
  plateNumber: string;
  permitType: string;
}

export interface UserProfile {
  name: string;
  email: string;
  permit: UserPermit;
  parkingProfile: ParkingProfile;
}

interface UserContextType {
  user: UserProfile;
  updateUser: (
    updates: Partial<Omit<UserProfile, 'permit' | 'parkingProfile'>> & {
      permit?: Partial<UserPermit>;
      parkingProfile?: Partial<ParkingProfile>;
    }
  ) => void;
}

const STORAGE_KEY = 'userProfile';

const DEFAULT_USER: UserProfile = {
  name: 'Student User',
  email: 'student@unt.edu',
  permit: {
    type: 'E',
    status: 'Active',
    allowedLots: [],
  },
  parkingProfile: {
    plateState: 'TX',
    plateNumber: '',
    permitType: '',
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
          parkingProfile: { ...DEFAULT_USER.parkingProfile, ...parsed.parkingProfile },
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
        parkingProfile: updates.parkingProfile
          ? { ...prev.parkingProfile, ...updates.parkingProfile }
          : prev.parkingProfile,
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
