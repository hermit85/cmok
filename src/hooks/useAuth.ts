import { useState } from 'react';
import type { User } from '../types';

// Placeholder hook — will handle authentication
// - Phone number login via Supabase Auth
// - Role selection (senior / caregiver)
// - Session persistence via SecureStore

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // TODO: implement auth logic
  return {
    user,
    loading,
    isAuthenticated: !!user,
    signIn: async (_phone: string) => {
      console.log('TODO: sign in');
    },
    signOut: async () => {
      setUser(null);
    },
  };
}
