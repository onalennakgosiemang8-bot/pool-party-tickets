import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { EVENT, formatZAR } from './event';
import { qrPngBuffer } from './qr';

const NAVY = rgb(0.016, 0.094, 0.169);
const OCEAN = rgb(0.027, 0.231, 0.388);
const POOL = rgb(0.122, 0.659, 0.878);
const AQUA = rgb(0.498, 0.89, 0.91);
const GOLD = rgb(0.847, 0.694, 0.369);
const WHITE = rgb(1, 1, 1);

/** Renders the premium event pass as a single-page A6-landscape PDF. */
export async function buildTicketPdf(ticket: {
  ticketNumber: string;
  guestName: string;
  amountCents: number;
  qrPayload: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${EVENT.brand} ${EVENT.name} — Ticket ${ticket.ticketNumber}`);
  doc.setAuthor(EVENT.brand);
  doc.setSubject('Event entry ticket');

  const W = 620;
  const H = 300;
  const page = doc.addPage([W, H]);

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  // Background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY });

  // Soft banded "water" gradient on the left panel
  const panelW = 400;
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    page.drawRectangle({
      x: 0,
      y: (H / 40) * i,
      width: panelW,
      height: H / 40 + 1,
      color: rgb(0.027 + t * 0.06, 0.231 + t * 0.24, 0.388 + t * 0.32),
      opacity: 0.9,
    });
  }

  // Gold hairline frame
  page.drawRectangle({
    x: 10,
    y: 10,
    width: W - 20,
    height: H - 20,
    borderColor: GOLD,
    borderWidth: 1,
    opacity: 0,
    borderOpacity: 0.55,
  });

  // Perforation between the stub and the body
  for (let y = 22; y < H - 22; y += 12) {
    page.drawRectangle({ x: panelW, y, width: 1.2, height: 6, color: GOLD, opacity: 0.5 });
  }

  // ── Left panel content ──
  page.drawText(EVENT.brand, {
    x: 34,
    y: H - 54,
    size: 11,
    font: bold,
    color: GOLD,
    characterSpacing: 5,
  });
  page.drawText('SPLASH WATER PARK', { x: 34, y: H - 86, size: 24, font: bold, color: WHITE });
  page.drawText('PARTY', { x: 34, y: H - 112, size: 24, font: bold, color: AQUA });

  page.drawLine({
    start: { x: 34, y: H - 128 },
    end: { x: panelW - 40, y: H - 128 },
    thickness: 0.8,
    color: GOLD,
    opacity: 0.5,
  });

  const field = (label: string, value: string, x: number, y: number, size = 12) => {
    page.drawText(label, { x, y: y + 15, size: 7, font: regular, color: AQUA, characterSpacing: 1.6 });
    page.drawText(value, { x, y, size, font: bold, color: WHITE });
  };

  field('GUEST', truncate(ticket.guestName, 26), 34, H - 165, 15);
  field('DATE', EVENT.dateLabel, 34, H - 208);
  field('TIME', EVENT.timeLabel, 210, H - 208);
  field('VENUE', EVENT.venueLine1, 34, H - 248, 9);
  page.drawText(EVENT.venueLine2, { x: 34, y: H - 260, size: 9, font: bold, color: WHITE });

  page.drawText(`AMOUNT PAID  ${formatZAR(ticket.amountCents)}`, {
    x: 210,
    y: H - 252,
    size: 9,
    font: regular,
    color: AQUA,
  });

  // ── Right stub ──
  const stubX = panelW + 24;
  page.drawText('TICKET', { x: stubX, y: H - 44, size: 7, font: regular, color: AQUA, characterSpacing: 1.6 });
  page.drawText(`#${ticket.ticketNumber}`, { x: stubX, y: H - 62, size: 15, font: bold, color: GOLD });

  const qrPng = await qrPngBuffer(ticket.qrPayload, 420);
  const qrImage = await doc.embedPng(qrPng);
  const qrSize = 128;

  page.drawRectangle({
    x: stubX - 8,
    y: H - 216,
    width: qrSize + 16,
    height: qrSize + 16,
    color: WHITE,
  });
  page.drawImage(qrImage, { x: stubX, y: H - 208, width: qrSize, height: qrSize });

  page.drawText('CONFIRMED', {
    x: stubX,
    y: H - 240,
    size: 11,
    font: bold,
    color: POOL,
    characterSpacing: 2,
  });
  page.drawText('Scan at the gate · One ticket, one guest', {
    x: stubX,
    y: H - 258,
    size: 7,
    font: regular,
    color: AQUA,
  });

  page.drawText(EVENT.motto, {
    x: 34,
    y: 20,
    size: 7,
    font: regular,
    color: OCEAN,
    characterSpacing: 2.4,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
