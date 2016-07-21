/* @flow */

export interface Monad<A> {
  of: <B>(b: B) => Monad<B>;
  chain: <B>(f: (a: A) => Monad<B>) => Monad<B>;
}

export function Do(gen: () => Generator<Monad<any>, Monad<any>, any>) {
  const doing = gen();
  function doRec(v) {
    const a = doing.next(v);
    if (a.done === true) {
      return a.value;
    } else if (typeof a.value !== "undefined") {
      return a.value.chain(doRec);
    } else {
      throw new Error("Expected monad value")
    }
  };
  return doRec(null);
};
