import { useCallback, useEffect, useState } from "react";
import {
  cancelOrganizationInvitation,
  createOrganizationInvitations,
  formatOrganizationsApiError,
  getOrganizationMembers,
  listOrganizationInvitations,
  removeMember,
  resendOrganizationInvitation,
} from "../../data/organizationsAdapter.js";

export function useOrganizationMembersData({ organizationId, enabled }) {
  const [membersResponse, setMembersResponse] = useState(null);
  const [invitationsResponse, setInvitationsResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!organizationId || !enabled) return;
    setLoading(true);
    setError("");
    try {
      const [m, inv] = await Promise.all([
        getOrganizationMembers(organizationId),
        listOrganizationInvitations(organizationId),
      ]);
      setMembersResponse(m);
      setInvitationsResponse(inv);
    } catch (e) {
      setError(formatOrganizationsApiError(e));
    } finally {
      setLoading(false);
    }
  }, [organizationId, enabled]);

  useEffect(() => {
    if (!organizationId || !enabled) {
      setMembersResponse(null);
      setInvitationsResponse(null);
      setError("");
      return;
    }
    void refresh();
  }, [organizationId, enabled, refresh]);

  const inviteByEmails = useCallback(
    async (emails) => {
      if (!organizationId || !enabled || !emails?.length) return;
      await createOrganizationInvitations(organizationId, emails);
      await refresh();
    },
    [organizationId, enabled, refresh],
  );

  const cancelInvite = useCallback(
    async (invitationId) => {
      if (!organizationId || !enabled) return;
      await cancelOrganizationInvitation(organizationId, invitationId);
      await refresh();
    },
    [organizationId, enabled, refresh],
  );

  const resendInvite = useCallback(
    async (invitationId) => {
      if (!organizationId || !enabled) return;
      await resendOrganizationInvitation(organizationId, invitationId);
      await refresh();
    },
    [organizationId, enabled, refresh],
  );

  const removeOrgMember = useCallback(
    async (userId) => {
      if (!organizationId || !enabled) return;
      await removeMember(organizationId, userId);
      await refresh();
    },
    [organizationId, enabled, refresh],
  );

  return {
    members: membersResponse?.members ?? [],
    totalMembers: membersResponse?.total_members ?? 0,
    invitations: invitationsResponse?.invitations ?? [],
    loading,
    error,
    refresh,
    inviteByEmails,
    cancelInvite,
    resendInvite,
    removeOrgMember,
  };
}
