import {beforeEach,describe,it,expect,vi} from 'vitest';
import {GET} from '../../../app/sales/contracts/[id]/pdf/route';
import {printFixture} from './contract-print.fixture';
const mocks=vi.hoisted(()=>({render:vi.fn(),fetch:vi.fn()}));
vi.mock('../server/contract-pdf',()=>({renderContractPdf:mocks.render}));
vi.mock('@/lib/environment',()=>({getPublicApiBaseUrl:()=> 'http://api.test/api/v1'}));
vi.mock('node:fs/promises',()=>({readFile:async()=>Buffer.from('logo')}));
const id='10000000-0000-4000-8000-000000000001';
describe('Saved contract PDF download route',()=>{
 beforeEach(()=>{vi.stubGlobal('fetch',mocks.fetch);mocks.fetch.mockReset();mocks.render.mockReset();});
 it('rejects invalid ids before upstream or renderer access',async()=>{const r=await GET(new Request('http://web.test'),{params:Promise.resolve({id:'../other'})});expect(r.status).toBe(400);expect(mocks.fetch).not.toHaveBeenCalled();});
 it('retains upstream permission rejection and never renders',async()=>{mocks.fetch.mockResolvedValue(new Response('',{status:403}));const r=await GET(new Request('http://web.test'),{params:Promise.resolve({id})});expect(r.status).toBe(403);expect(mocks.render).not.toHaveBeenCalled();});
 it('downloads actual bytes with private attachment headers from saved output',async()=>{
  mocks.fetch.mockImplementation(async(url:string)=>url.includes('/sales/')?Response.json({data:printFixture}):new Response('',{status:403}));
  mocks.render.mockResolvedValue(Buffer.from('%PDF-test'));
  const r=await GET(new Request('http://web.test',{headers:{cookie:'rubi_access=test-session'}}),{params:Promise.resolve({id})});
  expect(r.status).toBe(200);expect(r.headers.get('content-type')).toBe('application/pdf');expect(r.headers.get('content-disposition')).toContain('attachment;');expect(r.headers.get('cache-control')).toContain('no-store');expect(await r.text()).toBe('%PDF-test');
  expect(mocks.render.mock.calls[0]?.[0]).toEqual(printFixture);
  expect(mocks.fetch.mock.calls[0]?.[1].headers.cookie).toBe('rubi_access=test-session');
 });
 it('reports unavailable renderer without leaking internal errors',async()=>{mocks.fetch.mockImplementation(async(url:string)=>url.includes('/sales/')?Response.json({data:printFixture}):new Response('',{status:403}));mocks.render.mockRejectedValue(new Error('internal-path-secret'));const r=await GET(new Request('http://web.test'),{params:Promise.resolve({id})});expect(r.status).toBe(503);expect(await r.text()).not.toContain('internal-path-secret');});
});
