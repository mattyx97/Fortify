import { listUserOrganizations } from '#server/services/organizations'

export default defineAuthEventHandler({
  async handler(_event, { identity: { user } }) {
    return listUserOrganizations({ userId: user.id })
  },
})
