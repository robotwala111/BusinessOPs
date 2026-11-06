# Sending quotations through SMTP

The quotation detail page can email an approved quotation directly to the email address saved on its client record. The existing branded quotation PDF is attached to the message. The app does not expose SMTP credentials to the browser.

## What happens when a user sends

1. A user opens a quotation whose status is **Approved** or **Sent** and selects **Send quotation** (or **Resend quotation**).
2. The app sends to the email address saved on the linked client profile with a generated default message; no extra compose step is required.
3. The browser gets the current Supabase access token and renders the quotation with the existing branded PDF generator.
4. The browser posts the PDF, note, and quotation ID to `POST /api/quotations/{id}/email`. The request carries the access token but no SMTP credentials.
5. The server verifies the Supabase user, re-reads the quotation and linked client through that user's authenticated database session, and checks that the quotation is approved or already sent. It takes the recipient address from the database record.
6. Nodemailer connects to the configured SMTP host and sends a plain-text and HTML email with the PDF attached. Attachments are limited to 10 MB.
7. Once the SMTP server accepts the message, the server moves an approved quotation to **Sent**, updates `sent_at`, and adds an `entity_history` event. Sending again for a quotation already marked **Sent** creates a resend history event.

SMTP acceptance means the provider accepted the message for delivery. It does not confirm the recipient's inbox placement or that the recipient read it. Provider delivery logs or bounce notifications are needed for that.

## Configure the mail server

Set these values in `frontend/.env.local` for local development and in the deployment platform's server environment for production. Restart or redeploy after changing them.

| Variable | Description |
| --- | --- |
| `SMTP_HOST` | SMTP server hostname from your email provider |
| `SMTP_PORT` | Usually `587` for STARTTLS or `465` for implicit TLS |
| `SMTP_SECURE` | `false` for port 587; `true` for port 465 |
| `SMTP_USER` | SMTP login username |
| `SMTP_PASSWORD` | SMTP password, app password, or provider SMTP token |
| `SMTP_FROM` | Verified sender address permitted by the provider |
| `SMTP_FROM_NAME` | Sender name shown to the client |
| `SMTP_REPLY_TO` | Optional monitored mailbox for replies |

The example file `frontend/.env.example` contains placeholders. Copy the values from the email provider's SMTP settings. Use a mailbox or sending identity on a domain you control, and publish the provider's SPF/DKIM instructions for that domain to improve delivery. Do not commit real credentials or use `NEXT_PUBLIC_` variable names for SMTP settings.

## Requirements and behavior

- In production, Supabase must be configured and the user must have a valid signed-in session. During local development only, browser demo mode can send using the quotation data from that browser; the API accepts that path only from a loopback origin (`localhost`, `127.0.0.1`, or `::1`).
- The linked client profile must contain a valid email address.
- The quotation must be approved before its first send. A draft must follow the normal review and approval workflow first.
- SMTP fields are checked only when the send endpoint is called. If they are missing or incorrect, the page shows a useful configuration or delivery error and the quotation is not marked as sent.
- The mail is sent to the client's saved primary email. Update the client record if that address is wrong.
- If SMTP accepts a message but the subsequent database update fails, the page warns the user to check the quotation status before retrying, to reduce accidental duplicate sends.

## Provider and deployment notes

Some consumer mail providers require an app password or SMTP-specific token instead of the account password. Business mail providers commonly offer an authenticated SMTP submission endpoint or a relay configured for the sender domain. Use the host, port, TLS mode, and credentials issued for your account; a provider may restrict which `SMTP_FROM` addresses can be used.

The deployment host must allow outbound connections to the selected SMTP port. If the provider blocks SMTP or the host restricts outbound SMTP, use the provider's email API or a supported relay instead of exposing credentials in the browser.

## Troubleshooting

- **SMTP is not configured**: add all required environment variables and restart/redeploy.
- **Authentication failed**: confirm `SMTP_USER` and `SMTP_PASSWORD` or issue a new provider token.
- **Connection timed out**: verify host/port/TLS values and that outbound SMTP is allowed from the deployment.
- **Sender rejected**: make sure `SMTP_FROM` is a verified sender allowed by the provider.
- **Client email missing**: add the address to the client profile, then reload the quotation.
- **Quotation cannot be emailed**: only approved or sent quotations can be sent from this page.
