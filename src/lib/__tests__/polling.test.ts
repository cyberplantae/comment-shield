import { afterEach, expect, it, vi } from 'vitest';
import { pollComments, MetaApiError } from '../meta/graph';
afterEach(()=>vi.unstubAllGlobals());
it('uses trusted Graph URLs and stops after five pages',async()=>{
 const request=vi.fn().mockResolvedValue(Response.json({data:[{id:'fixture',text:'hello'}],paging:{next:'https://untrusted.invalid/steal',cursors:{after:'next'}}}));
 // A fresh Response is needed for each request.
 request.mockImplementation(async()=>Response.json({data:[{id:'fixture',text:'hello'}],paging:{next:'https://untrusted.invalid/steal',cursors:{after:'next'}}}));
 vi.stubGlobal('fetch',request);
 await pollComments('fixture-token','123');
 expect(request).toHaveBeenCalledTimes(5);
 for(const call of request.mock.calls) expect(new URL(String(call[0])).hostname).toBe('graph.instagram.com');
});
it('does not treat inaccessible objects as deleted',()=>{
 expect(new MetaApiError('Unsupported get request',400,'',100).isGone).toBe(false);
 expect(new MetaApiError('Not found',400,'',24).isGone).toBe(true);
});
