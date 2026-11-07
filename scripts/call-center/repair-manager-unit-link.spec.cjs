const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchUnit } = require('./repair-manager-unit-link.cjs');
const employee = {
  status: 'فعال',
  grade: 'مدیر',
  branchId: 'a',
  unit: 'HR',
  deletedAt: null,
};
const unit = { id: 'unit', branchId: 'a', name: 'HR' };
test('matches an active manager to exactly one authorized native unit', () => {
  assert.equal(matchUnit(employee, [unit, { ...unit, branchId: 'b' }]), unit);
});
test('rejects ordinary staff, ambiguous units, inactive managers and foreign branches', () => {
  for (const [person, units] of [
    [{ ...employee, grade: 'کارشناس' }, [unit]],
    [employee, [unit, unit]],
    [{ ...employee, deletedAt: new Date() }, [unit]],
    [employee, [{ ...unit, branchId: 'b' }]],
    [{ ...employee, status: 'غیرفعال' }, [unit]],
  ])
    assert.throws(() => matchUnit(person, units));
});
