import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  // Member
  memberId: string | null;
  memberName: string | null;
  deviceId: string | null;

  // Family
  familyId: string | null;
  familyCode: string | null;

  // Streak
  streak: number;

  // Last cmok timestamp (for cooldown)
  lastCmokAt: string | null;

  // Actions
  setMember: (id: string, name: string, deviceId: string) => void;
  setFamily: (id: string, code: string) => void;
  setStreak: (streak: number) => void;
  setLastCmokAt: (timestamp: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      memberId: null,
      memberName: null,
      deviceId: null,
      familyId: null,
      familyCode: null,
      streak: 0,
      lastCmokAt: null,

      setMember: (id, name, deviceId) =>
        set({ memberId: id, memberName: name, deviceId }),

      setFamily: (id, code) =>
        set({ familyId: id, familyCode: code }),

      setStreak: (streak) => set({ streak }),

      setLastCmokAt: (timestamp) => set({ lastCmokAt: timestamp }),

      reset: () =>
        set({
          memberId: null,
          memberName: null,
          deviceId: null,
          familyId: null,
          familyCode: null,
          streak: 0,
          lastCmokAt: null,
        }),
    }),
    {
      name: 'cmok-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
