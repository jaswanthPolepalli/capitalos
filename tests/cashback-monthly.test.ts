import { expect, it } from 'vitest';
import { monthlyCashback, cashbackRecorded, cashbackStatus, cashbackTotals, prepareCashback, type Cashback } from '../functions/capitalos-api/cashback.mjs';
const transaction = (id: string, receivedDate = '2026-09-01', creditCardId = 'c', cashback: Cashback = {status:'review'}) => ({ id, receivedDate, creditCardId, cashback });
const statuses = (rows: ReturnType<typeof transaction>[]) => Object.fromEntries(monthlyCashback(rows).map(a => [a.id,cashbackStatus(a)]));
const row = (rows: ReturnType<typeof transaction>[], id: string) => monthlyCashback(rows).find(a => a.id === id)!;
const save = (rows: ReturnType<typeof transaction>[], id: string, input: Record<string, unknown>) =>
  rows.map(a => a.id === id ? { ...a, cashback: prepareCashback(input, row(rows, id), '2026-10-06', '2026-10-06T00:00:00Z') } : a);

it('leaves every transaction in review before a decision, including legacy automatic unpaid defaults',()=>{
  expect(statuses([transaction('first'),transaction('later','2026-09-02','c',{status:'unpaid'})])).toEqual({first:'review',later:'review'});
});
it('keeps new transactions in review and never derives a status from peers',()=>{
  const rows=[transaction('first'),transaction('chosen','2026-09-20','c',{status:'unpaid',updatedAt:'2026-10-06T00:00:00Z'}),transaction('next','2026-10-01'),transaction('year','2027-09-01'),transaction('other','2026-09-01','other')];
  expect(statuses(rows)).toEqual({first:'review',chosen:'unpaid',next:'review',year:'review',other:'review'});
  expect(row(rows,'first').cashbackOtherAllocationIds).toEqual(['chosen']);
  for (const id of ['next','year','other']) expect(row(rows,id).cashbackOtherAllocationIds).toEqual([]);
});
it('warns once when a reviewed transaction moves to unpaid and keeps the earlier one unchanged',()=>{
  let rows=[transaction('a'),transaction('b')];
  rows=save(rows,'a',{status:'unpaid'});
  expect(statuses(rows)).toEqual({a:'unpaid',b:'review'});
  expect(()=>save(rows,'b',{status:'unpaid'})).toThrow('already recorded');
  expect(()=>save(rows,'b',{status:'unpaid',confirmedCashbackAllocationIds:['wrong']})).toThrow('already recorded');
  rows=save(rows,'b',{status:'unpaid',confirmedCashbackAllocationIds:['a']});
  expect(statuses(rows)).toEqual({a:'unpaid',b:'unpaid'});
  // Correcting an already recorded transaction never asks for confirmation again.
  rows=save(rows,'b',{status:'paid',amountRupees:500,paidDate:'2026-09-03'});
  expect(statuses(rows)).toEqual({a:'unpaid',b:'paid'});
});
it('needs confirmation listing every recorded peer before a second payment',()=>{
  let rows=[transaction('a','2026-09-01','c',{status:'paid',amountRupees:500,paidDate:'2026-09-03'}),transaction('b','2026-09-02','c',{status:'unpaid',updatedAt:'2026-10-06T00:00:00Z'}),transaction('extra')];
  expect(row(rows,'extra').cashbackOtherAllocationIds).toEqual(['a','b']);
  const payment={status:'paid',amountRupees:700,paidDate:'2026-09-03'};
  expect(()=>save(rows,'extra',{...payment,confirmedCashbackAllocationIds:['a']})).toThrow('already recorded');
  rows=save(rows,'extra',{...payment,confirmedCashbackAllocationIds:['b','a']});
  expect(statuses(rows)).toEqual({a:'paid',b:'unpaid',extra:'paid'});
  expect(cashbackTotals(rows).totalCashbackPaid).toBe(1200);
});
it('requires no confirmation for review or not applicable and restores review afterwards',()=>{
  let rows=[transaction('a','2026-09-01','c',{status:'unpaid',updatedAt:'2026-10-06T00:00:00Z'}),transaction('b')];
  rows=save(rows,'b',{status:'not_applicable'});
  expect(statuses(rows)).toEqual({a:'unpaid',b:'not_applicable'});
  rows=save(rows,'b',{status:'review'});
  expect(statuses(rows)).toEqual({a:'unpaid',b:'review'});
  rows=save(rows,'a',{status:'review'});
  expect(statuses(rows)).toEqual({a:'review',b:'review'});
  expect(row(rows,'b').cashbackOtherAllocationIds).toEqual([]);
  // A cleared transaction warns again before a new decision.
  expect(()=>save(save(rows,'a',{status:'unpaid'}),'b',{status:'unpaid'})).toThrow('already recorded');
});
it('preserves legacy recorded payments and ignores cash and combined entries',()=>{
  const paid=transaction('paid','2026-09-02','c',{status:'paid',amountRupees:500,paidDate:'2026-09-03'});
  const rows=monthlyCashback([transaction('first'),paid,{...transaction('combined'),combination:{sources:[]}},{...transaction('cash'),creditCardId:null}]);
  expect(rows.map(cashbackStatus)).toEqual(['review','paid','not_applicable','not_applicable']);
  expect(cashbackTotals(rows).totalCashbackPaid).toBe(500);
});
it('shows every legacy payment as paid without hiding any of them',()=>{
  const rows=monthlyCashback([transaction('a','2026-09-01','c',{status:'paid',amountRupees:100,paidDate:'2026-09-03'}),transaction('b','2026-09-02','c',{status:'paid',amountRupees:200,paidDate:'2026-09-03'})]);
  expect(rows.filter(a=>cashbackStatus(a)==='paid')).toHaveLength(2);
  expect(cashbackTotals(rows).totalCashbackPaid).toBe(300);
});
it('recognises recorded decisions and ignores legacy automatic unpaid defaults',()=>{
  expect(cashbackRecorded({status:'unpaid'})).toBe(false);
  expect(cashbackRecorded({status:'unpaid',updatedAt:'2026-10-06T00:00:00Z'})).toBe(true);
  expect(cashbackRecorded({status:'paid',amountRupees:1,paidDate:'2026-09-03'})).toBe(true);
  expect(cashbackRecorded({status:'review'})).toBe(false);
  expect(cashbackRecorded(null)).toBe(false);
});
it('recalculates the warning list after deleting and restoring a recorded transaction',()=>{
  const rows=[transaction('a'),transaction('b','2026-09-02','c',{status:'unpaid',updatedAt:'2026-10-06T00:00:00Z'})];
  expect(row(rows,'a').cashbackOtherAllocationIds).toEqual(['b']);
  expect(monthlyCashback(rows.slice(0,1))[0]?.cashbackOtherAllocationIds).toEqual([]);
  expect(row(rows,'a').cashbackOtherAllocationIds).toEqual(['b']);
});
