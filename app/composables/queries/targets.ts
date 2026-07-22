import type { TCreateTargetBody } from '#server/api/organizations/[orgId]/targets/index.post'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

export function useTargetsQuery(orgId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId, 'targets'],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}/targets`, { headers }),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useTargetQuery(orgId: MaybeRef<string>, targetId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId, 'targets', targetId],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}/targets/${toValue(targetId)}`, { headers }),
    // Don't fire with an empty id (renders as `/targets//...` -> 400) before the route param resolves.
    enabled: computed(() => !!toValue(targetId)),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useScrapingResultsQuery(orgId: MaybeRef<string>, targetId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId, 'targets', targetId, 'scraping-results'],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}/targets/${toValue(targetId)}/scraping-results`, { headers }),
    enabled: computed(() => !!toValue(targetId)),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useTargetMutations() {
  const queryClient = useQueryClient()

  const createTarget = useMutation({
    mutationFn: (data: { orgId: string, body: TCreateTargetBody }) =>
      $fetch(`/api/organizations/${data.orgId}/targets`, { method: 'POST', body: data.body }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'targets'] }),
  })

  const deleteTarget = useMutation({
    mutationFn: (data: { orgId: string, targetId: string }) =>
      $fetch(`/api/organizations/${data.orgId}/targets/${data.targetId}`, { method: 'DELETE' }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'targets'] }),
  })

  const triggerScrape = useMutation({
    mutationFn: (data: { orgId: string, targetId: string }) =>
      $fetch(`/api/organizations/${data.orgId}/targets/${data.targetId}/scrape`, { method: 'POST' }),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'targets', vars.targetId] })
      queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'targets', vars.targetId, 'scraping-results'] })
      queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'targets'] })
    },
  })

  return { createTarget, deleteTarget, triggerScrape }
}
