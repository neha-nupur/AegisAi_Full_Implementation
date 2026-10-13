import { createTransport, type Transporter, createTestAccount, getTestMessageUrl } from "nodemailer";

/**
 * Email service for AegisAI — sends verification and password-reset emails.
 *
 * Configuration is read from process.env at construction time:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_BASE_URL
 *
 * In development without credentials, it automatically provisions an Ethereal email account
 * and logs the preview URL to the console.
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private from: string;
  private baseUrl: string;

  constructor() {
    this.from = process.env.SMTP_FROM || '"AegisAI Security" <noreply@aegisai.local>';
    this.baseUrl = process.env.APP_BASE_URL || "http://localhost:5173";

    if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      this.transporter = createTransport({
        host: process.env.SMTP_HOST || "localhost",
        port: parseInt(process.env.SMTP_PORT || "1025", 10),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }
  }

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;

    console.warn("[EmailService] No SMTP credentials provided. Generating a test Ethereal account...");
    const testAccount = await createTestAccount();
    this.transporter = createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    return this.transporter;
  }

  async sendVerificationEmail(to: string, _token: string, role?: string): Promise<void> {
    const transporter = await this.getTransporter();
    const userName = to.split("@")[0];

    const info = await transporter.sendMail({
      from: this.from,
      to,
      subject: "Welcome to AegisAI — Your Account Is Ready",
      text: `Welcome to AegisAI\n\nHi ${userName},\n\nYour AegisAI account has been successfully created.\n\nAccount: ${to}\nRole: ${role || "User"}\n\nYou can now sign in to your AegisAI workspace and start using the platform.\n${this.baseUrl}/login\n\nSecurity notice: If you did not create this account, please contact your organization administrator.\n\nRegards,\nAegisAI Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0e12; color: #e2e8f0; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
          <div style="background-color: #00ff87; padding: 2rem; text-align: center;">
            <h1 style="color: #000; margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.025em;">AegisAI</h1>
            <p style="color: #000; margin: 0.5rem 0 0 0; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">Enterprise AI Security & Governance Control Plane</p>
          </div>
          <div style="padding: 2.5rem; background-color: #151821;">
            <h2 style="color: #fff; margin-top: 0; font-size: 1.5rem;">Welcome to AegisAI</h2>
            <p style="color: #94a3b8; font-size: 1rem; line-height: 1.5;">Hi ${userName},</p>
            <p style="color: #94a3b8; font-size: 1rem; line-height: 1.5;">Your AegisAI account has been successfully created.</p>
            
            <div style="background-color: #1e293b; border-radius: 8px; padding: 1.5rem; margin: 2rem 0;">
              <div style="margin-bottom: 1rem;">
                <span style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Account</span><br/>
                <strong style="color: #fff; font-size: 1rem;">${to}</strong>
              </div>
              <div>
                <span style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Role</span><br/>
                <strong style="color: #fff; font-size: 1rem;">${role || "User"}</strong>
              </div>
            </div>

            <p style="color: #94a3b8; font-size: 1rem; line-height: 1.5;">You can now sign in to your AegisAI workspace and start using the platform.</p>
            
            <div style="text-align: center; margin: 2.5rem 0;">
              <a href="${this.baseUrl}/login" style="display: inline-block; padding: 14px 28px; background-color: #00ff87; color: #000; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 1rem; transition: background-color 0.2s;">Sign In to AegisAI</a>
            </div>

            <p style="font-size: 0.875rem; color: #64748b; border-top: 1px solid #1e293b; padding-top: 1.5rem; margin-top: 2.5rem;">
              <strong>Security notice:</strong><br/>
              If you did not create this account, please contact your organization administrator.
            </p>
            <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 0;">
              Regards,<br/>
              AegisAI Team
            </p>
          </div>
        </div>
      `,
    });

    if (!process.env.SMTP_USER) {
      console.log("[EmailService] Verification Email sent. Preview URL:", getTestMessageUrl(info));
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/reset-password?token=${token}`;
    const transporter = await this.getTransporter();
    const userName = to.split("@")[0];

    const info = await transporter.sendMail({
      from: this.from,
      to,
      subject: "Reset your AegisAI password",
      text: `AegisAI\n\nReset your password\n\nHi ${userName},\n\nWe received a request to reset the password for your AegisAI account.\n\nClick the link below to create a new password:\n${resetUrl}\n\nThis link will expire in 15 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nFor your security, never share this link with anyone.\n\nRegards,\nAegisAI Security Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0e12; color: #e2e8f0; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
          <div style="background-color: #00ff87; padding: 2rem; text-align: center;">
            <h1 style="color: #000; margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.025em;">AegisAI</h1>
          </div>
          <div style="padding: 2.5rem; background-color: #151821;">
            <h2 style="color: #fff; margin-top: 0; font-size: 1.5rem;">Reset your password</h2>
            <p style="color: #94a3b8; font-size: 1rem; line-height: 1.5;">Hi ${userName},</p>
            <p style="color: #94a3b8; font-size: 1rem; line-height: 1.5;">We received a request to reset the password for your AegisAI account.</p>
            
            <p style="color: #fff; font-size: 1rem; line-height: 1.5; margin: 2rem 0 1rem 0;">Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 1.5rem 0 2.5rem 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #00ff87; color: #000; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 1rem; transition: background-color 0.2s;">Reset Password</a>
            </div>

            <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 1rem; border-radius: 0 4px 4px 0; margin-bottom: 2rem;">
              <p style="color: #fca5a5; margin: 0; font-size: 0.875rem;">This link will expire in <strong>15 minutes</strong>.</p>
            </div>

            <p style="font-size: 0.875rem; color: #64748b; border-top: 1px solid #1e293b; padding-top: 1.5rem;">
              If you did not request a password reset, you can safely ignore this email.<br/><br/>
              <strong>For your security, never share this link with anyone.</strong>
            </p>
            <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 0;">
              Regards,<br/>
              AegisAI Security Team
            </p>
          </div>
        </div>
      `,
    });

    if (!process.env.SMTP_USER) {
      console.log("[EmailService] Password Reset Email sent. Preview URL:", getTestMessageUrl(info));
    }
  }
}

