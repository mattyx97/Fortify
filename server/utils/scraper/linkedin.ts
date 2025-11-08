import puppeteer, { Browser, Page } from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {
  BaseScraper,
  ScraperResult,
  ProfileData,
  Experience,
  Education,
  Post,
  type ScraperConfig,
} from './base';

// Aggiungi stealth plugin per evitare detection
const puppeteerExtra = addExtra(puppeteer);
puppeteerExtra.use(StealthPlugin());

export class LinkedInScraper extends BaseScraper {
  constructor(config?: Partial<ScraperConfig>) {
    super(config);
  }

  async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteerExtra.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled',
        ],
        defaultViewport: this.config.viewport,
      });
    }
    return this.browser;
  }

  async scrape(profileUrl: string): Promise<ScraperResult> {
    const startTime = Date.now();
    
    try {
      // Validazione URL
      if (!this.isValidUrl(profileUrl)) {
        return {
          success: false,
          platform: 'linkedin',
          profileUrl,
          error: 'URL non valido',
          scrapedAt: new Date(),
        };
      }

      if (!profileUrl.includes('linkedin.com')) {
        return {
          success: false,
          platform: 'linkedin',
          profileUrl,
          error: 'URL non è un profilo LinkedIn',
          scrapedAt: new Date(),
        };
      }

      // Inizializza browser con retry
      const browser = await this.retryOperation(() => this.initBrowser());
      const page = await browser.newPage();

      // Imposta user agent e headers
      await page.setUserAgent(this.config.userAgent!);
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });

      console.log(`Navigazione verso: ${profileUrl}`);
      
      // Naviga al profilo con retry
      await this.retryOperation(async () => {
        await page.goto(profileUrl, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout,
        });
      });

      // Attesa casuale per sembrare umano
      await this.randomDelay(2000, 4000);

      // Scroll della pagina per caricare contenuto lazy-loaded
      await this.scrollPage(page, 5);

      // Estrai dati profilo
      const profileData = await this.extractProfileData(page);

      const scrapingTime = Date.now() - startTime;
      console.log(`Scraping completato in ${scrapingTime}ms`);

      await page.close();

      return {
        success: true,
        platform: 'linkedin',
        profileUrl,
        data: profileData,
        scrapedAt: new Date(),
      };

    } catch (error) {
      console.error('Errore durante scraping LinkedIn:', error);
      return {
        success: false,
        platform: 'linkedin',
        profileUrl,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
        scrapedAt: new Date(),
      };
    }
  }

  private async extractProfileData(page: Page): Promise<ProfileData> {
    const data: ProfileData = {};

    // Nome completo
    data.fullName = await this.safeExtractText(
      page,
      'h1.text-heading-xlarge, h1.top-card-layout__title, .pv-text-details__left-panel h1'
    );

    // Headline (posizione/titolo)
    data.headline = await this.safeExtractText(
      page,
      '.text-body-medium.break-words, .top-card-layout__headline, .pv-text-details__left-panel .text-body-medium'
    );

    // Località
    data.location = await this.safeExtractText(
      page,
      '.text-body-small.inline.t-black--light.break-words, .top-card-layout__location-text, .pv-text-details__left-panel .text-body-small'
    );

    // Connessioni
    const connectionsText = await this.safeExtractText(
      page,
      '.top-card-layout__connections-text, .pv-top-card--list-bullet li'
    );
    if (connectionsText) {
      const match = connectionsText.match(/(\d+[\d,]*)/);
      if (match) {
        data.connections = parseInt(match[1].replace(/,/g, ''), 10);
      }
    }

    // Sezione About/Bio
    data.bio = await this.extractAbout(page);

    // Esperienze lavorative
    data.experiences = await this.extractExperiences(page);

    // Posizione attuale (dalla prima esperienza)
    if (data.experiences && data.experiences.length > 0) {
      const currentExp = data.experiences.find(exp => exp.current);
      if (currentExp) {
        data.position = currentExp.title;
        data.company = currentExp.company;
      }
    }

    // Competenze
    data.skills = await this.extractSkills(page);

    // Formazione
    data.education = await this.extractEducation(page);

    // Post recenti (se accessibili)
    data.posts = await this.extractRecentPosts(page);

    return data;
  }

  private async extractAbout(page: Page): Promise<string | undefined> {
    try {
      // Cerca la sezione About
      const aboutSelectors = [
        '#about ~ * .inline-show-more-text__text',
        '.pv-about-section .pv-about__summary-text',
        '[class*="about"] .display-flex.ph5.pv3',
        '.core-section-container__content .inline-show-more-text span[aria-hidden="true"]',
      ];

      for (const selector of aboutSelectors) {
        const text = await this.safeExtractText(page, selector, 3000);
        if (text && text.length > 20) {
          return text;
        }
      }
    } catch (error) {
      console.log('Impossibile estrarre sezione About');
    }
    return undefined;
  }

  private async extractExperiences(page: Page): Promise<Experience[]> {
    const experiences: Experience[] = [];

    try {
      // Attendi la sezione esperienze
      const experienceSelectors = [
        '#experience ~ * .pvs-list__container',
        '.experience-section .pv-entity__position-group-pager',
        '[data-view-name="profile-component-entity"]',
      ];

      let experienceItems: any[] = [];

      for (const selector of experienceSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          experienceItems = await page.$$(selector);
          if (experienceItems.length > 0) break;
        } catch {
          continue;
        }
      }

      // Limita alle prime 3 esperienze
      const itemsToProcess = experienceItems.slice(0, 3);

      for (const item of itemsToProcess) {
        try {
          const title = await item.$eval(
            '.t-bold span[aria-hidden="true"], .pv-entity__summary-info h3',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          const company = await item.$eval(
            '.t-14.t-normal span[aria-hidden="true"], .pv-entity__secondary-title',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          const dateRange = await item.$eval(
            '.t-14.t-normal.t-black--light span[aria-hidden="true"], .pv-entity__date-range span:nth-child(2)',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          const location = await item.$eval(
            '.t-14.t-normal.t-black--light span[aria-hidden="true"]:last-child, .pv-entity__location span:nth-child(2)',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          if (title) {
            const exp: Experience = {
              title,
              company: company || '',
            };

            if (location) exp.location = location;

            // Parse date range
            if (dateRange) {
              const current = dateRange.toLowerCase().includes('present') || 
                             dateRange.toLowerCase().includes('attualmente');
              exp.current = current;

              const dates = dateRange.split('-').map(d => d.trim());
              if (dates[0]) exp.startDate = dates[0];
              if (dates[1] && !current) exp.endDate = dates[1];
            }

            experiences.push(exp);
          }
        } catch (error) {
          console.log('Errore parsing esperienza:', error);
        }
      }
    } catch (error) {
      console.log('Impossibile estrarre esperienze');
    }

    return experiences;
  }

  private async extractSkills(page: Page): Promise<string[]> {
    try {
      const skillSelectors = [
        '#skills ~ * .pvs-list__container span[aria-hidden="true"]',
        '.pv-skill-category-entity__name',
        '[data-view-name="profile-skill"] span',
      ];

      for (const selector of skillSelectors) {
        const skills = await this.safeExtractMultiple(page, selector, 3000);
        if (skills.length > 0) {
          // Filtra duplicati e limita a 10
          return [...new Set(skills)].slice(0, 10);
        }
      }
    } catch (error) {
      console.log('Impossibile estrarre competenze');
    }
    return [];
  }

  private async extractEducation(page: Page): Promise<Education[]> {
    const education: Education[] = [];

    try {
      const educationItems = await page.$$(
        '#education ~ * .pvs-list__container > li, .pv-education-entity'
      );

      for (const item of educationItems.slice(0, 3)) {
        try {
          const school = await item.$eval(
            '.t-bold span[aria-hidden="true"], .pv-entity__school-name',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          const degree = await item.$eval(
            '.t-14.t-normal span[aria-hidden="true"], .pv-entity__degree-name .pv-entity__comma-item',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          const dateRange = await item.$eval(
            '.t-14.t-normal.t-black--light span[aria-hidden="true"], .pv-entity__dates span:nth-child(2)',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          if (school) {
            const edu: Education = { school };
            if (degree) edu.degree = degree;
            if (dateRange) {
              const dates = dateRange.split('-').map(d => d.trim());
              if (dates[0]) edu.startDate = dates[0];
              if (dates[1]) edu.endDate = dates[1];
            }
            education.push(edu);
          }
        } catch (error) {
          console.log('Errore parsing formazione:', error);
        }
      }
    } catch (error) {
      console.log('Impossibile estrarre formazione');
    }

    return education;
  }

  private async extractRecentPosts(page: Page): Promise<Post[]> {
    const posts: Post[] = [];

    try {
      // LinkedIn spesso richiede login per vedere i post
      // Proviamo comunque se sono visibili
      const postItems = await page.$$(
        '[data-id*="ugcPost"], .feed-shared-update-v2'
      );

      for (const item of postItems.slice(0, 5)) {
        try {
          const content = await item.$eval(
            '.feed-shared-text, .break-words span[dir="ltr"]',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          const date = await item.$eval(
            '.feed-shared-actor__sub-description, time',
            (el: any) => el.textContent?.trim()
          ).catch(() => null);

          if (content) {
            posts.push({
              content,
              date: date || undefined,
            });
          }
        } catch (error) {
          console.log('Errore parsing post:', error);
        }
      }
    } catch (error) {
      console.log('Impossibile estrarre post (potrebbero richiedere login)');
    }

    return posts;
  }
}

// Istanza globale con rate limiting
let scraperInstance: LinkedInScraper | null = null;

export async function scrapeLinkedInProfile(
  profileUrl: string,
  config?: Partial<ScraperConfig>
): Promise<ScraperResult> {
  if (!scraperInstance) {
    scraperInstance = new LinkedInScraper(config);
  }

  try {
    const result = await scraperInstance.scrape(profileUrl);
    return result;
  } catch (error) {
    console.error('Errore scraping LinkedIn:', error);
    return {
      success: false,
      platform: 'linkedin',
      profileUrl,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
      scrapedAt: new Date(),
    };
  }
}

// Cleanup su process exit
process.on('beforeExit', async () => {
  if (scraperInstance) {
    await scraperInstance.closeBrowser();
  }
});

