import { beforeEach, afterAll, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({requireOwner: vi.fn()}));
vi.mock("@/lib/crypto", () => ({decryptToken: () => "fixture-token"}));
vi.mock("@/lib/classify", () => ({batchSize: async () => 5, classifyBatch: vi.fn()}));
vi.mock("@/lib/meta/graph", async (original) => ({...await original<object>(),setHidden:vi.fn(),deleteComment:vi.fn(),getComment:vi.fn()}));
vi.mock("@/db", async () => {
 const {PGlite}=await import('@electric-sql/pglite'); const {drizzle}=await import('drizzle-orm/pglite'); const {migrate}=await import('drizzle-orm/pglite/migrator');
 const schema=await import('@/db/schema'); const local=new PGlite(); const db=drizzle(local,{schema}); await migrate(db,{migrationsFolder:'drizzle'});
 return {db,schema,closeDatabase:()=>local.close()};
});
import {db,schema,closeDatabase} from '@/db';
import {classifyBatch} from '@/lib/classify';
import {setHidden} from '@/lib/meta/graph';
import {tick} from '@/worker';
import {POST} from '@/app/api/actions/route';
import {eq} from 'drizzle-orm';
import type {NextRequest} from 'next/server';
let commentId: string;
beforeEach(async()=> {
 vi.clearAllMocks(); vi.stubEnv('SHIELD_DESKTOP','0');
 await db.delete(schema.creators);
 const [creator]=await db.insert(schema.creators).values({displayName:'Fixture'}).returning();
 await db.insert(schema.policies).values({creatorId:creator!.id});
 const [account]=await db.insert(schema.accounts).values({creatorId:creator!.id,platform:'instagram',platformUserId:'fixture-account',accessTokenEnc:'fixture'}).returning();
 const [comment]=await db.insert(schema.comments).values({accountId:account!.id,platformCommentId:'fixture-comment',text:'fixture text',authorUsername:'fixture-author'}).returning();
 commentId=comment!.id;
});
afterAll(async()=>{vi.unstubAllEnvs();await closeDatabase();});
it('preserves a creator keep decision made while classification is running',async()=> {
 let release!:()=>void; let started!:()=>void;
 const began=new Promise<void>(resolve=>{started=resolve;}); const gate=new Promise<void>(resolve=>{release=resolve;});
 vi.mocked(classifyBatch).mockImplementation(async()=>{started();await gate;return new Map([[commentId,{id:commentId,severity:'hateful',confidence:99,categories:['identity_hate'],targetsPhysicalSafety:false,summary:'Possible identity attack'}]]);});
 const worker=tick(); await began;
 const result=await POST(new Request('http://localhost/api/actions',{method:'POST',body:JSON.stringify({commentId,action:'keep'}),headers:{'content-type':'application/json'}}) as NextRequest);
 expect(result.status).toBe(200); release(); await worker;
 const [comment]=await db.select().from(schema.comments).where(eq(schema.comments.id,commentId));
 expect(comment?.disposition).toBe('kept'); expect(setHidden).not.toHaveBeenCalled();
});
it('bounds retries for missing classifier verdicts',async()=> {
 vi.mocked(classifyBatch).mockResolvedValue(new Map());
 for(let i=0;i<6;i++) { await db.update(schema.comments).set({nextAttemptAt:null}).where(eq(schema.comments.id,commentId)); await tick(); }
 const [comment]=await db.select().from(schema.comments).where(eq(schema.comments.id,commentId));
 expect(comment?.attempts).toBe(5); expect(classifyBatch).toHaveBeenCalledTimes(5); expect(setHidden).not.toHaveBeenCalled();
});
