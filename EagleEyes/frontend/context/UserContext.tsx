import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from '../api/auth';

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
  // Rebuilds the profile from the current session. Call after every login and logout.
  refreshUser: () => Promise<void>;
}

const STORAGE_KEY = 'userProfile';

const DEFAULT_USER: UserProfile = {
  name: '',
  email: '',
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

  // Rebuilds from scratch (never merges) so a new login never shows the previous account.
  const refreshUser = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      setUser(DEFAULT_USER);
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      const account = await getCurrentUser();
      const fresh: UserProfile = {
        ...DEFAULT_USER,
        name: account.name || '',
        email: account.email || '',
        parkingProfile: {
          ...DEFAULT_USER.parkingProfile,
          permitType: account.permit_type || '',
          plateState: account.plate_state || DEFAULT_USER.parkingProfile.plateState,
          plateNumber: account.plate_number || '',
        },
      };
      setUser(fresh);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Offline: fall back to this session's cached profile (cleared on logout).
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached) setUser({ ...DEFAULT_USER, ...JSON.parse(cached) });
      } catch {
        // corrupt cache — keep whatever's currently loaded
      }
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, updateUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
