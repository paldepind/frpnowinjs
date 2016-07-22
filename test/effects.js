/* @flow */
import * as assert from "assert";

import "babel-polyfill";

import {of, runEffects, withEffects} from "../effects";
import {Do} from "../monad";

describe("effects", () => {
  it("gives pure computaion", () => {
    return runEffects(of(12)).then((res) => {
      assert.equal(12, res);
    });
  });
  it("chains computations", () => {
    return runEffects(of(3).chain(n => of(n + 4))).then((res) => {
      assert.equal(7, res);
    });
  });
  it("works with do-notation", () => {
    const f1 = withEffects((a) => a * 2);
    const f2 = withEffects((a, b) => a + b);
    const comp = Do(function*() {
      const a = yield of(4);
      const b = yield f1(3);
      const sum = yield f2(a, b);
      return of(sum);
    });
    return runEffects(comp).then((res) => {
      assert.equal(10, res);
    });
  });
});