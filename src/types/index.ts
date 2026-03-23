export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'senior' | 'caregiver';
  checkin_time: string | null;
  timezone: string;
}

export interface CarePair {
  id: string;
  senior_id: string;
  caregiver_id: string;
  priority: number;
  sms_fallback_phone: string;
  invite_code: string | null;
  invite_expires_at: string | null;
  status: 'pending' | 'active';
  joined_at: string | null;
}

export interface DailyCheckin {
  id: string;
  senior_id: string;
  local_date: string;
  checked_at: string;
  source: 'app' | 'notification';
}

export interface AlertCase {
  id: string;
  senior_id: string;
  type: 'sos' | 'missed_checkin';
  state: 'open' | 'acknowledged' | 'resolved' | 'cancelled';
  triggered_at: string;
  latitude: number | null;
  longitude: number | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
}
