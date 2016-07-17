/* @flow */

// Maybe

// type MaybeVal<T> = {just: T} | "nothing";

type MaybeMatch<T, K> = {
  nothing: () => K,
  just: (t: T) => K
};

// export class Maybe<A> {
//   val: MaybeVal<A>;
//   constructor(val: MaybeVal<A>) {
//     this.val = val;
//   }
//   Just(a: A) {
//     return new Maybe({just: });
//   }
//   Nothing() {
//     return new Maybe("nothing", undefined);
//   }
//   match<K>(m: MaybeMatch<A, K>) {
//     if (this.tag === "nothing") {
//       return m.nothing();
//     } else {
//       return m.just(this.val);
//     }
//   }
// }

export type Maybe<T> = ImplNothing | ImplJust<T>

function of<V>(v: V): Maybe<V> {
  return new ImplJust(v);
}

class ImplNothing {
  constructor() {};
  match<K>(m: MaybeMatch<any, K>): K {
    return m.nothing();
  }
  of = of;
  chain(f: (v: T) => Maybe<T>): Maybe<T> {
    return this;
  }
}

class ImplJust<T> {
  val: T;
  constructor(val: T) {
    this.val = val;
  }
  match<K>(m: MaybeMatch<T, K>): K {
    return m.just(this.val);
  }
  of = of;
  chain(f: (v: T) => Maybe<T>): Maybe<T> {
    return this.match({
      just: f,
      nothing: () => this
    });
  }
}

export function Just<V>(v: V) {
  return new ImplJust(v);
}

export function Nothing<V>() {
  return new ImplNothing();
}
