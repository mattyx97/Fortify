import OpenAI from 'openai';
import type { ProfileData } from '../scraper/base';

// Inizializza client OpenAI per Nebius
const client = new OpenAI({
  baseURL: 'https://api.studio.nebius.ai/v1/',
  apiKey: process.env.NEBIUS_API_KEY || '',
});

const MODEL = 'meta-llama/Llama-3.3-70B-Instruct';

// Tipi di campagna supportati
export type CampaignType = 
  | 'password_reset'
  | 'invoice'
  | 'executive_impersonation'
  | 'urgent_request'
  | 'training_invitation'
  | 'security_alert';

// Risultato generazione messaggio
export interface MessageGenerationResult {
  success: boolean;
  subject?: string;
  body?: string;
  error?: string;
}

// Analisi rischio profilo
export interface RiskAnalysis {
  riskLevel: 'low' | 'medium' | 'high';
  score: number; // 0-100
  factors: string[];
  recommendations: string[];
}

/**
 * Genera un messaggio di phishing personalizzato basato sul profilo del target
 */
export async function generatePersonalizedMessage(
  targetProfile: ProfileData,
  campaignType: CampaignType,
  targetName: string,
  targetPosition?: string,
  targetCompany?: string
): Promise<MessageGenerationResult> {
  try {
    if (!process.env.NEBIUS_API_KEY) {
      throw new Error('NEBIUS_API_KEY non configurata');
    }

    // Costruisci contesto dal profilo
    const profileContext = buildProfileContext(targetProfile, targetName, targetPosition, targetCompany);
    
    // Genera prompt basato sul tipo di campagna
    const prompt = buildPrompt(campaignType, profileContext);

    // Chiama Nebius AI
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di cybersecurity che crea simulazioni realistiche di email di phishing per training aziendale. Le email devono essere credibili ma etiche, con l\'obiettivo di educare i dipendenti. Rispondi SEMPRE in italiano.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('Nessuna risposta dal modello AI');
    }

    // Parse risposta (formato: SUBJECT: ... \n\n BODY: ...)
    const parsed = parseAIResponse(response);

    return {
      success: true,
      subject: parsed.subject,
      body: parsed.body,
    };

  } catch (error) {
    console.error('Errore generazione messaggio AI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    };
  }
}

/**
 * Analizza il rischio di un profilo target
 */
export async function analyzeProfileRisk(
  targetProfile: ProfileData,
  targetPosition?: string
): Promise<RiskAnalysis> {
  try {
    if (!process.env.NEBIUS_API_KEY) {
      // Fallback a analisi locale
      return analyzeProfileRiskLocal(targetProfile, targetPosition);
    }

    const profileContext = JSON.stringify({
      position: targetPosition || targetProfile.position,
      company: targetProfile.company,
      skills: targetProfile.skills?.slice(0, 5),
      experienceYears: targetProfile.experiences?.length || 0,
    }, null, 2);

    const prompt = `Analizza il livello di rischio di questo profilo per attacchi di phishing/social engineering:

${profileContext}

Considera:
- Livello di seniority (posizioni senior = più rischio per l'azienda)
- Accesso a dati sensibili
- Visibilità pubblica
- Competenze tecniche (più competenze tech = più consapevolezza)

Rispondi in formato JSON con:
{
  "riskLevel": "low|medium|high",
  "score": 0-100,
  "factors": ["fattore1", "fattore2"],
  "recommendations": ["raccomandazione1", "raccomandazione2"]
}`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di cybersecurity che valuta i rischi di social engineering. Rispondi in italiano con JSON valido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return analyzeProfileRiskLocal(targetProfile, targetPosition);
    }

    // Parse JSON response
    const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
    
    return {
      riskLevel: parsed.riskLevel || 'medium',
      score: parsed.score || 50,
      factors: parsed.factors || [],
      recommendations: parsed.recommendations || [],
    };

  } catch (error) {
    console.error('Errore analisi rischio AI:', error);
    return analyzeProfileRiskLocal(targetProfile, targetPosition);
  }
}

// ========== HELPER FUNCTIONS ==========

function buildProfileContext(
  profile: ProfileData,
  name: string,
  position?: string,
  company?: string
): string {
  const parts: string[] = [];

  parts.push(`Nome: ${name}`);
  
  if (position || profile.position) {
    parts.push(`Posizione: ${position || profile.position}`);
  }

  if (company || profile.company) {
    parts.push(`Azienda: ${company || profile.company}`);
  }

  if (profile.headline) {
    parts.push(`Headline: ${profile.headline}`);
  }

  if (profile.skills && profile.skills.length > 0) {
    parts.push(`Competenze: ${profile.skills.slice(0, 5).join(', ')}`);
  }

  if (profile.experiences && profile.experiences.length > 0) {
    const recentExp = profile.experiences[0];
    parts.push(`Esperienza recente: ${recentExp.title} presso ${recentExp.company}`);
  }

  if (profile.posts && profile.posts.length > 0) {
    parts.push(`Attività recente su LinkedIn: ${profile.posts.length} post recenti`);
  }

  return parts.join('\n');
}

function buildPrompt(campaignType: CampaignType, profileContext: string): string {
  const baseContext = `Profilo del target:\n${profileContext}\n\n`;

  const prompts: Record<CampaignType, string> = {
    password_reset: `${baseContext}Crea un'email di phishing credibile che simula un reset password urgente. L'email deve:
- Sembrare provenire dall'IT aziendale
- Creare urgenza (account a rischio)
- Includere un link "verifica account"
- Essere personalizzata con nome e posizione
- Rimanere plausibile e professionale

Formato risposta:
SUBJECT: [oggetto email]

BODY: [corpo email]`,

    invoice: `${baseContext}Crea un'email di phishing che simula una fattura non pagata. L'email deve:
- Sembrare provenire da un fornitore comune (AWS, Microsoft, Adobe)
- Indicare un importo specifico e data di scadenza
- Includere urgenza per pagamento
- Personalizzata con nome e azienda
- Tono formale e professionale

Formato risposta:
SUBJECT: [oggetto email]

BODY: [corpo email]`,

    executive_impersonation: `${baseContext}Crea un'email di phishing che impersona un dirigente aziendale (CEO/CFO). L'email deve:
- Tono autoritario ma cordiale
- Richiedere azione urgente ma confidenziale
- Riferimento a progetto/situazione specifica
- Personalizzata con nome del target
- Richiedere risposta veloce

Formato risposta:
SUBJECT: [oggetto email]

BODY: [corpo email]`,

    urgent_request: `${baseContext}Crea un'email di phishing con richiesta urgente. L'email deve:
- Sembrare provenire da collega o partner
- Situazione urgente credibile
- Richiedere informazioni o azione specifica
- Personalizzata con dettagli profilo
- Tono professionale ma pressante

Formato risposta:
SUBJECT: [oggetto email]

BODY: [corpo email]`,

    training_invitation: `${baseContext}Crea un'email di phishing che simula invito a training/webinar. L'email deve:
- Sembrare provenire da HR o Learning & Development
- Topic rilevante per il ruolo del target
- Link per registrazione
- Data e ora specifiche
- Tono formale e professionale

Formato risposta:
SUBJECT: [oggetto email]

BODY: [corpo email]`,

    security_alert: `${baseContext}Crea un'email di phishing che simula alert di sicurezza. L'email deve:
- Sembrare provenire da security team
- Segnalare attività sospetta sull'account
- Richiedere verifica immediata
- Personalizzata con nome e posizione
- Tono urgente ma professionale

Formato risposta:
SUBJECT: [oggetto email]

BODY: [corpo email]`,
  };

  return prompts[campaignType] || prompts.urgent_request;
}

function parseAIResponse(response: string): { subject: string; body: string } {
  // Parse formato: SUBJECT: ... \n\n BODY: ...
  const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?:\n\n|\n(?=BODY:))/is);
  const bodyMatch = response.match(/BODY:\s*(.+)/is);

  const subject = subjectMatch?.[1]?.trim() || 'Azione Richiesta';
  const body = bodyMatch?.[1]?.trim() || response;

  return { subject, body };
}

function analyzeProfileRiskLocal(
  profile: ProfileData,
  position?: string
): RiskAnalysis {
  let score = 50; // Base score
  const factors: string[] = [];
  const recommendations: string[] = [];

  // Analisi posizione
  const pos = (position || profile.position || '').toLowerCase();
  if (pos.includes('ceo') || pos.includes('cto') || pos.includes('cfo') || pos.includes('director')) {
    score += 30;
    factors.push('Posizione di leadership - target ad alto valore');
    recommendations.push('Training avanzato su CEO fraud e whaling attacks');
  } else if (pos.includes('manager') || pos.includes('lead')) {
    score += 15;
    factors.push('Posizione manageriale - accesso a dati sensibili');
    recommendations.push('Training su business email compromise (BEC)');
  }

  // Analisi competenze tecniche
  const techSkills = ['security', 'cybersecurity', 'infosec', 'penetration', 'ethical hacking'];
  const hasTechSkills = profile.skills?.some(skill => 
    techSkills.some(tech => skill.toLowerCase().includes(tech))
  );
  
  if (hasTechSkills) {
    score -= 20;
    factors.push('Competenze di sicurezza informatica - maggiore consapevolezza');
  } else {
    score += 10;
    factors.push('Competenze tecniche limitate - maggiore vulnerabilità');
    recommendations.push('Training base su phishing e social engineering');
  }

  // Analisi visibilità pubblica
  if (profile.posts && profile.posts.length > 3) {
    score += 10;
    factors.push('Alta visibilità sui social - più informazioni disponibili per attaccanti');
  }

  // Normalizza score
  score = Math.max(0, Math.min(100, score));

  // Determina risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (score >= 70) {
    riskLevel = 'high';
  } else if (score >= 40) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // Raccomandazioni generali
  if (recommendations.length === 0) {
    recommendations.push('Training periodico su awareness della sicurezza');
  }
  recommendations.push('Implementare autenticazione a due fattori (2FA)');
  recommendations.push('Verificare sempre mittente prima di cliccare link o allegati');

  return {
    riskLevel,
    score,
    factors,
    recommendations,
  };
}

