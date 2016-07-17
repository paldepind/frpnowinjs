/* @flow */

export interface Monad<A> {
  pure: <B>(a: B) => Monad<B>;
  chain: <B>(f: (a: A) => Monad<B>) => Monad<B>;
}

export function Do(gen: () => Generator<Monad<any>, any, any>) {
  const doing = gen();
  function doRec(v) {
    const a = doing.next(v);
    if (a.done === true) {
      return a.value;
    } else {
      return a.value.chain(doRec);
    }
  };
  return doRec(null);
};
