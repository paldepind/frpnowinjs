import {Monad, Do} from "./monad";
import {Maybe, Nothing, Just} from "./maybe";
import {Either, Left, Right} from "./either";
import {Effects, withEffects} from "./effects";
import * as Eff from "./effects";

type Time = number;

type E<A> = EImpl<A>;

class EImpl<A> {
  val: Effects<Either<E<A>, A>>;
  constructor(e: Effects<Either<E<A>, A>>) {
    this.val = e;
  }
  of<T>(t: T): E<T> {
    return E(Eff.of(Right(t)));
  }
  map<B>(f: (a: A) => B): E<B> {
    return E<B>(this.val.chain(e => e.match({
      right: v => Eff.of(Right(f(v))),
      left: v => runE(v.map(f))
    })));
  }
  chain<T>(f: (t: A) => E<T>): E<T> {
    return E<T>(this.val.chain(v => v.match({
      // left: (e) => Eff.thunk(() => Left(e.chain(f))),
      left: (e: E<A>) => Eff.of(Left(e.chain(f))),
      right: (t: A) => (f(t)).val
    })));
  }
}

export function ofE<A>(a: A): E<A> {
  return E(Eff.of(Right(a)));
}

function E<A>(e: Effects<Either<E<A>, A>>) {
  return new EImpl<A>(e);
}

function minTime<A, B>(e1: E<A>, e2: E<B>): E<{}> {
  return E(runE(e1).chain(v1 => runE(e2).chain(v2 => {
    return Eff.of(v1.match({
      right: _ => Right({}),
      left: l1 => v2.match({
        right: _ => Right({}),
        left: l2 => Left(minTime(l1, l2))
      })
    }));
  })));
}

export function runE<A>(e: E<A>): Effects<Either<E<A>, A>> {
  return e.val;
}

export const never = E(Eff.of(Left(undefined)));
never.val = Eff.of(Left(never)); // cyclic

type InB<A> = {val: A, next: E<Behavior<A>>}

export class Behavior<A> {
  constructor(public val: Effects<InB<A>>) {
    this.val = val;
  }
  of<B>(b: B): Behavior<B> {
    return B(Eff.of({val: b, next: never}));
  }
  static of<B>(b: B): Behavior<B> {
    return B(Eff.of({val: b, next: never}));
  }
  // chain<B>(f: (a: A) => Behavior<B>): Behavior<B> {
  //   return B(this.next.match({
  //     right: 12,
  //     left: () => this.val
  //   }));
  // }
  flatten(b: Behavior<Behavior<A>>): Behavior<A> {
    return B(runB(b).chain(({val, next}) => {
      return runB(zwitch(val, next.map(this.flatten)));
    }));
  }
}

export function runB<A>(b: Behavior<A>): Effects<InB<A>> {
  return b.val;
}

export function apB<A, B>(bf: Behavior<(a: A) => B>, ba: Behavior<A>): Behavior<B> {
  return B<B>(
    runB(bf).chain(f => runB(ba).chain(a => Eff.of({
      val: f.val(a.val),
      next: minTime(f.next, a.next)
    })))
  );
}

function B<A>(v: Effects<InB<A>>): Behavior<A> {
  return new Behavior(v);
}

export function zwitch<A>(b: Behavior<A>, e: E<Behavior<A>>): Behavior<A> {
  return B(runE(e).chain(either => either.match<Effects<InB<A>>>({
    left: ne => {
      return runB(b).chain(({val, next}) => {
        return Eff.of({val: val, next: switchE(next, ne)});
      });
    },
    right: b => runB(b)
  })));
}

function switchE<A>(e1: E<Behavior<A>>, e2: E<Behavior<A>>): E<Behavior<A>> {
  return minTime(e1, e2).map(_ => zwitch(zwitch(Behavior.of(undefined), e1), e2));
}

// function switcher<A>(b: Behavior<A>, e: E<Behavior<A>>): Behavior<A> {
//   const [t, s] = e;
//   return new Behavior((n) => n < t ? b.fn(n) : s.fn(n));
// }

function whenJust<B>(b: B) {
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
  computation: E<A>,
  result: Maybe<A>
}

type PrimE<A> = {ref: Maybe<[Round, A]>}; // mutable ref

function spawn<A>(c: Clock, e: Effects<A>): Effects<PrimE<A>> {
  let mv = {ref: Nothing()};
  Eff.runEffects(e).then(res => {
    mv.ref = Just([c.round, res]);
    mainLoop();
  });
  return Eff.of(mv);
}

function observeAt<A>(re: PrimE<A>, r: Round): Maybe<A> {
  const e = re.ref;
  return e.match({
    nothing: Nothing,
    just: ([r1, a]) => r1 <= r ? Just(a) : Nothing()
  });
}

// Mutable globals

let plans: Plan<any>[];
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

// lift an Effect into the Now monad
function liftIO<A>(e: Effects<A>): Now<A> {
  return new Now(e);
}

// Now API

const curRound: Effects<Round> = withEffects(() => clock.round)();

export function async<A>(e: Effects<A>): Now<E<A>> {
  return liftIO(spawn(clock, e)).map(toE);
}

function toE<A>(pe: PrimE<A>): E<A> {
  return E(curRound.map(r => {
    return observeAt<A>(pe, r).match({
      just: (v) => Right(v),
      nothing: () => Left(toE(pe))
    });
  }));
}

// function sample<A>(b: Behavior<A>): Now<A> {
// }

// function plan<A>(p: E<Now<A>>): Now<E<A>> {
// }

export function runNow<A>(n: Now<E<A>>): Effects<A> {
  plans = [];
  clock = new Clock();
  return Eff.fromPromise(new Promise((res, rej) => {
    resolve = res;
    Eff.runEffects(n.comp).then((ev) => {
      if (!(ev instanceof EImpl)) {
        rej(new TypeError ("Result of now computation must be event"));
      } else {
        endE = ev;
        mainLoop();
      }
    });
  }));
}

// invoked when events created by `async` resolve and after running
// the initial Now computation given to `runNow`
function mainLoop<A>(): void {
  Eff.runEffects(runE(endE)).then((v: Either<E<A>, A>) => {
    v.match({
      left: () => {},
      right: (a: A) => resolve(a)
    });
  });
}

// Derived combinators

// function when(b: Behavior<boolean>): Behavior<E<{}>> {
//   return whenJust(ap(boolToMaybe, b));
// }

// function change<A>(b: Behavior<A>): Behavior<E<{}>> {
//   return Do(function*() {
//     const cur = yield b;
//     return when(ap(v => v !== cur), b);
//   })
// }
