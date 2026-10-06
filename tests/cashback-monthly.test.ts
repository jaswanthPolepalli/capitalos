import { expect, it } from 'vitest';
import { monthlyCashback, cashbackStatus, cashbackTotals, prepareCashback, type Cashback } from '../functions/capitalos-api/cashback.mjs';
const transaction = (id: string, receivedDate = '2026-09-01', creditCardId = 'c', cashback: Cashback = {status:'review'}) => ({ id, receivedDate, creditCardId, cashback });
const statuses = (rows: ReturnType<typeof transaction>[]) => Object.fromEntries(monthlyCashback(rows).map(a => [a.id,cashbackStatus(a)]));
it('leaves every transaction in review before selection, including legacy automatic unpaid defaults',()=>{
  expect(statuses([transaction('first'),transaction('later','2026-09-02','c',{status:'unpaid'})])).toEqual({first:'review',later:'review'});
});
it('selects any transaction manually and separates cards, months and years',()=>{
  const rows=[transaction('first'),transaction('chosen','2026-09-20','c',{status:'unpaid',selectionUpdatedAt:'2026-10-06T00:00:00Z'}),transaction('next','2026-10-01'),transaction('year','2027-09-01'),transaction('other','2026-09-01','other')];
  expect(statuses(rows)).toEqual({first:'not_applicable',chosen:'unpaid',next:'review',year:'review',other:'review'});
  expect(monthlyCashback(rows)[0]?.cashbackSelectedAllocationId).toBe('chosen');
});
it('moves and clears a choice with one write without reviving an old unpaid choice',()=>{
  let rows=[transaction('a'),transaction('b')];
  const save=(id:string,status:'unpaid'|'review')=>{const a=monthlyCashback(rows).find(a=>a.id===id)!;rows=rows.map(row=>row.id===id?{...row,cashback:prepareCashback({status},a,'2026-10-06','2026-10-06T00:00:00Z')}:row);};
  save('a','unpaid');save('b','unpaid');expect(statuses(rows)).toEqual({a:'not_applicable',b:'unpaid'});
  save('b','review');expect(statuses(rows)).toEqual({a:'review',b:'review'});
});
it('preserves legacy recorded payments and ignores combined entries as cashback choices',()=>{
  const paid=transaction('paid','2026-09-02','c',{status:'paid',amountRupees:500,paidDate:'2026-09-03'});
  const rows=monthlyCashback([transaction('first'),paid,{...transaction('combined'),combination:{sources:[]}}]);
  expect(rows.map(cashbackStatus)).toEqual(['not_applicable','paid','not_applicable']);
  expect(cashbackTotals(rows).totalCashbackPaid).toBe(500);
});
it('recalculates after deleting and restoring the selected transaction',()=>{
  const rows=[transaction('a'),transaction('b','2026-09-02','c',{status:'unpaid',selectionUpdatedAt:'2026-10-06T00:00:00Z'})];
  expect(statuses(rows)).toEqual({a:'not_applicable',b:'unpaid'});
  expect(statuses(rows.slice(0,1))).toEqual({a:'review'});
  expect(statuses(rows)).toEqual({a:'not_applicable',b:'unpaid'});
});

it('keeps an existing choice when an excluded peer is manually marked not applicable',()=>{
  const rows=[transaction('a','2026-09-01','c',{status:'unpaid',selectionUpdatedAt:'2026-10-06T00:00:00Z'}),transaction('b')];
  const peer=monthlyCashback(rows)[1]!;
  const saved=prepareCashback({status:'not_applicable'},peer,'2026-10-06');
  expect(saved.selectionUpdatedAt).toBeUndefined();
  expect(statuses([rows[0]!,{...rows[1]!,cashback:saved}])).toEqual({a:'unpaid',b:'not_applicable'});
});
it('keeps financial history for conflicting legacy payments while exposing only one selected transaction',()=>{
  const rows=monthlyCashback([transaction('a','2026-09-01','c',{status:'paid',amountRupees:100,paidDate:'2026-09-03'}),transaction('b','2026-09-02','c',{status:'paid',amountRupees:200,paidDate:'2026-09-03'})]);
  expect(rows.filter(a=>cashbackStatus(a)==='paid')).toHaveLength(1);
  expect(cashbackTotals(rows).totalCashbackPaid).toBe(300);
});

it('clears an unpaid choice from a peer without reviving old choices or changing other months and exclusions',()=>{
  let rows=[transaction('old','2026-09-01','c',{status:'unpaid',selectionUpdatedAt:'2026-10-06T00:00:00Z'}),transaction('selected','2026-09-02','c',{status:'unpaid',selectionUpdatedAt:'2026-10-06T00:00:01Z'}),transaction('peer'),transaction('excluded','2026-09-03','c',{status:'not_applicable'}),transaction('october','2026-10-01','c',{status:'unpaid',updatedAt:'2026-10-06T00:00:00Z'})];
  const peer=monthlyCashback(rows).find(a=>a.id==='peer')!;
  rows=rows.map(a=>a.id==='peer'?{...a,cashback:prepareCashback({status:'review'},peer,'2026-10-06','2026-10-06T00:00:00Z')}:a);
  expect(statuses(rows)).toEqual({old:'review',selected:'review',peer:'review',excluded:'not_applicable',october:'unpaid'});
  const selected=monthlyCashback(rows).find(a=>a.id==='selected')!;
  rows=rows.map(a=>a.id===selected.id?{...a,cashback:prepareCashback({status:'unpaid'},selected,'2026-10-06','2026-10-06T00:00:00Z')}:a);
  expect(statuses(rows)).toMatchObject({selected:'unpaid',peer:'not_applicable'});
});
it('returns a standalone manually excluded transaction to review',()=>{
  const row=transaction('a','2026-09-01','c',{status:'not_applicable'});
  expect(statuses([{...row,cashback:prepareCashback({status:'review'},monthlyCashback([row])[0]!,'2026-10-06')}])).toEqual({a:'review'});
});
