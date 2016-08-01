///<reference path="../typings/index.d.ts" />
import "babel-polyfill";
import * as assert from "assert";

import {never, runE, ofE, async, runNow, Now} from "../lib";
import {Just, Nothing} from "../maybe";
import {Do} from "../monad";
import {withEffects, runEffects} from "../effects";

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
