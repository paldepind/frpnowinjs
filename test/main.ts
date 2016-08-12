import * as assert from "assert";

import {
  Behavior, E, runB, apB, B, never, runE, ofE, async, runNow,
  Now, plan, switcher, whenJust, when, sample, // change
} from "../lib";
import {just, nothing} from "../../jabz/src/maybe";
import {Do} from "../monad";
import {IO, withEffects, withEffectsP, runIO} from "../../jabz/src/io";

describe("Event", () => {
  it("never is cyclic", () => {
    return runIO(runE(never)).then((e) => {
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
    return runIO(runNow(prog)).then(res => {
      assert.equal(24, res);
    });
  });
});

describe("Behavior", () => {
  it("ap works on constant behavior", () => {
    const b1 = Behavior.of((x: number) => x * x);
    const b2 = Behavior.of(12);
    const append = apB(b1, b2);
    return runIO(runB(append)).then((res) => {
      assert.equal(res.cur, 12 * 12);
    });
  });
  it("map works on constant behavior", () => {
    const b = Behavior.of(12);
    const b2 = b.map((n) => n * 2);
    return runIO(runB(b2)).then((res) => {
      assert.equal(res.cur, 24);
    });
  });
  describe("Monad instance", () => {
    it("correctly chains constant behavior", () => {
      const prog = Do(function*() {
        const b = Behavior.of(12).chain((n) => Behavior.of(n * 3));
        const val = yield sample(b);
        return Now.of(ofE(val));
      });
      return runIO(runNow(prog)).then((res) => {
        assert.equal(res, 36);
      });
    });
    it("correctly flattens nested constant behavior", () => {
      const prog = Do(function*() {
        const b = Behavior.flatten(Behavior.of(Behavior.of(7)));
        const val = yield sample(b);
        return Now.of(ofE(val));
      });
      return runIO(runNow(prog)).then((res) => {
        assert.equal(res, 7);
      });
    });
    it("correctly chains changing behavior", () => {
      let resolve: (n: number) => void;
      function getNr(): IO<number> {
        return withEffectsP(() => {
          return new Promise((res) => {
            resolve = res;
          });
        })();
      }
      function changingBehavior(n: number): Now<Behavior<number>> {
        return Do(function*() {
          const e = yield async(getNr());
          return Now.of(switcher(Behavior.of(n), e.map(Behavior.of)));
        });
      }
      function main(): Now<E<number>> {
        return Do(function*() {
          const b1: Behavior<number> = yield changingBehavior(1);
          const b2 = b1.chain((n) => {
            return Behavior.of(n * 3);
          });
          const val = yield sample(b2);
          assert.equal(val, 3);
          const e = yield sample(when(b2.map((n: number) => n === 6)));
          return Now.of(e);
        });
      }
      setTimeout(() => {
        resolve(2);
      });
      return runIO(runNow(main())).then((res) => {
        assert.deepEqual(res, {});
      });
    });
  });
  it("can sample constant behavior", () => {
    const prog = Do(function*() {
      const b = Behavior.of(18);
      const n = yield sample(b);
      return Now.of(ofE(n));
    });
    return runIO(runNow(prog)).then((res) => {
      assert.strictEqual(res, 18);
    });
  });
  it("can whenJust a constant Just behavior", () => {
    const prog = Do(function*() {
      const b = Behavior.of(just(77));
      const ev = yield sample(whenJust(b));
      return Now.of(ev);
    });
    return runIO(runNow(prog)).then((res) => {
      assert.strictEqual(res, 77);
    });
  });
  it("can whenJust a constant Nothing behavior", () => {
    const prog = Do(function*() {
      const b = Behavior.of(nothing());
      const _ = yield sample(whenJust(b));
      return Now.of(ofE(8));
    });
    return runIO(runNow(prog)).then((res) => {
      assert.strictEqual(res, 8);
    });
  });
  it("behavior switches to event of behavior", () => {
    let resolve: (b: Behavior<boolean>) => void;
    function getTrueBeh(): IO<Behavior<number>> {
      return withEffectsP(() => {
        return new Promise((res) => {
          resolve = res;
        });
      })();
    }
    const prog = Do(function*() {
      const ev = yield async(getTrueBeh());
      const b = switcher(Behavior.of(false), ev);
      const endE = yield sample(when(b));
      return Now.of(endE.map((_: boolean) => 4));
    });
    setTimeout(() => {
      resolve(Behavior.of(true));
    });
    return runIO(runNow(prog)).then((res) => {
      assert.strictEqual(res, 4);
    });
  });
  it("samples when correctly", () => {
    let resolves: ((n: number) => void)[] = [];
    function getNextNr(idx: number): IO<number> {
      return withEffectsP(() => {
        return new Promise((res) => {
          resolves[idx] = res;
        });
      })();
    }
    function bNrInNow() {
      return Now.of(Behavior.of(true));
    }
    function main(): Now<E<{}>> {
      return Do(function*() {
        const e1: E<number> = yield async(getNextNr(0));
        const e2: E<number> = yield async(getNextNr(1));
        const e3: E<number> = yield async(getNextNr(2));
        const ne = e1.chain(_ => e2.chain(_ => e3.map(bNrInNow)));
        const e4 = yield plan(ne);
        const b = switcher(Behavior.of(false), e4);
        const e = yield sample(when(b));
        return Now.of(e);
      });
    }
    setTimeout(() => {
      resolves[0](1);
      setTimeout(() => {
        resolves[1](2);
        setTimeout(() => {
          resolves[2](3);
        });
      });
    });
    return runIO(runNow(main())).then((res) => {
      assert.deepEqual({}, res);
      console.log("\\\\\\\\\\\\\\\\\\\\ Final res:", res);
    });
  });
  it("handles recursively defined behavior", () => {
    let resolve: (n: number) => void;
    function getNextNr(): IO<number> {
      return withEffectsP(() => {
        return new Promise((res) => {
          resolve = res;
        });
      })();
    }
    function loop(n: number): Now<Behavior<number>> {
      console.log("///////////////// Loop called with:", n);
      return Do(function*() {
        const e = yield async(getNextNr());
        const e1 = yield plan(e.map(loop));
        return Now.of(switcher(Behavior.of(n), e1));
      });
    }
    function main(): Now<E<number>> {
      return Do(function*() {
        const b: Behavior<number> = yield loop(0);
        const e = yield sample(when(b.map((n: number) => {
          console.log("-------------------------- comparing ", n, "to", 3);
          return n === 3;
        })));
        return Now.of(e);
      });
    }
    setTimeout(() => {
      resolve(1);
      setTimeout(() => {
        resolve(2);
        setTimeout(() => {
          resolve(3);
        });
      });
    });
    return runIO(runNow(main())).then((res) => {
      assert.deepEqual(res, {});
    });
  });
});

describe("Now", () => {
  it("extremely simple program works", () => {
    const prog = Do(function*() {
      const a = yield Now.of(12);
      return Now.of(ofE(a));
    });
    return runIO(runNow(prog)).then(res => {
      assert.equal(12, res); // actually 20
    });
  });
  it("quite simple program works", () => {
    const prog = Do(function*() {
      const a = yield async(withEffects((n: number) => n)(12));
      return Now.of(a);
    });
    return runIO(runNow(prog)).then(res => {
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
    return runIO(runNow(prog)).then(res => {
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
    return runIO(runNow(prog)).then(res => {
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
    runIO(runNow(prog)).then((res: boolean) => {
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
    function getNextNr(): IO<number> {
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
    return runIO(runNow(loop(0))).then((result) => {
      console.log("Finished with result", result);
    });
  });
  it("excutes plan asynchronously", () => {
    let resolve: (n: number) => void;
    let done = false;
    const fn = withEffectsP(() => {
      return new Promise((res) => {
        resolve = res;
      });
    });
    function comp(n: number): Now<number> {
      console.log("comp ran");
      return Now.of(n * 2);
    }
    const prog = Do(function*(): Iterator<Now<any>> {
      const e = yield async(fn());
      const e2 = yield plan(e.map(comp));
      return Now.of(e2);
    });
    setTimeout(() => {
      assert.strictEqual(done, false);
      resolve(11);
    });
    return runIO(runNow(prog)).then((res: number) => {
      done = true;
      assert.strictEqual(res, 22);
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
