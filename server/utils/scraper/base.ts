import type { Browser, Page } from 'puppeteer';

// Interfaccia risultato scraping
export interface ScraperResult {
  success: boolean;
  platform: string;
  profileUrl: string;
  data?: ProfileData;
  error?: string;
  scrapedAt: Date;
}

// Dati profilo estratti
export interface ProfileData {
  fullName?: string;
  headline?: string;
  location?: string;
  company?: string;
  position?: string;
  bio?: string;
  experiences?: Experience[];
  skills?: string[];
  education?: Education[];
  posts?: Post[];
  connections?: number;
  email?: string;
  phone?: string;
  websites?: string[];
  languages?: string[];
}

// Esperienza lavorativa
export interface Experience {
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  current?: boolean;
}

// Formazione
export interface Education {
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

// Post social
export interface Post {
  content: string;
  date?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  url?: string;
}

// Configurazione scraper
export interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  maxRetries?: number;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

// Classe base astratta per scraper
export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected config: ScraperConfig;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      headless: true,
      timeout: 30000,
      maxRetries: 3,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: {
        width: 1920,
        height: 1080,
      },
      ...config,
    };
  }

  // Metodo astratto per scraping
  abstract scrape(profileUrl: string): Promise<ScraperResult>;

  // Inizializza browser
  abstract initBrowser(): Promise<Browser>;

  // Chiude browser
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Retry logic generico
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.config.maxRetries || 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`Tentativo ${i + 1}/${retries} fallito:`, error);
        
        if (i < retries - 1) {
          // Attesa esponenziale tra i retry
          const delay = Math.min(1000 * Math.pow(2, i), 10000);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('Operazione fallita dopo tutti i tentativi');
  }

  // Utility: attesa
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility: attesa casuale (per evitare detection)
  protected randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return this.delay(delay);
  }

  // Utility: scroll pagina
  protected async scrollPage(page: Page, scrolls: number = 3): Promise<void> {
    for (let i = 0; i < scrolls; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await this.randomDelay(500, 1500);
    }
  }

  // Utility: estrazione testo sicura
  protected async safeExtractText(
    page: Page,
    selector: string,
    timeout: number = 5000
  ): Promise<string | null> {
    try {
      await page.waitForSelector(selector, { timeout });
      return await page.$eval(selector, el => el.textContent?.trim() || null);
    } catch {
      return null;
    }
  }

  // Utility: estrazione multipla
  protected async safeExtractMultiple(
    page: Page,
    selector: string,
    timeout: number = 5000
  ): Promise<string[]> {
    try {
      await page.waitForSelector(selector, { timeout });
      return await page.$$eval(selector, elements =>
        elements.map(el => el.textContent?.trim() || '').filter(Boolean)
      );
    } catch {
      return [];
    }
  }

  // Validazione URL
  protected isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Rate limiter semplice per evitare ban
export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private lastRequestTime = 0;

  constructor(
    private maxConcurrent: number = 1,
    private minDelayMs: number = 2000
  ) {}

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Attesa minima tra richieste
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minDelayMs) {
            await this.delay(this.minDelayMs - timeSinceLastRequest);
          }

          this.lastRequestTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });

      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        this.running++;
        fn();
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

