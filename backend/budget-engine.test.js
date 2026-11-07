const request = require('supertest');
const app = require('./index');
const { evaluateBudget, BudgetInputError } = require('./budget-engine');

const verified = (id, cost, unit = 'group', quantity = 1) => ({
  id, category: 'fictional activity', quantity, unit, priceStatus: 'verified',
  minimumCost: cost, expectedCost: cost, maximumCost: cost,
  source: { name: 'Fictional test receipt', verifiedAt: '2026-01-01T00:00:00Z' },
});
const estimated = (id, min, expected, max, unit = 'group') => ({
  id, category: 'fictional meal', quantity: 1, unit, priceStatus: 'estimated',
  minimumCost: min, expectedCost: expected, maximumCost: max,
});
const unknown = id => ({ id, category: 'fictional transit', quantity: 1, unit: 'group',
  priceStatus: 'unknown', minimumCost: null, expectedCost: null, maximumCost: null });
const input = (overrides = {}) => ({ currency: 'INR', budgetAmount: 2750, budgetMode: 'total', people: 2,
  expenses: [], ...overrides });

describe('deterministic budget engine', () => {
  test('₹2,750 total for two: group cost once, person cost twice', () => {
    const result = evaluateBudget(input({ expenses: [verified('ride', 500), verified('meal', 300, 'person')] }));
    expect(result).toMatchObject({ effectiveTotalBudget: 2750, effectiveBudgetPerPerson: 1375,
      totalMinimumCost: 1100, totalExpectedCost: 1100, totalMaximumCost: 1100,
      remainingBudget: 1650, utilizationBasisPoints: 4000, affordability: 'fits_conservatively' });
    expect(result.breakdown.map(item => [item.id, item.unitsCharged, item.expectedTotal])).toEqual([['ride', 1, 500], ['meal', 2, 600]]);
  });

  test('₹2,750 per person for two retains mode and scales available total', () => {
    const result = evaluateBudget(input({ budgetMode: 'perPerson', expenses: [verified('ride', 500)] }));
    expect(result).toMatchObject({ effectiveTotalBudget: 5500, effectiveBudgetPerPerson: 2750,
      remainingBudget: 5000, affordability: 'fits_conservatively' });
  });

  test('quantity scales units once per group or for each person', () => {
    const result = evaluateBudget(input({ people: 3, expenses: [verified('taxis', 100, 'group', 2), verified('tickets', 40, 'person', 2)] }));
    expect(result.breakdown.map(item => [item.unitsCharged, item.expectedTotal])).toEqual([[2, 200], [6, 240]]);
    expect(result.totalExpectedCost).toBe(440);
  });

  test('price ranges use maximum for conservative affordability and remain labeled estimated', () => {
    const fit = evaluateBudget(input({ expenses: [estimated('meal', 600, 800, 1000, 'person')] }));
    expect(fit).toMatchObject({ totalMinimumCost: 1200, totalExpectedCost: 1600,
      totalMaximumCost: 2000, remainingBudget: 1150, affordability: 'fits_conservatively' });
    expect(fit.warnings).toEqual([{ code: 'ESTIMATED_PRICES', expenseIds: ['meal'] }]);
    const uncertain = evaluateBudget(input({ expenses: [estimated('meal', 600, 800, 1500, 'person')] }));
    expect(uncertain.affordability).toBe('potentially_fits');
  });

  test('unknown prices cannot become zero or yield a complete total', () => {
    const result = evaluateBudget(input({ expenses: [verified('ride', 500), unknown('fare')] }));
    expect(result).toMatchObject({ totalMinimumCost: null, totalExpectedCost: null, totalMaximumCost: null,
      remainingBudget: null, utilizationBasisPoints: null, affordability: 'cannot_determine' });
    expect(result.warnings[0]).toEqual({ code: 'MISSING_PRICES', expenseIds: ['fare'] });
    expect(result.breakdown[1].expectedTotal).toBeNull();
  });

  test('known minimum exceeding spendable budget proves unaffordability despite unknowns', () => {
    const result = evaluateBudget(input({ expenses: [verified('ride', 2800), unknown('fare')] }));
    expect(result.affordability).toBe('exceeds');
  });

  test('contingency is rounded up once from effective total, not each expense', () => {
    const result = evaluateBudget(input({ budgetAmount: 101, people: 2, contingencyPercent: 10,
      expenses: [verified('ride', 90)] }));
    expect(result).toMatchObject({ contingencyReserve: 11, spendableBudget: 90,
      remainingBudget: 0, affordability: 'fits_conservatively' });
  });

  test('group changes, replacement, addition, removal and price change recalculate without mutation', () => {
    const original = input({ expenses: [verified('ride', 500), verified('meal', 300, 'person')] });
    const snapshot = JSON.stringify(original);
    expect(evaluateBudget(original).totalExpectedCost).toBe(1100);
    expect(evaluateBudget({ ...original, people: 3 }).totalExpectedCost).toBe(1400);
    expect(evaluateBudget({ ...original, expenses: [verified('ride', 500), verified('meal', 400, 'person')] }).totalExpectedCost).toBe(1300);
    expect(evaluateBudget({ ...original, expenses: [verified('ride', 500), verified('meal', 300, 'person'), verified('extra', 75)] }).totalExpectedCost).toBe(1175);
    expect(evaluateBudget({ ...original, expenses: [verified('ride', 500)] }).totalExpectedCost).toBe(500);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(evaluateBudget(original)).toEqual(evaluateBudget(original));
  });

  test('empty expense list has exact zero costs and unused budget', () => {
    expect(evaluateBudget(input())).toMatchObject({ totalMinimumCost: 0, totalExpectedCost: 0,
      totalMaximumCost: 0, remainingBudget: 2750, utilizationBasisPoints: 0,
      affordability: 'fits_conservatively', breakdown: [], warnings: [] });
  });

  test('odd total budgets retain the unallocated rupee and a full reserve leaves no spendable budget', () => {
    const result = evaluateBudget(input({ budgetAmount: 101, contingencyPercent: 100 }));
    expect(result).toMatchObject({ effectiveBudgetPerPerson: 50, perPersonRemainder: 1,
      contingencyReserve: 101, spendableBudget: 0, remainingBudget: 0 });
  });

  test('unbounded estimate is not conservatively affordable', () => {
    const result = evaluateBudget(input({ expenses: [estimated('meal', 200, 400, null)] }));
    expect(result).toMatchObject({ totalMinimumCost: 200, totalExpectedCost: 400,
      totalMaximumCost: null, affordability: 'potentially_fits' });
    expect(result.warnings.map(w => w.code)).toEqual(['UNBOUNDED_ESTIMATES', 'ESTIMATED_PRICES']);
  });

  test.each([
    ['bad budget', { budgetAmount: -1 }], ['fractional budget', { budgetAmount: 1.5 }],
    ['NaN budget', { budgetAmount: NaN }], ['infinite budget', { budgetAmount: Infinity }],
    ['unsupported currency', { currency: 'USD' }], ['bad group', { people: 0 }],
    ['fractional group', { people: 2.5 }], ['invalid mode', { budgetMode: 'mixed' }],
    ['bad reserve', { contingencyPercent: 101 }], ['missing expense list', { expenses: null }],
    ['duplicate IDs', { expenses: [verified('same', 1), verified('same', 2)] }],
    ['negative price', { expenses: [verified('bad', -1)] }],
    ['bad quantity', { expenses: [{ ...verified('bad', 1), quantity: 0 }] }],
    ['reversed range', { expenses: [estimated('bad', 300, 200, 400)] }],
    ['fake verified range', { expenses: [{ ...verified('bad', 100), maximumCost: 200 }] }],
    ['missing verified source', { expenses: [{ ...verified('bad', 100), source: undefined }] }],
    ['unknown as zero', { expenses: [{ ...unknown('bad'), expectedCost: 0 }] }],
    ['control character in ID', { expenses: [verified('bad\nname', 1)] }],
  ])('rejects %s', (_name, change) => {
    expect(() => evaluateBudget(input(change))).toThrow(BudgetInputError);
  });

  test('safe integer boundaries and monetary overflow are explicit errors', () => {
    expect(evaluateBudget(input({ budgetAmount: Number.MAX_SAFE_INTEGER, people: 1 })).effectiveTotalBudget).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => evaluateBudget(input({ budgetMode: 'perPerson', budgetAmount: Number.MAX_SAFE_INTEGER, people: 2 }))).toThrow(BudgetInputError);
    expect(() => evaluateBudget(input({ expenses: [verified('large', Number.MAX_SAFE_INTEGER, 'person')] }))).toThrow(BudgetInputError);
    expect(() => evaluateBudget(input({ expenses: [verified('a', Number.MAX_SAFE_INTEGER), verified('b', 1)] }))).toThrow(BudgetInputError);
  });
});

describe('POST /api/budget/evaluate', () => {
  test('returns exact calculation without provider access or changing itinerary contract', async () => {
    const response = await request(app).post('/api/budget/evaluate').send(input({
      expenses: [verified('ride', 500), verified('meal', 300, 'person')],
    }));
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ effectiveTotalBudget: 2750, totalExpectedCost: 1100,
      remainingBudget: 1650, affordability: 'fits_conservatively' });
  });

  test.each([{}, { ...input(), budgetAmount: -1 }, input({ expenses: [unknown('x'), unknown('x')] })])('rejects invalid JSON contracts', async body => {
    const response = await request(app).post('/api/budget/evaluate').send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_INPUT');
    expect(response.body.stack).toBeUndefined();
  });
});
