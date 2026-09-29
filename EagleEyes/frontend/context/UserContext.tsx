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
  // Rebuilds the profile from the current session (backend account, or blank
  // defaults if logged out). Call this right after login and right after
  // logout — see the note on the effect below for why it can't be left to
  // just run once on app start.
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

  // Always rebuilds from a clean slate instead of merging onto whatever is
  // already in state/AsyncStorage. That's deliberate: this context used to
  // only sync from the backend once, on the very first app mount, and never
  // cleared its cache on logout — so logging out of one account and into a
  // different one kept showing the first account's name/email/permit, since
  // nothing ever told it the session had changed. Call this after every
  // login and every logout so the profile always matches who's signed in.
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
      // Offline or the request failed — leave whatever's currently loaded rather
      // than wiping it out.
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
