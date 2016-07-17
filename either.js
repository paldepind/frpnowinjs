/* @flow */

export type Either<A, B> = Left<A> | Right<B>;

type EitherMatch<A, B, K> = {
  left: (a: A) => K,
  right: (b: B) => K
}

export class Left<A> {
  val: A;
  constructor(a: A) {
    this.val = a;
  }
  match<B, K>(m: EitherMatch<A, B, K>): K {
    return m.left(this.val);
  }
}

export class Right<B> {
  val: B;
  constructor(b: B) {
    this.val = b;
  }
  match<A, K>(m: EitherMatch<A, B, K>): K {
    return m.right(this.val);
  }
}
