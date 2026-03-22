/**
 * IMAP email watcher - fetches unseen messages from the submission inbox.
 * Supports any IMAP-compatible mailbox (Gmail, Outlook, custom SMTP).
 */
import { ImapFlow } from 'imapflow';

export interface RawEmail {
  uid: string;
  messageId: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  receivedAt: Date;
  bodyText: string;
  htmlBody?: string;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  size: number;
}

function getImapConfig() {
  const host = process.env.IMAP_HOST;
  const port = parseInt(process.env.IMAP_PORT ?? '993', 10);
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;
  const tls = process.env.IMAP_TLS !== 'false';

  if (!host || !user || !pass) {
    throw new Error(
      'Missing IMAP configuration. Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD in environment.'
    );
  }

  return { host, port, secure: tls, auth: { user, pass } };
}

/**
 * Fetch all unseen emails from the INBOX (or configured folder).
 * Returns raw message data including attachments as Buffers.
 */
export async function fetchUnseenEmails(): Promise<RawEmail[]> {
  const config = getImapConfig();
  const mailbox = process.env.IMAP_MAILBOX ?? 'INBOX';

  const client = new ImapFlow({
    ...config,
    logger: false,
  });

  const emails: RawEmail[] = [];

  await client.connect();

  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      // Search for unseen messages
      const searchResult = await client.search({ seen: false });
      const uids = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length === 0) {
        return [];
      }

      // Fetch each message with full body
      for await (const msg of client.fetch(uids, {
        envelope: true,
        source: true,
        uid: true,
        flags: true,
      })) {
        if (!msg.source) continue;
        const parsed = await parseRawMessage(msg.source as Buffer, String(msg.uid));
        emails.push(parsed);

        // Mark as seen after fetching so we don't re-process
        await client.messageFlagsAdd(String(msg.uid), ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails;
}

async function parseRawMessage(source: Buffer, uid: string): Promise<RawEmail> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { simpleParser } = require('mailparser');
  const parsed = await simpleParser(source);

  const attachments: EmailAttachment[] = (parsed.attachments ?? []).map(
    (att: {
      filename?: string;
      contentType: string;
      content: Buffer;
      size?: number;
    }) => ({
      filename: att.filename ?? 'attachment',
      contentType: att.contentType,
      content: att.content,
      size: att.size ?? att.content.length,
    })
  );

  const fromAddress = parsed.from?.value?.[0]?.address ?? '';
  const fromName = parsed.from?.value?.[0]?.name ?? fromAddress;

  return {
    uid,
    messageId: parsed.messageId ?? uid,
    subject: parsed.subject ?? '(no subject)',
    fromAddress,
    fromName,
    receivedAt: parsed.date ?? new Date(),
    bodyText: parsed.text ?? '',
    htmlBody: parsed.html || undefined,
    attachments,
  };
}

export function isConfigured(): boolean {
  return !!(
    process.env.IMAP_HOST &&
    process.env.IMAP_USER &&
    process.env.IMAP_PASSWORD
  );
}
