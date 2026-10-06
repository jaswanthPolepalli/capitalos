'use strict';
const catalyst = require('zcatalyst-sdk-node');
const nodemailer = require('nodemailer');
const { dailyWindow, deliverSummary } = require('./shared/daily-summary.js');
const { renderDailySummary } = require('./shared/daily-summary-pdf.js');

module.exports = async (_request, context) => {
  if (process.env.DAILY_SUMMARY_EMAILS_ENABLED !== 'true' || process.env.CAPITALOS_MOCK === 'true' || process.env.VITE_USE_MOCK === 'true') return context.closeWithSuccess();
  const now = new Date();
  if (!dailyWindow(now).due) return context.closeWithSuccess();
  let transport;
  try {
    const user = process.env.SMTP_USER, password = process.env.SMTP_APP_PASSWORD;
    if (!user || !password) throw new Error('Configure SMTP_USER and SMTP_APP_PASSWORD.');
    const app = catalyst.initialize(context);
    transport = nodemailer.createTransport({ service: 'gmail', connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, auth: { user, pass: password } });
    const result = await deliverSummary({ now, mode: 'scheduled', table: name => app.datastore().table(name), render: renderDailySummary,
      send: mail => transport.sendMail({ from: `"CapitalOS" <${user}>`, ...mail }),
    });
    console.log('[daily-summary]', JSON.stringify({ date: result.date, status: result.status }));
    transport.close();
    if (result.status === 'unconfirmed') return context.closeWithFailure();
    return context.closeWithSuccess();
  } catch {
    transport?.close();
    console.error('[daily-summary] Failed. Inspect configuration and daily-summary-email Activity records.');
    return context.closeWithFailure();
  }
};
