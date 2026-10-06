'use strict';
const catalyst = require('zcatalyst-sdk-node');
const nodemailer = require('nodemailer');
const { allRows } = require('./shared/persistence.js');
const { monthEndWindow, renderStatement, sendMonthlyStatements } = require('./shared/month-end-statements.js');

module.exports = async (_jobRequest, context) => {
  // This private Job Function has no browser/API route and is disabled in the
  // checked-in configuration. Local/mock runs never initialize SMTP or Catalyst.
  if (process.env.MONTH_END_EMAILS_ENABLED !== 'true' || process.env.VITE_USE_MOCK === 'true' || process.env.CAPITALOS_MOCK === 'true') return context.closeWithSuccess();
  const now = new Date();
  if (!monthEndWindow(now).due) return context.closeWithSuccess();
  let transport;
  try {
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_APP_PASSWORD;
    const appUrl = process.env.APP_BASE_URL;
    if (!user || !password || !appUrl || !/^https:\/\/[^/]+\/app\/?$/.test(appUrl)) throw new Error('Configure SMTP_USER, SMTP_APP_PASSWORD and a valid APP_BASE_URL before enabling month-end email.');
    const app = catalyst.initialize(context);
    const table = name => app.datastore().table(name);
    transport = nodemailer.createTransport({ service: 'gmail', connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, auth: { user, pass: password } });
    const result = await sendMonthlyStatements({ now,
      loadData: async () => {
        const [partners, allocations, returns, profits] = await Promise.all(['COS_Partners', 'COS_Allocations', 'COS_Returns', 'COS_Profits'].map(name => allRows(table(name))));
        return { partners, allocations, returns, profits };
      },
      activity: table('COS_Activity'), events: () => allRows(table('COS_Activity')),
      remainingTime: () => context.getRemainingExecutionTimeMs(),
      send: async statement => {
        const mail = renderStatement(statement, appUrl.replace(/\/$/, ''));
        const receipt = await transport.sendMail({ from: `"CapitalOS" <${user}>`, to: statement.recipient, ...mail });
        if (receipt?.rejected?.length || (Array.isArray(receipt?.accepted) && receipt.accepted.length === 0)) throw new Error('SMTP did not accept the statement.');
      },
    });
    const counts = result.results.reduce((counts, row) => { counts[row.status] = (counts[row.status] || 0) + 1; return counts; }, {});
    console.log('[month-end] Completed', JSON.stringify({ month: result.month, counts }));
    transport.close();
    if (result.results.some(row => ['unconfirmed', 'not_attempted'].includes(row.status))) return context.closeWithFailure();
    return context.closeWithSuccess();
  } catch {
    transport?.close();
    // Do not put recipient information or SMTP configuration in job logs.
    console.error('[month-end] Failed. Inspect configuration and monthly-statement-email entries in Activity.');
    return context.closeWithFailure();
  }
};
