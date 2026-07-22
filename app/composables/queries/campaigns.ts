import type { TCreateCampaignBody } from '#server/api/organizations/[orgId]/campaigns/index.post'
import type { TCreateTemplateBody } from '#server/api/organizations/[orgId]/templates/index.post'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

// ===== TEMPLATES =====

export function useTemplatesQuery(orgId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId, 'templates'],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}/templates`, { headers }),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useTemplateMutations() {
  const queryClient = useQueryClient()

  const createTemplate = useMutation({
    mutationFn: (data: { orgId: string, body: TCreateTemplateBody }) =>
      $fetch(`/api/organizations/${data.orgId}/templates`, { method: 'POST', body: data.body }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'templates'] }),
  })

  const deleteTemplate = useMutation({
    mutationFn: (data: { orgId: string, templateId: string }) =>
      $fetch(`/api/organizations/${data.orgId}/templates/${data.templateId}`, { method: 'DELETE' }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'templates'] }),
  })

  return { createTemplate, deleteTemplate }
}

// ===== CAMPAIGNS =====

export function useCampaignsQuery(orgId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId, 'campaigns'],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}/campaigns`, { headers }),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useCampaignQuery(orgId: MaybeRef<string>, campaignId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId, 'campaigns', campaignId],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}/campaigns/${toValue(campaignId)}`, { headers }),
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useCampaignInteractionsQuery(orgId: MaybeRef<string>, campaignId: MaybeRef<string>) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', orgId, 'campaigns', campaignId, 'interactions'],
    queryFn: () => $fetch(`/api/organizations/${toValue(orgId)}/campaigns/${toValue(campaignId)}/interactions`, { headers }),
    refetchInterval: 10000,
  })
  onServerPrefetch(q.suspense)
  return q
}

export function useCampaignMutations() {
  const queryClient = useQueryClient()

  const createCampaign = useMutation({
    mutationFn: (data: { orgId: string, body: TCreateCampaignBody }) =>
      $fetch(`/api/organizations/${data.orgId}/campaigns`, { method: 'POST', body: data.body }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'campaigns'] }),
  })

  const updateCampaignStatus = useMutation({
    mutationFn: (data: { orgId: string, campaignId: string, status: 'draft' | 'active' | 'completed' }) =>
      $fetch(`/api/organizations/${data.orgId}/campaigns/${data.campaignId}`, { method: 'PATCH', body: { status: data.status } }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'campaigns'] }),
  })

  const deleteCampaign = useMutation({
    mutationFn: (data: { orgId: string, campaignId: string }) =>
      $fetch(`/api/organizations/${data.orgId}/campaigns/${data.campaignId}`, { method: 'DELETE' }),
    onSettled: (_d, _e, vars) => queryClient.invalidateQueries({ queryKey: ['organizations', vars.orgId, 'campaigns'] }),
  })

  return { createCampaign, updateCampaignStatus, deleteCampaign }
}
