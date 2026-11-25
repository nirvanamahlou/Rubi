import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const isSensitive = (ref) =>
  /^(finance-delivery|petty-cash|system-management)\//u.test(ref) ||
  /\/(?:permissions|credit|settlement|revoke|leave-approval|request-status|duplicate|passport|delivery-exception)$/u.test(
    ref,
  );

/** Score redacted observations by release, role, company scope and guide module. */
export function gradeRoleGuides(cases, receipts, release, scope = 'both') {
  if (!/^[a-f\d]{40}$/u.test(release))
    throw new Error('Expected Git commit SHA');
  const targets = new Map(cases.map((entry) => [entry.id, entry]));
  if (!targets.size || targets.size !== cases.length)
    throw new Error('Missing or duplicate expected case');
  if (!['admin-all-companies', 'employee', 'both'].includes(scope)) throw new Error('Unexpected acceptance scope');
  const allowedRuns = new Set(scope === 'both' ? ['admin-all-companies', 'employee'] : [scope]);
  const observed = new Map();
  for (const receipt of receipts) {
    const target = targets.get(receipt.caseId);
    if (!target || !allowedRuns.has(receipt.run) || receipt.release !== release)
      throw new Error('Unexpected case, run or release');
    if (
      receipt.actorRole !==
      (receipt.run === 'employee' ? target.role : 'مدیر سامانه')
    )
      throw new Error('Wrong role ' + receipt.caseId);
    if (
      receipt.company !== 'all' &&
      !(receipt.run === 'employee' && receipt.company === 'restricted')
    )
      throw new Error('Wrong company scope ' + receipt.caseId);
    const id = receipt.run + '/' + target.id;
    if (observed.has(id)) throw new Error('Duplicate receipt ' + id);
    if (
      !Array.isArray(receipt.guideRefs) ||
      !receipt.guideRefs.every((s) => typeof s === 'string')
    )
      throw new Error('Invalid guide references ' + id);
    if (
      !['permitted', 'denied'].includes(receipt.panelAccess) ||
      (receipt.run === 'admin-all-companies' &&
        receipt.panelAccess === 'denied')
    )
      throw new Error('Invalid panel permission ' + id);
    observed.set(id, receipt);
  }
  const modules = new Map();
  const blocking = [];
  for (const target of cases) {
    for (const run of allowedRuns) {
      const id = run + '/' + target.id;
      const r = observed.get(id);
      const denied = r?.panelAccess === 'denied';
      const matched =
        !!r &&
        r.panelCompared === true &&
        r.exposure === false &&
        (denied
          ? r.outcome === 'denied' && r.guideRefs.length === 0
          : r.outcome === 'answer' &&
            r.stepsMatchPanel === true &&
            target.expectedGuides.every((ref) => r.guideRefs.includes(ref)));
      if (
        !matched &&
        (!r ||
          r.exposure !== false ||
          denied ||
          target.expectedGuides.some(isSensitive))
      )
        blocking.push(id);
      for (const module of new Set(
        target.expectedGuides.map((ref) => ref.split('/')[0]),
      )) {
        const key = run + '/' + module;
        const tally = modules.get(key) ?? { passed: 0, total: 0 };
        tally.total++;
        if (matched) tally.passed++;
        modules.set(key, tally);
      }
    }
  }
  const perModule = Object.fromEntries(modules);
  const pass =
    !blocking.length &&
    [...modules.values()].every(
      ({ passed, total }) => passed * 100 >= 95 * total,
    );
  return {
    pass,
    expected: targets.size * allowedRuns.size,
    received: observed.size,
    perModule,
    blocking,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [release, file, scope = 'admin-all-companies'] = process.argv.slice(2);
  if (!file || !release)
    throw new Error(
      'Usage: node grade-role-guides.mjs <release-SHA> <redacted-receipts.jsonl>',
    );
  function lines(path) {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((v) => JSON.parse(v));
  }
  const result = gradeRoleGuides(
    lines('docs/assistant/role-guide-acceptance.jsonl'),
    lines(file),
    release, scope,
  );
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
}
