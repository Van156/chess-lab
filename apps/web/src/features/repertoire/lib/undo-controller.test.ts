import { describe, expect, test } from "bun:test";

import { createUndoController, type UndoEntry, type UndoPorts } from "./undo-controller";

type Snapshot = { name: string };

const deferred = () => {
  let resolve: () => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const conflict = Object.assign(new Error("conflict"), {
  code: "CONFLICT",
  status: 409,
  data: { reason: "edge_exists" },
});
const outage = Object.assign(new Error("down"), { code: "INTERNAL_SERVER_ERROR", status: 500 });

const landed = { restoredToPositionId: "landed" };

function setup(restore: UndoPorts<Snapshot>["restore"] = async () => landed) {
  const log: string[] = [];
  const restored: UndoEntry<Snapshot>[] = [];
  const positions: string[] = [];
  const controller = createUndoController<Snapshot>({
    restore: (snapshot) => {
      log.push(`restore ${snapshot.name}`);
      return restore(snapshot);
    },
    onRestored: (entry, positionId) => {
      restored.push(entry);
      positions.push(positionId);
    },
    notify: {
      deleted: (entry) => void log.push(`deleted ${entry.label}`),
      restored: (entry) => void log.push(`restored ${entry.label}`),
      failed: (message) => void log.push(`failed ${message}`),
      dismiss: (id) => void log.push(`dismiss ${id}`),
    },
  });
  const record = (name: string) =>
    controller.record({
      snapshot: { name },
      label: name,
      returnTo: { positionId: `p-${name}`, route: [name] },
    });
  return { controller, log, restored, positions, record };
}

describe("createUndoController", () => {
  test("announces each recorded deletion", () => {
    const { log, record } = setup();
    record("e4");
    expect(log).toEqual(["deleted e4"]);
  });

  test("undo restores the newest entry, then the one before it", async () => {
    const { controller, log, restored, record } = setup();
    record("e4");
    record("d4");
    expect(controller.undo()).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.undo()).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(log.filter((line) => line.startsWith("restore "))).toEqual(["restore d4", "restore e4"]);
    expect(restored.map((entry) => entry.label)).toEqual(["d4", "e4"]);
    expect(controller.size()).toBe(0);
  });

  test("undo with nothing recorded does nothing", () => {
    const { controller, log } = setup();
    expect(controller.undo()).toBe(false);
    expect(log).toEqual([]);
  });

  test("undo by id restores that entry and keeps the others", async () => {
    const { controller, restored, record } = setup();
    record("e4");
    record("d4");
    record("c4");
    const [first] = controller.entries();
    expect(controller.undo(first?.id)).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(restored.map((entry) => entry.label)).toEqual(["e4"]);
    expect(controller.entries().map((entry) => entry.label)).toEqual(["d4", "c4"]);
  });

  test("undo by an unknown id does nothing", () => {
    const { controller, record } = setup();
    record("e4");
    expect(controller.undo("nope")).toBe(false);
  });

  test("ignores undo while a restore is pending, so there are no double restores", async () => {
    const gate = deferred();
    const { controller, log, record } = setup(() => gate.promise.then(() => landed));
    record("e4");
    record("d4");
    expect(controller.undo()).toBe(true);
    expect(controller.undo()).toBe(false);
    expect(log.filter((line) => line.startsWith("restore "))).toEqual(["restore d4"]);
    gate.resolve();
    await gate.promise;
    await Promise.resolve();
    expect(controller.undo()).toBe(true);
  });

  test("a final failure drops the entry, dismisses its toast and says why", async () => {
    const { controller, log, record } = setup(async () => Promise.reject(conflict));
    record("e4");
    const [entry] = controller.entries();
    controller.undo();
    await new Promise((done) => setTimeout(done, 0));
    expect(controller.size()).toBe(0);
    expect(log).toContain(`dismiss ${entry?.id}`);
    expect(log.at(-1)).toBe("failed Can't undo: that move was added again.");
  });

  test("a transient failure keeps the entry so it can be tried again", async () => {
    let calls = 0;
    const { controller, log, restored, record } = setup(async () => {
      if (calls++ === 0) throw outage;
      return landed;
    });
    record("e4");
    controller.undo();
    await new Promise((done) => setTimeout(done, 0));
    expect(controller.size()).toBe(1);
    expect(log.at(-1)).toBe("failed Couldn't undo. Try again.");
    expect(controller.undo()).toBe(true);
    await new Promise((done) => setTimeout(done, 0));
    expect(controller.size()).toBe(0);
    expect(restored.map((entry) => entry.label)).toEqual(["e4"]);
  });

  test("navigates to the position the server says the move landed on", async () => {
    const { controller, positions, record } = setup(async () => ({
      restoredToPositionId: "remapped",
    }));
    record("e4");
    controller.undo();
    await new Promise((done) => setTimeout(done, 0));
    expect(positions).toEqual(["remapped"]);
  });

  test("a retry that finds the move already restored counts as restored", async () => {
    const moveExists = Object.assign(new Error("exists"), {
      code: "CONFLICT",
      status: 409,
      data: { reason: "move_exists" },
    });
    let calls = 0;
    const { controller, log, positions, record } = setup(async () => {
      if (calls++ === 0) throw outage;
      throw moveExists;
    });
    record("e4");
    controller.undo();
    await new Promise((done) => setTimeout(done, 0));
    controller.undo();
    await new Promise((done) => setTimeout(done, 0));
    expect(controller.size()).toBe(0);
    expect(log.at(-1)).toBe("restored e4");
    expect(positions).toEqual(["p-e4"]);
  });

  test("move_exists on a first attempt is a real conflict", async () => {
    const moveExists = Object.assign(new Error("exists"), {
      code: "CONFLICT",
      status: 409,
      data: { reason: "move_exists" },
    });
    const { controller, log, record } = setup(async () => Promise.reject(moveExists));
    record("e4");
    controller.undo();
    await new Promise((done) => setTimeout(done, 0));
    expect(controller.size()).toBe(0);
    expect(log.at(-1)).toBe("failed Can't undo: that move already exists.");
  });

  test("a restored entry dismisses its toast and announces the restore", async () => {
    const { controller, log, record } = setup();
    record("e4");
    const [entry] = controller.entries();
    controller.undo();
    await new Promise((done) => setTimeout(done, 0));
    expect(log).toContain(`dismiss ${entry?.id}`);
    expect(log.at(-1)).toBe("restored e4");
  });

  test("clear forgets everything and ignores a restore still in flight", async () => {
    const gate = deferred();
    const { controller, restored, record } = setup(() => gate.promise.then(() => landed));
    record("e4");
    controller.undo();
    controller.clear();
    gate.resolve();
    await new Promise((done) => setTimeout(done, 0));
    expect(controller.size()).toBe(0);
    expect(restored).toEqual([]);
    record("d4");
    expect(controller.undo()).toBe(true);
  });
});
