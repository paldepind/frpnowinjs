import {Monad} from "./monad";

export type Effects<A> = ImplEffects<A>;

type ImpureComp<A> = () => Promise<A>;

class ImplEffects<A> {
  comp: ImpureComp<A>;
  constructor(f: ImpureComp<A>) {
    this.comp = f;
  }
  of<B>(k: B): Effects<B> {
    return new ImplEffects(() => Promise.resolve(k));
  }
  chain<B>(f: (v: A) => Effects<B>): Effects<B> {
    return new ImplEffects(() => this.comp().then(r => f(r).comp()));
  }
}

export function of<B>(k: B): Effects<B> {
  return new ImplEffects(() => Promise.resolve(k));
}

export function runEffects<A>(e: Effects<A>): Promise<A> {
  return e.comp();
}

// takes an impure function an converts it to a computation
// in the effects monad
export function withEffects<A>(fn) {
  return (...args) => new ImplEffects(() => Promise.resolve(fn(...args)));
}

export function ap<A, B>(fe: Effects<(a: A) => B>, ve: Effects<A>): Effects<B> {
  return fe.chain(f => ve.chain(v => of(f(v))));
}
