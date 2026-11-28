import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { SalesContractPagination } from './sales-workspace';
import styles from './sales-report-pagination.module.css';

const chromium = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  process.env.ProgramFiles &&
    join(
      process.env.ProgramFiles,
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
].find((path): path is string => !!path && existsSync(path));

it.skipIf(!chromium)(
  'keeps both period paging links pointer-accessible beside the dock at 319×678 and desktop, RTL and LTR',
  () => {
    const markup = renderToStaticMarkup(
      <SalesContractPagination
        query={{ page: 2, salesPeriodAsOf: '2026-11-25T20:52:11.545Z' }}
        total={32}
        onPage={() => {}}
      />,
    );
    const cssRoot = resolve('src/modules');
    const pagerCss = readFileSync(
      join(cssRoot, 'sales/components/sales-report-pagination.module.css'),
      'utf8',
    ).replaceAll('.periodPager', '.' + styles.periodPager);
    const launcherCss = readFileSync(
      join(cssRoot, 'assistant/floating-assistant.module.css'),
      'utf8',
    );
    const profile = mkdtempSync(join(tmpdir(), 'nora-sales-pager-'));
    try {
      const documentPath = join(profile, 'layout.html');
      // Each frame has its own exact CSS viewport, including widths below Chrome's minimum window size.
      const body = `<style>
      * {box-sizing:border-box} body {margin:0}
      main {position:absolute;inset-inline:0;bottom:20px}
      nav {display:flex;justify-content:space-between;align-items:center}
      nav a {display:grid;place-items:center;min-inline-size:93px;min-block-size:40px}
      ${pagerCss}${launcherCss}
      </style><main>${markup}</main><div class="widget"><button class="launcher">Chat</button></div>`;
      writeFileSync(
        documentPath,
        `<!doctype html><body><output></output><script>
      const checks=[];
      for (const [w,h] of [[319,678],[1280,800]]) for (const dir of ['rtl','ltr']) {
        const frame=document.createElement('iframe');
        frame.style.cssText='width:'+w+'px;height:'+h+'px;border:0';
        document.body.append(frame);
        const d=frame.contentDocument;
        d.open();d.write('<!doctype html><html dir="'+dir+'"><body>'+ ${JSON.stringify(body)} +'</body></html>');d.close();
        d.querySelector('.widget').dir=dir;
        const nav=d.querySelector('nav');
        const dock=d.querySelector('.launcher').getBoundingClientRect();
        const hit=link=>{
          const r=link.getBoundingClientRect();
          const point=d.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return {target:link.contains(point),hitDock:Boolean(point?.closest('.launcher')),visible:r.left>=0&&r.right<=w,clear:r.right<=dock.left||r.left>=dock.right};
        };
        const links=[...nav.querySelectorAll('a')];
        const fixed=links.map(hit);
        nav.removeAttribute('class');
        const uncovered=links.map(hit);
        checks.push({w,h,dir,links:links.length,fixed:fixed.every(x=>x.target&&x.visible&&x.clear),
          reproduced:uncovered.some(x=>x.hitDock&&!x.target&&!x.clear),actualWidth:frame.contentWindow.innerWidth});
        frame.remove();
      }
      document.querySelector('output').textContent=JSON.stringify(checks);
      </script>`,
      );
      const html = execFileSync(
        chromium!,
        [
          '--headless',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-sync',
          '--dump-dom',
          '--user-data-dir=' + join(profile, 'browser'),
          pathToFileURL(documentPath).href,
        ],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 30_000,
          maxBuffer: 2_000_000,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      const checks = JSON.parse(
        /<output>(\[[^<]+\])<\/output>/.exec(html)?.[1] ?? '[]',
      );
      expect(checks).toHaveLength(4);
      for (const check of checks) {
        expect(check, JSON.stringify(check)).toMatchObject({
          actualWidth: check.w,
          links: 2,
          fixed: true,
          reproduced: true,
        });
      }
    } finally {
      rmSync(profile, {
        recursive: true,
        force: true,
        maxRetries: 4,
        retryDelay: 150,
      });
    }
  },
  40_000,
);
