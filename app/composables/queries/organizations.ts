import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

export function useOrganizationsQuery() {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations'],
    queryFn: () => $fetch('/api/organizations', { headers }),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useOrganizationQuery(orgId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}`, { headers }),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useOrganizationMutations() {
  const queryClient = useQueryClient()

  const createOrganization = useMutation({
    mutationFn: (data: { body: { name: string } }) =>
      $fetch('/api/organizations', { method: 'POST', body: data.body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['organizations'] }),
  })

  return { createOrganization }
}
