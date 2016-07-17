/* @flow */
import "babel-polyfill";

import * as assert from "assert";
import {never, runE} from "../lib";
import {Just, Nothing} from "../maybe";
import {Do} from "../monad";

describe("library", () => {
  it("never is cyclic", () => {
    runE(never).match({
      left: (e) => assert.equal(never, e),
      right: () => { throw new Error(); }
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
    assert.deepEqual(n.chain(_ => Just(12)), n);
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