import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

#load the .env file so we can pull the SMTP credentials
load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")          #the gmail address that sends the emails
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  #16-char Google App Password, NOT the account password
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "EagleEyes Parking")


def send_password_reset_email(to_email: str, code: str) -> None:
    """Sends the 6-digit password-reset code to the user. Runs in a background task so it never blocks the API response."""
    if not SMTP_USER or not SMTP_PASSWORD:
        #credentials missing -> fall back to console so local dev still works
        print(f"[PASSWORD RESET] SMTP not configured, code for {to_email}: {code}")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = "EagleEyes - Password Reset Code"
    message["From"] = f"{EMAIL_FROM_NAME} <{SMTP_USER}>"
    message["To"] = to_email

    text_body = (
        "We received a request to reset your EagleEyes password.\n\n"
        f"Your verification code: {code}\n\n"
        "Enter this code in the app to set a new password. "
        "It expires in 15 minutes and can only be used once.\n\n"
        "If you didn't request this, you can safely ignore this email."
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #00853E;">EagleEyes Parking</h2>
      <p>We received a request to reset your password.</p>
      <p>Your verification code:</p>
      <p style="background: #f4f4f4; padding: 16px; border-radius: 8px; text-align: center;
                font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
        {code}
      </p>
      <p>Enter this code in the app to set a new password.<br>
         It expires in <b>15 minutes</b> and can only be used once.</p>
      <p style="color: #888; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    """
    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, message.as_string())
        print(f"[PASSWORD RESET] email sent to {to_email}")
    except Exception as exc:
        #never crash the request because of a mail failure, just log it
        print(f"[PASSWORD RESET] FAILED to send email to {to_email}: {exc}")
