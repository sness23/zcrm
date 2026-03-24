import { google, gmail_v1 } from 'googleapis'

// Gmail API scopes needed
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',  // Create drafts
  'https://www.googleapis.com/auth/gmail.readonly', // Read drafts/messages
]

interface OAuthTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
  token_type: string
  scope: string
}

interface DraftResult {
  id: string
  message: {
    id: string
    threadId: string
  }
}

export class GmailService {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>
  private gmail: gmail_v1.Gmail | null = null

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9500/api/gmail/callback'

    if (!clientId || !clientSecret) {
      console.warn('Gmail API credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.')
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )
  }

  /**
   * Generate the OAuth authorization URL
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',  // Get refresh token
      prompt: 'consent',       // Force consent to get refresh token
      scope: SCOPES,
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<OAuthTokens> {
    const { tokens } = await this.oauth2Client.getToken(code)
    return tokens as OAuthTokens
  }

  /**
   * Set credentials and initialize Gmail client
   */
  setCredentials(tokens: OAuthTokens): void {
    this.oauth2Client.setCredentials(tokens)
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokensIfNeeded(tokens: OAuthTokens): Promise<OAuthTokens> {
    this.oauth2Client.setCredentials(tokens)

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now()
    if (tokens.expiry_date && tokens.expiry_date < now + 5 * 60 * 1000) {
      const { credentials } = await this.oauth2Client.refreshAccessToken()
      return {
        ...tokens,
        access_token: credentials.access_token!,
        expiry_date: credentials.expiry_date!,
      }
    }

    return tokens
  }

  /**
   * Create a draft email in Gmail
   */
  async createDraft(options: {
    to: string
    toName?: string
    from?: string
    fromName?: string
    subject: string
    body: string
    isHtml?: boolean
  }): Promise<DraftResult> {
    if (!this.gmail) {
      throw new Error('Gmail client not initialized. Call setCredentials first.')
    }

    const { to, toName, from, fromName, subject, body, isHtml = false } = options

    // Build email headers
    const toHeader = toName ? `"${toName}" <${to}>` : to
    const fromHeader = from
      ? (fromName ? `"${fromName}" <${from}>` : from)
      : undefined

    // Build RFC 2822 message
    const messageParts = [
      `To: ${toHeader}`,
      `Subject: ${subject}`,
      `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
      'MIME-Version: 1.0',
    ]

    if (fromHeader) {
      messageParts.splice(1, 0, `From: ${fromHeader}`)
    }

    const rawMessage = [...messageParts, '', body].join('\r\n')

    // Base64 URL-safe encode
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Create draft
    const response = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage,
        },
      },
    })

    return {
      id: response.data.id!,
      message: {
        id: response.data.message?.id!,
        threadId: response.data.message?.threadId!,
      },
    }
  }

  /**
   * List drafts
   */
  async listDrafts(maxResults = 20): Promise<gmail_v1.Schema$Draft[]> {
    if (!this.gmail) {
      throw new Error('Gmail client not initialized. Call setCredentials first.')
    }

    const response = await this.gmail.users.drafts.list({
      userId: 'me',
      maxResults,
    })

    return response.data.drafts || []
  }

  /**
   * Get a specific draft
   */
  async getDraft(draftId: string): Promise<gmail_v1.Schema$Draft> {
    if (!this.gmail) {
      throw new Error('Gmail client not initialized. Call setCredentials first.')
    }

    const response = await this.gmail.users.drafts.get({
      userId: 'me',
      id: draftId,
    })

    return response.data
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId: string): Promise<void> {
    if (!this.gmail) {
      throw new Error('Gmail client not initialized. Call setCredentials first.')
    }

    await this.gmail.users.drafts.delete({
      userId: 'me',
      id: draftId,
    })
  }

  /**
   * Get user's email profile
   */
  async getProfile(): Promise<{ emailAddress: string }> {
    if (!this.gmail) {
      throw new Error('Gmail client not initialized. Call setCredentials first.')
    }

    const response = await this.gmail.users.getProfile({
      userId: 'me',
    })

    return {
      emailAddress: response.data.emailAddress!,
    }
  }
}

// Singleton instance
let gmailService: GmailService | null = null

export function getGmailService(): GmailService {
  if (!gmailService) {
    gmailService = new GmailService()
  }
  return gmailService
}
