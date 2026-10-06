'use strict';
const PDFDocument = require('pdfkit');
const money = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
const date = value => new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

// The same renderer is used for the scheduled job and the on-demand email.
function renderDailySummary(summary) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 38, info: { Title: 'CapitalOS Daily Summary', Author: 'CapitalOS' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const navy = '#162E40', teal = '#087F83', light = '#EFF5F7';
    const width = doc.page.width - 76;
    let y = 40;
    function text(value, size, color = navy, space = 12) {
      doc.font('Helvetica').fontSize(size).fillColor(color).text(value, 44, y, { width: width - 12 });
      y = doc.y + space;
    }
    function table(headers, rows, widths, numeric = [], center = false, total = false) {
      const align = i => center ? 'center' : numeric.includes(i) ? 'right' : 'left';
      const height = (cells, bold) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 8 : 8.7);
        return Math.max(24, ...cells.map((cell, i) => doc.heightOfString(String(cell), { width: widths[i] - 18, align: align(i), lineGap: 2 }) + 14));
      };
      function draw(cells, header, index, last) {
        const h = height(cells, header || last);
        if (h > doc.page.height - 120) throw new Error('A summary row is too long to fit on a PDF page.');
        if (y + h > doc.page.height - 48) {
          doc.addPage(); y = 40;
          if (!header) draw(headers, true, 0, false);
        }
        doc.rect(38, y, width, h).fill(header ? navy : last ? '#DCEEF0' : index % 2 ? light : '#FFFFFF');
        let x = 38;
        cells.forEach((cell, i) => {
          doc.font(header || last ? 'Helvetica-Bold' : 'Helvetica').fontSize(header ? 8 : 8.7).fillColor(header ? '#FFFFFF' : navy)
            .text(String(cell), x + 9, y + 7, { width: widths[i] - 18, align: align(i), lineGap: 2 });
          x += widths[i];
        });
        y += h;
      }
      draw(headers, true, 0, false);
      rows.forEach((row, i) => draw(row, false, i, total && i === rows.length - 1));
      doc.moveTo(38, y).lineTo(38 + width, y).strokeColor('#CFDDE3').lineWidth(0.5).stroke();
    }
    try {
      text('CAPITALOS  /  DAILY BRIEF', 9, teal, 16);
      text('Your capital, at a glance.', 29, navy, 16);
      const label = new Date(`${summary.date}T12:00:00+05:30`).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });
      text(`${label}  |  India Standard Time`, 9, navy, 26);
      text(`${summary.activity.count} transaction${summary.activity.count === 1 ? '' : 's'} recorded`, 17);
      table(['CAPITAL ADDED', 'CAPITAL RETURNED', 'PROFIT PAID', 'CASHBACK PAID'],
        [[...['additions', 'returns', 'profits'].map(k => money(summary.activity[k])), summary.activity.unknownCashbackCount ? `${money(summary.activity.cashback)} + ${summary.activity.unknownCashbackCount} unrecorded` : money(summary.activity.cashback)]], Array(4).fill(width / 4), [], true);
      y += 24; text('Card section', 17);
      const rows = summary.rows.map(r => [r.partner, r.card, money(r.amount), r.due.length ? r.due.map(d => d ? date(d) : 'Bill not generated').join('\n') : 'Bill not generated', r.profit ? money(r.profit) : 'Profit paid']);
      rows.push(['Total', `${new Set(summary.rows.map(r => r.cardId || `${r.partner}:${r.card}`)).size} cards`, money(summary.rows.reduce((s, r) => s + r.amount, 0)), '', money(summary.rows.reduce((s, r) => s + r.profit, 0))]);
      table(['PARTNER NAME', 'CARD NAME', 'CUMULATIVE\nTOTAL (INR)', 'DUE DATE', 'PROFIT PENDING\n(INR)'], rows, [85, 157, 94, 91, width - 427], [2, 4], false, true);
      doc.addPage(); y = 40; text('Cashback follow-up', 17, navy, 20);
      if (!summary.cb.length) text('No cashback to follow up.', 10);
      else table(['PARTNER NAME', 'CARD NAME / TRANSACTION DATE', 'TRANSACTION AMOUNT (INR)'],
        summary.cb.map(r => [r.partner, `${r.card}\n${date(r.date)}`, money(r.amount)]), [132, 240, width - 372], [2]);
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
module.exports = { renderDailySummary };
