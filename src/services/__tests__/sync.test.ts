import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureSyncOwner, enqueueSyncItem, getSyncQueue, syncQueue, clearSyncQueue, registerSyncHandler } from "../sync";
import { upsertFieldEventFromQueueItem } from "../fieldEventSync";
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
let raw: string;
let owner: string | null;
const get = AsyncStorage.getItem as jest.Mock;
const set = AsyncStorage.setItem as jest.Mock;
beforeEach(() => {
 raw = "[]"; owner = "A";
 get.mockReset().mockImplementation(async () => raw);
 set.mockReset().mockImplementation(async (_key, value) => { raw = value; });
 configureSyncOwner(async () => owner);
});
test("concurrent enqueue preserves all items", async () => {
 await Promise.all(Array.from({ length: 20 }, (_, n) => enqueueSyncItem("race", { n })));
 expect((await getSyncQueue()).map(x => (x.payload as {n:number}).n).sort((a,b)=>a-b)).toEqual(Array.from({length:20},(_,n)=>n));
});
test("enqueue while flushing is retained; concurrent flush sends once", async () => {
 let unblock!: () => void; let started!: () => void;
 const gate = new Promise<void>(r => { unblock = r; });
 const entered = new Promise<void>(r => { started = r; });
 const handler = jest.fn(async () => { started(); await gate; });
 registerSyncHandler("slow", handler);
 await enqueueSyncItem("slow", { n: 1 });
 const first = syncQueue(); const second = syncQueue();
 expect(second).toBe(first);
 await entered;
 await enqueueSyncItem("slow", { n: 2 });
 unblock(); await first;
 expect(handler).toHaveBeenCalledTimes(1);
 expect((await getSyncQueue()).map(x => x.payload)).toEqual([{ n: 2 }]);
});
test("account switch and legacy records never reassign ownership", async () => {
 raw = JSON.stringify([{ id:"legacy", type:"owners", payload:{private:true}, createdAt:"old" }]);
 const handler = jest.fn(async () => {});
 registerSyncHandler("owners", handler);
 await enqueueSyncItem("owners", { a:1 }); owner = "B";
 expect(await getSyncQueue()).toEqual([]);
 await syncQueue(); await clearSyncQueue();
 expect(handler).not.toHaveBeenCalled();
 expect(JSON.parse(raw)).toHaveLength(2);
 owner = "A"; await syncQueue();
 expect(handler.mock.calls).toHaveLength(1);
 expect(JSON.parse(raw).map((x: {id:string})=>x.id)).toEqual(["legacy"]);
});
test("failed handler retains stable id until successful retry", async () => {
 await enqueueSyncItem("retry", {});
 const id = (await getSyncQueue())[0].id;
 registerSyncHandler("retry", async () => { throw Error("offline"); });
 expect((await syncQueue()).pending).toBe(1);
 registerSyncHandler("retry", async item => { expect(item.id).toBe(id); });
 expect((await syncQueue()).processed).toBe(1);
});
test("write failure rejects enqueue and preserves previous data", async () => {
 await enqueueSyncItem("disk", { n:1 }); const before = raw;
 set.mockRejectedValueOnce(Error("full"));
 await expect(enqueueSyncItem("disk", { n:2 })).rejects.toThrow("full");
 expect(raw).toBe(before);
});
test("corrupt storage is not replaced with empty queue", async () => {
 raw = "broken";
 await expect(enqueueSyncItem("disk", {})).rejects.toThrow();
 expect(raw).toBe("broken"); expect((await syncQueue()).ok).toBe(false);
});
test("unauthenticated enqueue fails and cross-owner upsert never reaches DB", async () => {
 owner = null; await expect(enqueueSyncItem("x", {})).rejects.toThrow("conta");
 const from = jest.fn();
 await expect(upsertFieldEventFromQueueItem({ from } as any, { id:"x", ownerId:"A", type:"reportA", payload:{}, createdAt:"now" }, "B")).rejects.toThrow("Autor");
 expect(from).not.toHaveBeenCalled();
});
