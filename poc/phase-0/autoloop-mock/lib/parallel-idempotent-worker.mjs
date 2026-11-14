import { parentPort, workerData } from "node:worker_threads";
import { closeBusinessDb, insertBusiness } from "./business-store.mjs";

const { cwd, eventId } = workerData;
for (let i = 0; i < 8; i++) {
  insertBusiness(cwd, { eventId, action: "draft-created", extra: { worker: true } });
}
closeBusinessDb();
parentPort?.postMessage("ok");