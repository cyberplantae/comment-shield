import { afterEach, expect, it, vi } from "vitest";
import { ollamaProvider } from "../classify/providers/ollama";
afterEach(() => vi.unstubAllGlobals());
it("does not accept a different size from the same model family", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({models:[{name:"qwen3:4b"}]})));
 expect((await ollamaProvider.check({model:"qwen3:8b",effort:"low"})).ok).toBe(false);
});
it("requests structured non-thinking Qwen output and validates verdicts", async () => {
 const fetchMock = vi.fn().mockResolvedValue(Response.json({message:{content:JSON.stringify({verdicts:[{id:"a",severity:"benign",confidence:90,categories:[],targetsPhysicalSafety:false,summary:"Friendly greeting"}]})}}));
 vi.stubGlobal("fetch",fetchMock);
 const result = await ollamaProvider.classify({system:"Review",user:"Hello",requestedIds:["a"]},{model:"qwen3:4b",effort:"low"});
 expect(result.get("a")?.severity).toBe("benign");
 const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
 expect(body.think).toBe(false); expect(body.format.type).toBe("object");
});
