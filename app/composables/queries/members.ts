import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

export function useMembersQuery(orgId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}/members`, { headers }),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useMemberMutations() {
  const queryClient = useQueryClient()

  const addMember = useMutation({
    mutationFn: (data: { orgId: string, body: { email: string, role: 'company_admin' | 'analyst' } }) =>
      $fetch(`/api/organizations/${data.orgId}/members`, { method: 'POST', body: data.body }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'members'] }),
  })

  const updateMemberRole = useMutation({
    mutationFn: (data: { orgId: string, memberId: string, body: { role: 'company_admin' | 'analyst' } }) =>
      $fetch(`/api/organizations/${data.orgId}/members/${data.memberId}`, { method: 'PATCH', body: data.body }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'members'] }),
  })

  const removeMember = useMutation({
    mutationFn: (data: { orgId: string, memberId: string }) =>
      $fetch(`/api/organizations/${data.orgId}/members/${data.memberId}`, { method: 'DELETE' }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'members'] }),
  })

  return { addMember, updateMemberRole, removeMember }
}
