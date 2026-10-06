// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, expect, it } from 'vitest';

// JSDOM does not evaluate media queries. Select the applicable screen rules,
// then use its CSS cascade to guard visibility regressions (not pixel layout).
function screenStyles(width: number) {
  const root = postcss.parse(['styles.css', 'mobile.css', 'operations.css'].map(file => readFileSync(`client/src/${file}`, 'utf8')).join('\n'));
  root.walkAtRules('media', rule => {
    const min = /min-width:\s*(\d+)px/.exec(rule.params);
    const max = /max-width:\s*(\d+)px/.exec(rule.params);
    if (/print|prefers-reduced-motion/.test(rule.params) || (min && width < Number(min[1])) || (max && width > Number(max[1]))) rule.remove();
    else rule.replaceWith(...(rule.nodes ?? []));
  });
  const style = document.createElement('style'); style.textContent = root.toString(); document.head.append(style);
}
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });
it.each([320, 390, 767, 1280])('shows profit source once without expanding details at %ipx', width => {
  screenStyles(width);
  document.body.innerHTML = '<table class="data-table"><tbody><tr data-details-expanded="false"><td class="table-cell profit-partner-cell"><a>Partner</a><span class="profit-mobile-source">UNI RUPAY</span></td><td class="table-cell profit-source-cell" data-mobile-secondary="true">UNI RUPAY</td></tr></tbody></table>';
  const mobileSource = document.querySelector('.profit-mobile-source')!;
  const sourceColumn = document.querySelector('.profit-source-cell')!;
  for (const expanded of ['false', 'true']) {
    document.querySelector('tr')!.setAttribute('data-details-expanded', expanded);
    expect(getComputedStyle(mobileSource).display === 'none').toBe(width > 767);
    expect(getComputedStyle(sourceColumn).display === 'none').toBe(width <= 767);
  }
});
it.each([320, 390, 767])('removes the minimum table width for statements and portals at %ipx', width => {
  screenStyles(width);
  document.body.innerHTML = '<table class="statement-table adaptive-table"><tbody><tr><td data-label="Balance">100</td></tr></tbody></table><table class="public-portal__table"><tbody><tr><td data-label="Amount">100</td></tr></tbody></table>';
  for (const table of document.querySelectorAll('table')) {
    expect(parseFloat(getComputedStyle(table).minWidth)).toBe(0);
    expect(getComputedStyle(table).display).toBe('block');
    expect(getComputedStyle(table.querySelector('td')!).whiteSpace).toBe('normal');
  }
});
it.each([320, 390, 767])('keeps original actions and one alternative action row visible at %ipx', width => {
  screenStyles(width);
  document.body.innerHTML = `<section class="panel"><table class="data-table"><tbody>
    <tr><td class="table-cell table-cell--action"><button>Restore</button></td></tr>
    <tr><td class="table-cell table-cell--action table-cell--desktop-action"><button>Edit desktop</button></td><td class="table-cell-actions"><button>Edit mobile</button></td></tr>
  </tbody></table></section>`;
  const cells = document.querySelectorAll('td');
  expect(getComputedStyle(cells[0]!).display).not.toBe('none');
  expect(getComputedStyle(cells[1]!).display).toBe('none');
  expect(getComputedStyle(cells[2]!).display).not.toBe('none');
  expect(getComputedStyle(document.body).overflow).not.toBe('hidden');
  expect(getComputedStyle(document.documentElement).overflow).not.toBe('hidden');
});
it('shows all financial columns on desktop and only expanded details on phones', () => {
  document.body.innerHTML = '<table class="data-table"><tbody><tr data-details-expanded="false"><td data-mobile-secondary="true">Source</td><td class="mobile-record-toggle">Show details</td></tr></tbody></table>';
  screenStyles(1280);
  const cells = document.querySelectorAll('td');
  expect(getComputedStyle(cells[0]!).display).not.toBe('none');
  expect(getComputedStyle(cells[1]!).display).toBe('none');
  document.head.innerHTML = '';
  screenStyles(390);
  expect(getComputedStyle(cells[0]!).display).toBe('none');
  expect(getComputedStyle(cells[1]!).display).not.toBe('none');
  document.querySelector('tr')!.setAttribute('data-details-expanded', 'true');
  expect(getComputedStyle(cells[0]!).display).not.toBe('none');
});
