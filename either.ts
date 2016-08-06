export type Either<A, B> = LeftImpl<A, B> | RightImpl<A, B>;

type EitherMatch<A, B, K> = {
  left: (a: A) => K,
  right: (b: B) => K
}

class LeftImpl<A, B> {
  val: A;
  constructor(a: A) {
    this.val = a;
  }
  match<K>(m: EitherMatch<A, B, K>): K {
    return m.left(this.val);
  }
}

class RightImpl<A, B> {
  val: B;
  constructor(b: B) {
    this.val = b;
  }
  match<K>(m: EitherMatch<A, B, K>): K {
    return m.right(this.val);
  }
}

export function left<A, B>(a: A): Either<A, B> {
  return new LeftImpl(a);
}

export function right<A, B>(b: B): Either<A, B> {
  return new RightImpl(b);
}
