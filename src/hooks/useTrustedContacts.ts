import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { TrustedContact } from '../types';

interface TrustedContactExt extends TrustedContact {
  isSelf: boolean;
  isAddableByMe: boolean;
}

export function useTrustedContacts(relationshipId: string | null) {
  const [contacts, setContacts] = useState<TrustedContactExt[]>([]);
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
      // Use privacy-aware RPC: phone is masked for callers without permission
      const { data, error } = await supabase.rpc('get_trusted_circle', {
        p_relationship_id: relationshipId,
      });

      if (error) throw error;

      const mapped: TrustedContactExt[] = (data || []).map((row: {
        trusted_contact_id: string;
        user_id: string | null;
        name: string;
        phone: string | null;
        status: string;
        invite_code: string | null;
        is_self: boolean;
        is_addable_by_me: boolean;
      }) => ({
        id: row.trusted_contact_id,
        relationshipId,
        userId: row.user_id,
        name: row.name || 'Osoba zaufana',
        phone: row.phone || '',
        status: row.status as 'active' | 'pending' | 'removed',
        inviteCode: row.invite_code ?? null,
        isSelf: row.is_self,
        isAddableByMe: row.is_addable_by_me,
      }));

      setContacts(mapped);
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
    async (
      phone: string,
    ): Promise<{ name: string | null; phone: string | null; inviteCode: string | null } | null> => {
      if (!relationshipId) throw new Error('Missing relationship');

      setSaving(true);
      try {
        const { data, error } = await supabase.rpc('add_trusted_contact_by_phone', {
          p_relationship_id: relationshipId,
          p_phone: phone,
        });

        if (error) throw error;

        await refreshContacts();

        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        return row
          ? {
              name: row.out_name ?? null,
              phone: row.out_phone ?? null,
              inviteCode: row.out_invite_code ?? null,
            }
          : null;
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
