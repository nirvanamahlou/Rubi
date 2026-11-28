import { it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeRoleGuides } from './grade-role-guides.mjs';

const release = 'c'.repeat(40);
const cases = [
  {
    id: 'one',
    role: 'کارشناس فروش',
    expectedGuides: ['sales/create', 'sales/review'],
  },
];
const receipts = ['admin-all-companies', 'employee'].map((run) => ({
  release,
  caseId: 'one',
  run,
  actorRole: run === 'employee' ? 'کارشناس فروش' : 'مدیر سامانه',
  company: run === 'employee' ? 'restricted' : 'all',
  panelCompared: true,
  panelAccess: 'permitted',
  exposure: false,
  outcome: 'answer',
  stepsMatchPanel: true,
  guideRefs: ['sales/create', 'sales/review'],
}));

it('requires the full reference set and independent panel comparison in both scopes', () => {
  assert.equal(gradeRoleGuides(cases, receipts, release).pass, true);
  for (const change of [
    { guideRefs: ['sales/create'] },
    { stepsMatchPanel: false },
    { panelCompared: false },
    { exposure: true },
  ]) {
    assert.equal(
      gradeRoleGuides(
        cases,
        [receipts[0], { ...receipts[1], ...change }],
        release,
      ).pass,
      false,
    );
  }
  assert.equal(
    gradeRoleGuides(cases, receipts.slice(0, 1), release).pass,
    false,
  );
});
it('compares explicit native denial without treating the job title as a grant', () => {
  const denied = {
    ...receipts[1],
    panelAccess: 'denied',
    outcome: 'denied',
    guideRefs: [],
  };
  assert.equal(
    gradeRoleGuides(cases, [receipts[0], denied], release).pass,
    true,
  );
  assert.equal(
    gradeRoleGuides(
      cases,
      [receipts[0], { ...denied, guideRefs: ['sales/create'] }],
      release,
    ).pass,
    false,
  );
});
it('rejects reused receipts from another release, role or scope', () => {
  for (const change of [
    { release: 'd'.repeat(40) },
    { actorRole: 'مدیر فروش' },
    { company: 'unit' },
  ]) {
    assert.throws(() =>
      gradeRoleGuides(
        cases,
        [receipts[0], { ...receipts[1], ...change }],
        release,
      ),
    );
  }
  assert.throws(() =>
    gradeRoleGuides(cases, [...receipts, receipts[0]], release),
  );
});
