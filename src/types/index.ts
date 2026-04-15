export type AppRole = 'signaler' | 'recipient';
export type RelationshipStatus = 'none' | 'pending' | 'active';

export interface AppProfile {
  id: string;
  phone: string;
  name: string;
  role: AppRole;
  checkinTime: string | null;
  timezone: string;
}

export interface Relationship {
  id: string;
  signalerUserId: string | null;
  recipientUserId: string;
  signalerLabel: string | null;
  inviteCode: string | null;
  inviteExpiresAt: string | null;
  status: Exclude<RelationshipStatus, 'none'>;
  joinedAt: string | null;
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

export type SupportViewerRole = 'signaler' | 'primary' | 'trusted';
export type SupportRecipientKind = 'primary' | 'trusted';
export type SupportDeliveryState = 'sent' | 'failed' | 'pending';

export interface TrustedContact {
  id: string;
  relationshipId: string;
  userId: string;
  name: string;
  phone: string;
  status: 'active' | 'removed';
}

export interface SupportParticipant {
  userId: string;
  name: string;
  phone: string;
  kind: SupportRecipientKind;
  deliveryStatus: SupportDeliveryState;
  isClaimedBy: boolean;
}

export interface SupportCase {
  alert: AlertCase;
  relationshipId: string;
  viewerUserId: string;
  signalerId: string;
  signalerName: string;
  primaryRecipientId: string;
  claimerId: string | null;
  claimerName: string | null;
  viewerRole: SupportViewerRole;
  participants: SupportParticipant[];
}

export interface Signal {
  id: string;
  from_user_id: string;
  to_user_id: string;
  type: 'reaction' | 'nudge' | 'morning_thought' | 'poke';
  emoji: string | null;
  message: string | null;
  created_at: string;
  seen_at: string | null;
}

export interface CircleMember {
  userId: string;
  name: string;
  phone: string;
  role: AppRole;
  relationshipId: string;
}
