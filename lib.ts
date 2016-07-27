import {Monad, Do} from "./monad";
import {Maybe} from "./maybe";
import {Either} from "./either";
import {Left, Right} from "./either";
import {Effects} from "./effects";
import * as Eff from "./effects";

type Time = number;

class E<A> {
  val: Either<E<A>, A>;
  constructor(e: Either<E<A>, A>) {
    this.val = e;
  }
  of<T>(t: T): E<T> {
    return new E(new Right(t));
  }
  chain<T>(f: (t: T) => E<T>): E<T> {
    return this.val.match({
      left: (e) => new Left(e.chain(f)),
      right: f
    });
  }
}

function minTime<A, B>(e1: E<A>, e2: E<B>): E<{}> {
  return e1;
}

export function runE<A>(e: E<A>): Either<E<A>, A> {
  return e.val;
}

export const never = new E(new Left(never));
never.val = new Left(never);

class Behavior<A> {
  val: A;
  next: E<Behavior<A>>;
  constructor(val: A, next: E<Behavior<A>>) {
    this.val = val;
    this.next = next;
  }
  of<B>(b: B): Behavior<B> {
    return new Behavior(b, never);
  }
  chain<B>(f: (a: A) => Behavior<B>): Behavior<B> {
    return next.match({
      right: 12,
      left: () => this.val
    });
  }
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
  roundNumber: number; // mutable
  constructor() {
    this.id = 0;
    this.roundNumber = 0;
  }
}

type Plan<A> = {
  computation: E<A>,
  result: Maybe<A>
}

type PrimE<A> = {ref: Maybe<[Round, A]>}; // mutable ref

function spawn<A>(c: Clock, e: Effects<A>): Effects<PrimE<A>> {
  return Do(function* () {
    let mv = {ref: Nothing ()};
    Eff.runEffects(e).then(res => {
      mv.ref = Just([c.roundNumber, res])
    });
    return Eff.of(mv);
  });
}

function observeAt<A>(re: PrimE<A>, r: Round): Maybe<A> {
  const e = re.ref;
  return e.match({
    Nothing: Nothing,
    Just: ([r1, a]) => r1 <= r ? Just(r) : Nothing()
  });
}

// Mutable globals

let plans;
let clock;

export class Now<A> {
  comp: Effects<A>;
  constructor(a: Effects<A>) {
    this.val = a;
  }
  of<B>(b: B) {
    return new Now(Eff.of(b));
  }
  static of<B>(b: B) {
    return new Now((b));
  }
  chain<B>(f: (a: A) => Now<B>): Now<B> {
    return f(this.val);
  }
}

// Now API

function async<A>(e: Effects<A>): Now<E<A>> {
  return Now.of(spawn(clock, e));
  // return Do(function* () {
  // });
}

function toE<A>(pe: PrimE<A>): E<A> {
  
}

function sample<A>(b: Behavior<A>): Now<A> {
}

function plan<A>(p: E<Now<A>>): Now<E<A>> {
}

function runNow<A>(n: Now<E<A>>): Effects<A> {
  plans = [];
  clock = new Clock();
}

// Derived combinators

function switchE<A>(e1: E<Behavior<A>>, e2: E<Behavior<A>>): E<Behavior<A>> {  
}

function when(b: Behavior<boolean>): Behavior<E<{}>> {
  return whenJust(ap(boolToMaybe, b));
}

function change<A>(b: Behavior<A>): Behavior<E<{}>> {
  return Do(function*() {
    const cur = yield b;
    return when(ap(v => v !== cur), b);
  })
}
