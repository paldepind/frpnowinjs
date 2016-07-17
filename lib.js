/* @flow */

import {Monad, Do} from "./monad";
import type {Maybe} from "./maybe";
import type {Either} from "./either";
import {Left, Right} from "./either";

type Time = number;

class E<A> {
  val: Either<E<A>, A>;
  constructor(e: Either<E<A>, A>) {
    this.val = e;
  }
  pure<T>(t: T): E<T> {
    return new E(new Right(t));
  }
  chain<T>(f: (t: T) => E<T>): E<T> {
    val.match({
      left: (e) => Left(e.chain(f))
      right: f
    });
  }
}

function minTime<A, B>(e1: E<A>, e2: E<B>): E<{}> {
  
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
  pure<B>(b: B): Behavior<B> {
    return new Behavior(b, never);
  }
  chain<B>(f: (a: A) => Behavior<B>): Behavior<B> {
    return next.match({
      right: 
      left: () => this.val
    })
    const m = this.fn;
    return new Behavior((t) => f(m(t)).fn(t));
  }
}

// function switcher<A>(b: Behavior<A>, e: E<Behavior<A>>): Behavior<A> {
//   const [t, s] = e;
//   return new Behavior((n) => n < t ? b.fn(n) : s.fn(n));
// }

function whenJust<B>(b: B) {
}

// M monad stuff

class Clock {
  id: number;
  roundNumber: number;
  constructor() {
    this.id = 0;
    this.roundNumber = 0;
  }
}

type Plan<A> = {
  computation: E<A>,
  result: Maybe<A>
}

// function plan<A>(n: E<Now<A>>): Now<E<A>> {
// }

// Now stuff

type Now<A> = {res: A};

function runNow<A>(n: Now<E<A>>) { 
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
