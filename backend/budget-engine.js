// Monetary values are integer INR. BigInt is used for all intermediate money arithmetic.
const MAX_MONEY = Number.MAX_SAFE_INTEGER;
const MAX_EXPENSES = 50;

class BudgetInputError extends Error {
  constructor(field) {
    super(`Invalid ${field}`);
    this.field = field;
  }
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BudgetInputError(field);
  return value;
}

function integer(value, field, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new BudgetInputError(field);
  return value;
}

function label(value, field, max = 80) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max ||
      Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new BudgetInputError(field);
  }
  return value;
}

function money(value, field) {
  return integer(value, field, 0, MAX_MONEY);
}

function toMoney(value, field) {
  if (value < 0n || value > BigInt(MAX_MONEY)) throw new BudgetInputError(field);
  return Number(value);
}

function toSignedMoney(value, field) {
  if (value < -BigInt(MAX_MONEY) || value > BigInt(MAX_MONEY)) throw new BudgetInputError(field);
  return Number(value);
}

function sourceMetadata(source, field, status) {
  if (source === undefined) {
    if (status === 'verified') throw new BudgetInputError(`${field}.source`);
    return undefined;
  }
  object(source, `${field}.source`);
  const name = label(source.name, `${field}.source.name`);
  const reference = source.reference === undefined ? undefined : label(source.reference, `${field}.source.reference`, 200);
  let verifiedAt;
  if (source.verifiedAt !== undefined) {
    if (typeof source.verifiedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(source.verifiedAt) ||
        !Number.isFinite(Date.parse(source.verifiedAt)) ||
        ![new Date(source.verifiedAt).toISOString(), new Date(source.verifiedAt).toISOString().replace('.000Z', 'Z')].includes(source.verifiedAt)) {
      throw new BudgetInputError(`${field}.source.verifiedAt`);
    }
    verifiedAt = source.verifiedAt;
  }
  if (status === 'verified' && !verifiedAt) throw new BudgetInputError(`${field}.source.verifiedAt`);
  return { name, ...(reference === undefined ? {} : { reference }), ...(verifiedAt === undefined ? {} : { verifiedAt }) };
}

function expenseInput(expense, index) {
  const field = `expenses[${index}]`;
  object(expense, field);
  const id = label(expense.id, `${field}.id`);
  const category = label(expense.category, `${field}.category`);
  const quantity = integer(expense.quantity, `${field}.quantity`, 1, 1000);
  if (!['group', 'person'].includes(expense.unit)) throw new BudgetInputError(`${field}.unit`);
  if (!['verified', 'estimated', 'unknown'].includes(expense.priceStatus)) throw new BudgetInputError(`${field}.priceStatus`);
  const status = expense.priceStatus;
  const source = sourceMetadata(expense.source, field, status);
  if (status === 'unknown') {
    if (expense.minimumCost !== null || expense.expectedCost !== null || expense.maximumCost !== null) {
      throw new BudgetInputError(`${field}.price`);
    }
    return { id, category, quantity, unit: expense.unit, priceStatus: status,
      minimumCost: null, expectedCost: null, maximumCost: null, ...(source ? { source } : {}) };
  }
  const minimumCost = money(expense.minimumCost, `${field}.minimumCost`);
  const expectedCost = money(expense.expectedCost, `${field}.expectedCost`);
  const maximumCost = expense.maximumCost === null && status === 'estimated'
    ? null : money(expense.maximumCost, `${field}.maximumCost`);
  if (minimumCost > expectedCost || (maximumCost !== null && expectedCost > maximumCost) ||
      (status === 'verified' && (minimumCost !== expectedCost || expectedCost !== maximumCost))) {
    throw new BudgetInputError(`${field}.priceRange`);
  }
  return { id, category, quantity, unit: expense.unit, priceStatus: status,
    minimumCost, expectedCost, maximumCost, ...(source ? { source } : {}) };
}

function evaluateBudget(input) {
  object(input, 'budget request');
  if (input.currency !== 'INR') throw new BudgetInputError('currency');
  const budgetAmount = integer(input.budgetAmount, 'budgetAmount', 1, MAX_MONEY);
  if (!['total', 'perPerson'].includes(input.budgetMode)) throw new BudgetInputError('budgetMode');
  const people = integer(input.people, 'people', 1, 50);
  const contingencyPercent = integer(input.contingencyPercent ?? 0, 'contingencyPercent', 0, 100);
  if (!Array.isArray(input.expenses) || input.expenses.length > MAX_EXPENSES) throw new BudgetInputError('expenses');
  const seen = new Set();
  const expenses = input.expenses.map((expense, index) => {
    const item = expenseInput(expense, index);
    if (seen.has(item.id)) throw new BudgetInputError(`expenses[${index}].id`);
    seen.add(item.id);
    return item;
  });

  const totalBudget = toMoney(BigInt(budgetAmount) * BigInt(input.budgetMode === 'perPerson' ? people : 1), 'effectiveTotalBudget');
  // Reserve is rounded up once against the total budget, never per item or person.
  const reserve = toMoney((BigInt(totalBudget) * BigInt(contingencyPercent) + 99n) / 100n, 'contingencyReserve');
  const spendable = toMoney(BigInt(totalBudget) - BigInt(reserve), 'spendableBudget');
  const breakdown = expenses.map((item, index) => {
    const multiplier = BigInt(item.quantity) * BigInt(item.unit === 'person' ? people : 1);
    const scale = (value, field) => value === null ? null : toMoney(BigInt(value) * multiplier, field);
    return { ...item, unitsCharged: toMoney(multiplier, `expenses[${index}].unitsCharged`),
      minimumTotal: scale(item.minimumCost, `expenses[${index}].minimumTotal`),
      expectedTotal: scale(item.expectedCost, `expenses[${index}].expectedTotal`),
      maximumTotal: scale(item.maximumCost, `expenses[${index}].maximumTotal`) };
  });
  const sum = (key) => breakdown.some(item => item[key] === null) ? null :
    toMoney(breakdown.reduce((total, item) => total + BigInt(item[key]), 0n), key);
  const totalMinimumCost = sum('minimumTotal');
  const totalExpectedCost = sum('expectedTotal');
  const totalMaximumCost = sum('maximumTotal');
  const knownMinimumCost = toMoney(breakdown.reduce((total, item) => total + BigInt(item.minimumTotal ?? 0), 0n), 'knownMinimumCost');
  const missingPriceIds = breakdown.filter(item => item.priceStatus === 'unknown').map(item => item.id);
  const unboundedPriceIds = breakdown.filter(item => item.priceStatus !== 'unknown' && item.maximumTotal === null).map(item => item.id);
  const estimatedPriceIds = breakdown.filter(item => item.priceStatus === 'estimated').map(item => item.id);
  let affordability;
  if (knownMinimumCost > spendable) affordability = 'exceeds';
  else if (missingPriceIds.length) affordability = 'cannot_determine';
  else if (totalMaximumCost !== null && totalMaximumCost <= spendable) affordability = 'fits_conservatively';
  else affordability = 'potentially_fits';
  const warnings = [];
  if (missingPriceIds.length) warnings.push({ code: 'MISSING_PRICES', expenseIds: missingPriceIds });
  if (unboundedPriceIds.length) warnings.push({ code: 'UNBOUNDED_ESTIMATES', expenseIds: unboundedPriceIds });
  if (estimatedPriceIds.length) warnings.push({ code: 'ESTIMATED_PRICES', expenseIds: estimatedPriceIds });
  return {
    currency: 'INR', budgetAmount, budgetMode: input.budgetMode, people, contingencyPercent,
    effectiveTotalBudget: totalBudget, effectiveBudgetPerPerson: toMoney(BigInt(totalBudget) / BigInt(people), 'effectiveBudgetPerPerson'),
    perPersonRemainder: toMoney(BigInt(totalBudget) % BigInt(people), 'perPersonRemainder'), contingencyReserve: reserve, spendableBudget: spendable,
    totalMinimumCost, totalExpectedCost, totalMaximumCost,
    remainingBudget: totalExpectedCost === null ? null : toSignedMoney(BigInt(spendable) - BigInt(totalExpectedCost), 'remainingBudget'),
    utilizationBasisPoints: totalExpectedCost === null ? null : toMoney((BigInt(totalExpectedCost) * 10000n) / BigInt(totalBudget), 'utilizationBasisPoints'),
    affordability, breakdown, warnings,
  };
}

module.exports = { evaluateBudget, BudgetInputError };
