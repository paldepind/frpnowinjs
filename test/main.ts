///<reference path="../typings/index.d.ts" />
import "babel-polyfill";
import * as assert from "assert";

import {
  Behavior, E, runB, apB, B, never, runE, ofE, async, runNow,
  Now, plan, switcher, whenJust, when, sample
} from "../lib";
import {just, nothing} from "../maybe";
import {Do} from "../monad";
import * as Eff from "../effects";
import {Effects, withEffects, withEffectsP, runEffects} from "../effects";

describe("Event", () => {
  it("never is cyclic", () => {
    return runEffects(runE(never)).then((e) => {
      e.match({
        left: (e) => assert.equal(never, e),
        right: () => { throw new Error(); }
      });
    });
  });
  it("maps", () => {
    const prog = Do(function*() {
      const e = yield Now.of(ofE(12));
      return Now.of(e.map((x: number) => x * 2));
    });
    return runEffects(runNow(prog)).then(res => {
      assert.equal(24, res);
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
  it("map works on constant behavior", () => {
    const b = Behavior.of(12);
    const b2 = b.map((n) => n * 2);
    return runEffects(runB(b2)).then((res) => {
      assert.equal(res.val, 24);
    });
  });
  it("can sample constant behavior", () => {
    const prog = Do(function*() {
      const b = Behavior.of(18);
      const n = yield sample(b);
      return Now.of(ofE(n));
    });
    return runEffects(runNow(prog)).then((res) => {
      assert.strictEqual(res, 18);
    });
  });
  it("can whenJust a constant Just behavior", () => {
    const prog = Do(function*() {
      const b = Behavior.of(just(77));
      const ev = yield sample(whenJust(b));
      return Now.of(ev);
    });
    return runEffects(runNow(prog)).then((res) => {
      assert.strictEqual(res, 77);
    });
  });
  it("can whenJust a constant Nothing behavior", () => {
    const prog = Do(function*() {
      const b = Behavior.of(nothing());
      const ev = yield sample(whenJust(b));
      console.log("OMOMOMOMOMOME");
      return Now.of(ofE(8));
    });
    return runEffects(runNow(prog)).then((res) => {
      assert.strictEqual(res, 8);
    });
  });
  it("behavior switches to event of behavior", () => {
    let resolve: (b: Behavior<boolean>) => void;
    function getTrueBeh(): Effects<Behavior<number>> {
      return withEffectsP(() => {
        return new Promise((res) => {
          resolve = res;
        });
      })();
    }
    const prog1 = Do(function*() {
      const ev = yield async(getTrueBeh());
      const b = switcher(Behavior.of(false), ev);
      console.log("######## pre endE");
      const endE = yield sample(when(b));
      console.log("######## post endE", endE);
      return Now.of(endE.map((_: boolean) => 4));
    });
    setTimeout(() => {
      console.log("resolving");
      resolve(Behavior.of(true));
    });
    return runEffects(runNow(prog1)).then((res) => {
      console.log("Res", res);
      assert.strictEqual(res, 4);
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
  it("async event can be mapped", () => {
    let resolve: (n: number) => void;
    function getNextNr(): Effects<number> {
      return withEffectsP(() => {
        return new Promise((res) => {
          resolve = res;
        });
      })();
    }
    function loop(n: number): Now<E<number>> {
      console.log(n);
      return Do(function*() {
        const e = yield async(getNextNr());
        const e2 = e.map((x: any) => {
          console.log("xx", x);
          return 7;
        });
        console.log("pos map");
        return Now.of(e2);
      });
    }
    setTimeout(() => {
      resolve(6);
    });
    console.log("running main");
    return runEffects(runNow(loop(0))).then((result) => {
      console.log("Finished with result", result);
    });
  });
  // it("complex example works", () => {
  //   function loop(i: number) {
  //     return Do(function* () {
  //       const e = yield async(Eff.of({}));
  //       const e1 = plan(e.map((_: any) => loop(i + 1)));
  //       return Now.of(switcher(ofE(i), e1));
  //     });
  //   }
  //   const count = Do(function* () {
  //     const b: Behavior<numre> = yield loop(0);
  //     const e1 = sample(when(b.map((n: number) => n === 10)));
  //   })
  // });
});

describe("maybe", () => {
  it("gives just on `of`", () => {
    const j = just(12);
    assert.deepEqual(j, j.of(12));
  });
  it("gives nothing when bound to nothing", () => {
    const j = just(12);
    const n = nothing();
    assert.deepEqual(j.chain(_ => nothing()), n);
    assert.deepEqual(n.chain<number>(_ => just(12)), n);
  });
  it("passes values through", () => {
    const res = Do(function*() {
      const a = yield just(1);
      const b = yield just(3);
      const c = yield just(2);
      return just(a + b + c);
    });
    assert.deepEqual(res, just(6));
  });
  it("bails on nothing", () => {
    const res = Do(function*() {
      const a = yield just(1);
      const b = yield nothing();
      const c = yield just(2);
      return just(a + b + c);
    });
    assert.deepEqual(res, nothing());
  });
});
