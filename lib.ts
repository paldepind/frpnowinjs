import {Monad, Do} from "./monad";
import {Maybe, nothing, just} from "../jabz/src/maybe";
import {Either, left, right} from "../jabz/src/either";
import {
  Effects, withEffects, wrapEffects, runEffects, thunk
} from "./effects";
import * as Eff from "./effects";

type Time = number;

export type E<A> = EImpl<A>;

class EImpl<A> {
  constructor(public val: Effects<Either<E<A>, A>>) {}
  of<T>(t: T): E<T> {
    return E(Eff.of(right(t)));
  }
  map<B>(f: (a: A) => B): E<B> {
    return E<B>(this.val.chain(e => e.match({
      right: v => Eff.of(right(f(v))),
      left: v => Eff.of(left(E(thunk(() => v.map(f).val))))
    })));
  }
  chain<T>(f: (t: A) => E<T>): E<T> {
    return E<T>(this.val.chain(v => v.match({
      left: (e: E<A>) => Eff.of(left(e.chain(f))),
      right: (t: A) => (f(t)).val
    })));
  }
}

export function ofE<A>(a: A): E<A> {
  return E(Eff.of(right(a)));
}

function E<A>(e: Effects<Either<E<A>, A>>) {
  return new EImpl<A>(e);
}

function minTime<A, B>(e1: E<A>, e2: E<B>): E<{}> {
  return E(runE(e1).chain(v1 => runE(e2).chain(v2 => {
    return Eff.of(v1.match({
      right: _ => right({}),
      left: l1 => v2.match({
        right: _ => right({}),
        left: l2 => left(minTime(l1, l2))
      })
    }));
  })));
}

export function runE<A>(e: E<A>): Effects<Either<E<A>, A>> {
  return e.val;
}

export const never = E(Eff.of(left(undefined)));
never.val = Eff.of(left(never)); // cyclic

type InB<A> = {cur: A, next: E<Behavior<A>>}

export class Behavior<A> {
  constructor(public val: Effects<InB<A>>) {
    this.val = val;
  }
  of<B>(b: B): Behavior<B> {
    return B(Eff.of({cur: b, next: never}));
  }
  static of<B>(b: B): Behavior<B> {
    return B(Eff.of({cur: b, next: never}));
  }
  map<B>(f: (a: A) => B): Behavior<B> {
    return B(this.val.map(({cur, next}) => {
      return {
        cur: f(cur),
        next: next.map(b => b.map(f))
      };
    }));
  }
  // chain<B>(f: (a: A) => Behavior<B>): Behavior<B> {
  //   return B(this.next.match({
  //     right: 12,
  //     left: () => this.val
  //   }));
  // }
  flatten(b: Behavior<Behavior<A>>): Behavior<A> {
    return B(runB(b).chain(({cur, next}) => {
      return runB(switcher(cur, next.map(this.flatten)));
    }));
  }
}

export function runB<A>(b: Behavior<A>): Effects<InB<A>> {
  return b.val;
}

export function apB<A, B>(bf: Behavior<(a: A) => B>, ba: Behavior<A>): Behavior<B> {
  return B<B>(
    runB(bf).chain(f => runB(ba).chain(a => Eff.of({
      cur: f.cur(a.cur),
      next: minTime(f.next, a.next)
    })))
  );
}

export function B<A>(v: Effects<InB<A>>): Behavior<A> {
  return new Behavior(v);
}

export function switcher<A>(b: Behavior<A>, e: E<Behavior<A>>): Behavior<A> {
  // console.log("entering switcher ************");
  // console.log(e);
  return B(runE(e).chain(either => {
    // console.log("in switcher **************");
    return either.match<Effects<InB<A>>>({
      left: (ne) => {
        return runB(b).chain(({cur, next}) => {
          return Eff.of({cur, next: switchE(next, ne)});
        });
      },
      right: (b) => runB(b)
    });
  }));
}

function switchE<A>(e1: E<Behavior<A>>, e2: E<Behavior<A>>): E<Behavior<A>> {
  return minTime(e1, e2).map(_ => switcher(switcher(Behavior.of(undefined), e1), e2));
}

// function switcher<A>(b: Behavior<A>, e: E<Behavior<A>>): Behavior<A> {
//   const [t, s] = e;
//   return new Behavior((n) => n < t ? b.fn(n) : s.fn(n));
// }

export function whenJust<A>(b: Behavior<Maybe<A>>): Behavior<E<A>> {
  return B(runB(b).chain((v: InB<Maybe<A>>) => {
    console.log("In when just chain, current is:", v.cur);
    return v.cur.match({
      just: (x) => Eff.of({cur: ofE(x), next: v.next.map(whenJust)}),
      nothing: () => planM(v.next.map(b => runB(whenJust(b)))).chain((en) => {
        console.log("Deeper in whenJust, matched nothing, made new plan");
        return Eff.of({cur: en.chain(o => o.cur), next: en.chain(o => o.next)});
      })
    });
  }));
}

// M monad stuff

type Round = number;

class Clock {
  id: number;
  round: Round; // mutable
  constructor() {
    this.id = 0;
    this.round = 0;
  }
}

type Plan<A> = {
  computation: E<Effects<A>>,
  result: Maybe<A> // mutable
  , name: string // temp
}

type Ref<A> = {
  ref: A
}

type PrimE<A> = {ref: Maybe<[Round, A]>}; // mutable ref

function spawn<A>(c: Clock, e: Effects<A>): Effects<PrimE<A>> {
  let mv = {ref: nothing()};
  Eff.runEffects(e).then(res => {
    console.log("");
    console.log("Spawned stuff finished with result", res);
    mv.ref = just([c.round, res]);
    mainLoop();
  });
  return Eff.of(mv);
}

function observeAt<A>(re: PrimE<A>, r: Round): Maybe<A> {
  const e = re.ref;
  return e.match({
    nothing: nothing,
    just: ([r1, a]) => r1 <= r ? just(a) : nothing()
  });
}

// Mutable globals

let plans: Ref<Plan<any>>[];
let clock: Clock;
let resolve: Function;
let endE: E<any>;

export class Now<A> {
  comp: Effects<A>;
  constructor(a: Effects<A>) {
    this.comp = a;
  }
  of<B>(b: B) {
    return new Now(Eff.of(b));
  }
  static of<B>(b: B) {
    return new Now(Eff.of(b));
  }
  chain<B>(f: (a: A) => Now<B>): Now<B> {
    return new Now(this.comp.chain((v) => f(v).comp));
  }
  map<B>(f: (a: A) => B): Now<B> {
    return this.chain(v => this.of(f(v)));
  }
}

function getNow<A>(n: Now<A>): Effects<A> {
  return n.comp;
}

// lift an Effect into the Now monad
function liftIO<A>(e: Effects<A>): Now<A> {
  return new Now(e);
}

export function effMapM_<A, B>(f: (a: A) => Effects<B>, arr: A[]): Effects<{}> {
  return arr.reduce((acc, cur) => acc.chain(_ => f(cur)), Eff.of({}));
}

// Now API

const readClock = wrapEffects(() => clock);

const curRound: Effects<Round> = withEffects(() => clock.round)();

export function async<A>(e: Effects<A>): Now<E<A>> {
  return liftIO(readClock.chain((c: Clock) => spawn(c, e))).map(toE);
}

function toE<A>(pe: PrimE<A>): E<A> {
  return E(curRound.map(r => {
    return observeAt<A>(pe, r).match({
      just: (v) => right(v),
      nothing: () => left(toE(pe))
    });
  }));
}

function planToEv<A>(p: Plan<A>): E<A> {
  console.log("---1 planToEv called");
  const ef = () => p.result.match({
    just: (x) => Eff.of(right(x)), // plan has been runned, return result
    nothing: () => {
      console.log("---2 Running plan");
      return runE(p.computation).chain(estate => {
        console.log("---3 Returning plan state as ev:", estate);
        return estate.match({
          left: (_) => {
            return Eff.of(left(E(thunk(() => {
              console.log("Calling planToEv from thunk", plan.name);
              return runE(planToEv(p));
            }))));
          },
          right: (m) => m.chain(v => {
            console.log("---4 Result:", v);
            p.result = just(v); // mutate result into plan
            return Eff.of(right(v));
          })
        });
      });
    }
  });
  return E(thunk(ef));
}

export function plan<A>(pl: E<Now<A>>): Now<E<A>> {
  // FIXME: implement in term of planM
  return new Now(withEffects(() => {
    console.log("in plan effects");
    // runEffects(runE(pl)).then(() => console.log("this works"));
    const p: Plan<A> = {
      computation: pl.map(getNow),
      result: nothing(), name: "plan"
    };
    console.log("************************------------ Adding plan from plan", plans.length + 1);
    addPlan({ref: p});
    console.log("calling planToEv from plan");
    return planToEv(p);
  })());
}

function planM<A>(pl: E<Effects<A>>): Effects<E<A>> {
  return withEffects(() => {
    const p: Plan<A> = {
      computation: pl,
      result: nothing(), name: "planM"
    };
    console.log("***********************------------ Adding plan from planM", plans.length + 1);
    addPlan({ref: p});
    return planToEv(p);
  })();
}

function addPlan(plan: Ref<Plan<any>>): void {
  plans.push(plan);
}

function tryPlans(): Effects<{}> {
  console.log("--------------- Trying plans, nr. of plans:", plans.length);
  return effMapM_(tryPlan, plans);
}

function tryPlan<A>(refPlan: Ref<Plan<A>>): Effects<{}> {
  const plan = refPlan.ref;
  console.log("------------*** Trying plan from ", plan.name);
  return runE(planToEv(plan)).chain((eres) => {
    console.log("---- Result of trying plan", eres);
    return eres.match({
      right: (x) => {
        console.log("-------------------- Plan done ", plan.name);
        let nrOf = plans.length;
        pull(refPlan, plans); // plan is done, remove
        console.log("nr of plans whent from", nrOf, "to", plans.length);
        return Eff.of({});
      },
      left: () => Eff.of({})
    });
  });
}

export function runNow<A>(n: Now<E<A>>): Effects<A> {
  console.log("runNow");
  plans = [];
  clock = new Clock();
  endE = undefined;
  return Eff.fromPromise(new Promise((res, rej) => {
    resolve = res;
    console.log("1/2: Starting initial now comp", n.comp);
    Eff.runEffects(n.comp).then((ev) => {
      console.log("2/2: Finished running initial now comp");
      console.log(ev);
      if (!(ev instanceof EImpl)) {
        console.log("Result of now computation must be event");
        rej(new TypeError("Result of now computation must be event"));
      } else {
        console.log("Setting endE and starting mainloop");
        endE = ev;
        mainLoop();
      }
    });
  }));
}

// invoked when events created by `async` resolve and after running
// the initial Now computation given to `runNow`
function mainLoop<A>(): void {
  console.log("1/ mainLoop", endE, endE ? "" : "<-- is undef :(");
  Eff.runEffects(tryPlans().chain(_ => {
    console.log("-------------- Done trying plans");
    return runE(endE).chain((v: Either<E<A>, A>) => {
      console.log("2/ pulled in endE");
      console.log(v);
      return v.match({
        left: () => Eff.of({}),
        right: (a: A) => {
          resolve(a);
          return Eff.of({});
        }
      });
    });
  }));
}

export function sample<A>(b: Behavior<A>): Now<A> {
  return new Now(b.val.map(({cur}) => cur));
}

// Derived combinators

function boolToMaybe(b: boolean): Maybe<{}> {
  return b ? just({}) : nothing();
}

export function when(b: Behavior<boolean>): Behavior<E<{}>> {
  return whenJust(b.map(boolToMaybe));
}

// function change<A>(b: Behavior<A>): Behavior<E<{}>> {
//   return Do(function*() {
//     const cur = yield b;
//     return when(ap(v => v !== cur), b);
//   })
// }

function pull<A>(item: A, array: A[]) {
  let index = array.indexOf(item);
  if (index !== -1) {
    array.splice(index, 1);
  }
}
