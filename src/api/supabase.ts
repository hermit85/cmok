import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://pckpxspcecbvjprxmdja.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vTRaZ3u4_r0xZjyJwxGmEg_z7ylSAnP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
