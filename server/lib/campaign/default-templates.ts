import type { LandingPageConfig } from '../database/schema/campaign'

export interface DefaultTemplate {
  name: string
  description: string
  channel: 'email' | 'sms'
  subject?: string
  content: string
  landingPageConfig?: LandingPageConfig
  /** Relative path (from this file's assets dir) to a base PDF to seed as attachment. */
  attachmentAsset?: { assetFile: string, fileName: string }
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Password Reset',
    description: 'Simulates an urgent password reset request from IT security.',
    channel: 'email',
    subject: '{{company}} - Reimpostazione password obbligatoria',
    content: `<p>Gentile {{firstName}},</p>
<p>A seguito degli aggiornamenti di sicurezza, è necessario reimpostare la password del tuo account aziendale entro 24 ore.</p>
<p>Fai clic sul link seguente per procedere.</p>
<p>IT Security Team<br/>{{company}}</p>`,
    landingPageConfig: {
      title: 'Reset Password',
      brandColor: '#1a73e8',
      fields: [
        { name: 'email', type: 'email', label: 'Email aziendale', placeholder: 'nome@azienda.it' },
        { name: 'password', type: 'password', label: 'Nuova password' },
      ],
      submitLabel: 'Reimposta Password',
    },
  },
  {
    name: 'Invoice Payment',
    description: 'Simulates a fake invoice notification requiring urgent action.',
    channel: 'email',
    subject: 'Fattura #{{invoiceNumber}} - Pagamento in scadenza',
    content: `<p>Gentile {{firstName}},</p>
<p>La informiamo che la fattura allegata è in scadenza. La preghiamo di verificare i dettagli e procedere al pagamento.</p>
<p>Per visualizzare la fattura, acceda al portale aziendale tramite il link seguente.</p>
<p>Ufficio Amministrazione<br/>{{company}}</p>`,
    landingPageConfig: {
      title: 'Portale Fatturazione',
      brandColor: '#34a853',
      fields: [
        { name: 'username', type: 'text', label: 'Username', placeholder: 'nome.cognome' },
        { name: 'password', type: 'password', label: 'Password' },
      ],
      submitLabel: 'Accedi al Portale',
    },
    attachmentAsset: {
      assetFile: 'invoice-default.pdf',
      fileName: 'fattura.pdf',
    },
  },
  {
    name: 'CEO Urgent Request',
    description: 'Simulates an urgent message from the CEO requiring immediate action.',
    channel: 'email',
    subject: 'Urgente - Richiesta da {{ceoName}}',
    content: `<p>Ciao {{firstName}},</p>
<p>Ho bisogno che tu faccia una cosa per me con urgenza. Non posso chiamarti ora, sei disponibile?</p>
<p>Accedi al documento condiviso per i dettagli.</p>
<p>Grazie,<br/>{{ceoName}}</p>`,
    landingPageConfig: {
      title: 'Documento Condiviso',
      brandColor: '#ea4335',
      fields: [
        { name: 'email', type: 'email', label: 'Email', placeholder: 'nome@azienda.it' },
        { name: 'password', type: 'password', label: 'Password' },
      ],
      submitLabel: 'Accedi al Documento',
    },
  },
  {
    name: 'SMS Verification',
    description: 'Simulates a security verification SMS with a link to a fake login page.',
    channel: 'sms',
    content: '{{company}}: Attività sospetta rilevata sul tuo account. Verifica la tua identità: {{link}}',
    landingPageConfig: {
      title: 'Verifica Identità',
      brandColor: '#fbbc04',
      fields: [
        { name: 'phone', type: 'text', label: 'Numero di telefono' },
        { name: 'code', type: 'text', label: 'Codice di verifica' },
      ],
      submitLabel: 'Verifica',
    },
  },
]
