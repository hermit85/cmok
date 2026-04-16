import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { TrustedContact } from '../types';

function mapTrustedContact(raw: any, userMap: Map<string, { name: string; phone: string }>): TrustedContact {
  const user = userMap.get(raw.user_id);

  return {
    id: raw.id,
    relationshipId: raw.relationship_id,
    userId: raw.user_id,
    name: user?.name || 'Osoba zaufana',
    phone: user?.phone || '',
    status: raw.status,
  };
}

export function useTrustedContacts(relationshipId: string | null) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refreshContacts = useCallback(async () => {
    if (!relationshipId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: contactRows } = await supabase
        .from('trusted_contacts')
        .select('id, relationship_id, user_id, status')
        .eq('relationship_id', relationshipId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      const userIds = [...new Set((contactRows || []).map((row) => row.user_id))];

      let userMap = new Map<string, { name: string; phone: string }>();

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, phone')
          .in('id', userIds);

        userMap = new Map((users || []).map((user) => [user.id, { name: user.name, phone: user.phone }]));
      }

      setContacts((contactRows || []).map((row) => mapTrustedContact(row, userMap)));
    } catch (error) {
      console.error('[useTrustedContacts] refresh error:', error);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [relationshipId]);

  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  const addTrustedContact = useCallback(
    async (phone: string): Promise<{ name: string | null; phone: string | null } | null> => {
      if (!relationshipId) throw new Error('Missing relationship');

      setSaving(true);
      try {
        const { data, error } = await supabase.rpc('add_trusted_contact_by_phone', {
          p_relationship_id: relationshipId,
          p_phone: phone,
        });

        if (error) throw error;

        await refreshContacts();

        // RPC returns array with single row; columns are out_name, out_phone
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        return row ? { name: row.out_name ?? null, phone: row.out_phone ?? null } : null;
      } finally {
        setSaving(false);
      }
    },
    [relationshipId, refreshContacts]
  );

  const removeTrustedContact = useCallback(
    async (trustedContactId: string) => {
      setSaving(true);
      try {
        const { error } = await supabase.rpc('remove_trusted_contact', {
          p_trusted_contact_id: trustedContactId,
        });

        if (error) throw error;

        await refreshContacts();
      } finally {
        setSaving(false);
      }
    },
    [refreshContacts]
  );

  return {
    contacts,
    loading,
    saving,
    addTrustedContact,
    removeTrustedContact,
    refreshContacts,
  };
}
