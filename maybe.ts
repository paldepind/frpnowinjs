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

export type Maybe<T> = Nothing<T> | Just<T>

function of<V>(v: V): Maybe<V> {
  return new Just(v);
}

class Nothing<A> {
  constructor() {};
  match<K>(m: MaybeMatch<any, K>): K {
    return m.nothing();
  }
  of: <B>(v: B) => Maybe<B> = of;
  chain<B>(f: (v: any) => Maybe<B>): Maybe<B> {
    return this;
  }
}

class Just<A> {
  val: A;
  constructor(val: A) {
    this.val = val;
  }
  match<K>(m: MaybeMatch<A, K>): K {
    return m.just(this.val);
  }
  of: <V>(v: V) => Maybe<V> = of;
  chain<B>(f: (v: A) => Maybe<B>): Maybe<B> {
    return this.match({
      just: f,
      nothing: () => this
    });
  }
}

export function just<V>(v: V): Maybe<V> {
  return new Just(v);
}

export function nothing<V>(): Maybe<V> {
  return new Nothing();
}
