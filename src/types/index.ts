export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'senior' | 'caregiver';
  checkin_time: string | null;
  push_token: string | null;
}

export interface Circle {
  id: string;
  senior_id: string;
  caregiver_id: string;
  role_in_circle: 'primary' | 'secondary' | 'neighbor';
  phone_for_sms: string;
}

export interface CheckIn {
  id: string;
  senior_id: string;
  checked_at: string;
  source: 'app' | 'widget' | 'notification';
}

export interface SOSAlert {
  id: string;
  senior_id: string;
  triggered_at: string;
  latitude: number | null;
  longitude: number | null;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}
