///<reference path="../typings/index.d.ts" />
import "babel-polyfill";
import * as assert from "assert";

import {Behavior, runB, apB, never, runE, ofE, async, runNow, Now, plan, zwitch} from "../lib";
import {Just, Nothing} from "../maybe";
import {Do} from "../monad";
import * as Eff from "../effects";
import {withEffects, withEffectsP, runEffects} from "../effects";

describe("Event", () => {
  it("never is cyclic", () => {
    return runEffects(runE(never)).then((e) => {
      e.match({
        left: (e) => assert.equal(never, e),
        right: () => { throw new Error(); }
      });
    });
  });
});

describe("Behavior", () => {
  it("ap works on constant behavior", () => {
    const b1 = Behavior.of((x: number) => x * x);
    const b2 = Behavior.of(12);
    const append = apB(b1, b2);
    return runEffects(runB(append)).then((res) => {
      assert.equal(res.val, 12 * 12);
    });
  });
});

describe("Now", () => {
  it("extremely simple program works", () => {
    const prog = Do(function*() {
      const a = yield Now.of(12);
      return Now.of(ofE(a));
    });
    return runEffects(runNow(prog)).then(res => {
      assert.equal(12, res); // actually 20
    });
  });
  it("quite simple program works", () => {
    const prog = Do(function*() {
      const a = yield async(withEffects((n: number) => n)(12));
      return Now.of(a);
    });
    return runEffects(runNow(prog)).then(res => {
      assert.equal(12, res); // actually 20
    });
  });
  it("chain works", () => {
    const prog = Do(function*() {
      const a = yield Now.of(ofE(12));
      const b = yield Now.of(ofE(8));
      const c = Do(function*() {
        const av = yield a;
        const bv = yield b;
        return a.of(av + bv);
      });
      return Now.of(c);
    });
    return runEffects(runNow(prog)).then(res => {
      assert.equal(20, res); // actually 20
    });
  });
  it("async works", () => {
    const prog = Do(function*() {
      const a = yield Now.of(ofE(12));
      const b = yield async(withEffects((n: number) => n * 2)(4));
      const c = Do(function*() {
        const av = yield a;
        const bv = yield b;
        return a.of(av + bv);
      });
      return Now.of(c);
    });
    return runEffects(runNow(prog)).then(res => {
      assert.equal(20, res); // actually 20
    });
  });
  it("finishes when IO performed with async is done", (cb) => {
    let resolve: (n: boolean) => void;
    let done = false;
    const fn = withEffectsP(() => {
      return new Promise((res) => {
        resolve = res;
      });
    });
    const prog = Do(function*(): Iterator<Now<any>> {
      return async(fn());
    });
    runEffects(runNow(prog)).then((res: boolean) => {
      done = res;
    });
    setTimeout(() => {
      assert.strictEqual(done, false);
      resolve(true);
      setTimeout(() => {
        assert.strictEqual(done, true);
        cb();
      });
    });
  });
});

describe("maybe", () => {
  it("gives just on `of`", () => {
    const j = Just(12);
    assert.deepEqual(j, j.of(12));
  });
  it("gives nothing when bound to nothing", () => {
    const j = Just(12);
    const n = Nothing();
    assert.deepEqual(j.chain(_ => Nothing()), n);
    assert.deepEqual(n.chain<number>(_ => Just(12)), n);
  });
  it("passes values through", () => {
    const res = Do(function*() {
      const a = yield Just(1);
      const b = yield Just(3);
      const c = yield Just(2);
      return Just(a + b + c);
    });
    assert.deepEqual(res, Just(6));
  });
  it("bails on nothing", () => {
    const res = Do(function*() {
      const a = yield Just(1);
      const b = yield Nothing();
      const c = yield Just(2);
      return Just(a + b + c);
    });
    assert.deepEqual(res, Nothing());
  });
});
