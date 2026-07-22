import type { LandingPageConfig } from '#server/lib/database/schema/campaign'
import { z } from 'zod'

const paramsSchema = z.object({ campaignTargetId: z.string().uuid() })

export default defineZodEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params } }) {
    const db = useDatabase()

    const ct = await db.query.campaignTarget.findFirst({
      where: { id: params.campaignTargetId },
      with: { campaign: { with: { template: true } } },
    })

    if (!ct?.campaign?.template) {
      throw createAppError(404, { code: 'NOT_FOUND', message: 'Page not found' })
    }

    const config = ct.campaign.template.landingPageConfig as LandingPageConfig | null
    if (!config) {
      throw createAppError(404, { code: 'NOT_FOUND', message: 'Page not found' })
    }

    const submitUrl = `/api/track/submit/${params.campaignTargetId}`
    const redirectUrl = config.redirectUrl || 'https://www.google.com'

    const fieldsHtml = config.fields.map(f =>
      `<div style="margin-bottom:12px">
        <label style="display:block;font-size:14px;margin-bottom:4px;color:#333">${f.label}</label>
        <input name="${f.name}" type="${f.type}" placeholder="${f.placeholder || ''}" required
          style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box" />
      </div>`,
    ).join('\n')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${config.title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:400px;margin:80px auto;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);padding:40px">
    ${config.brandLogo ? `<img src="${config.brandLogo}" alt="Logo" style="height:40px;margin-bottom:20px" />` : ''}
    <h1 style="margin:0 0 24px;font-size:22px;color:${config.brandColor || '#333'}">${config.title}</h1>
    <form id="lp-form">
      ${fieldsHtml}
      <button type="submit"
        style="width:100%;padding:12px;background:${config.brandColor || '#1a73e8'};color:#fff;border:none;border-radius:6px;font-size:16px;cursor:pointer;margin-top:8px">
        ${config.submitLabel}
      </button>
    </form>
  </div>
  <script>
    document.getElementById('lp-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var data = {};
      new FormData(this).forEach(function(v, k) { data[k] = v; });
      fetch('${submitUrl}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function() {
        window.location.href = '${redirectUrl}';
      });
    });
  </script>
</body>
</html>`

    setResponseHeader(event, 'content-type', 'text/html')
    return html
  },
})
