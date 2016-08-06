// import {Monad} from "./monad";

type ImpureComp<A> = () => Promise<A>;

export class Effects<A> {
  comp: ImpureComp<A>;
  constructor(f: ImpureComp<A>) {
    this.comp = f;
  }
  of<B>(k: B): Effects<B> {
    return new Effects(() => Promise.resolve(k));
  }
  chain<B>(f: (v: A) => Effects<B>): Effects<B> {
    return new Effects(() => this.comp().then(r => f(r).comp()));
  }
  map<B>(f: (a: A) => B): Effects<B> {
    return this.chain(v => this.of(f(v)));
  }
  lazyChain<B>(f: (v: A) => Effects<B>): Effects<B> {
    return new Effects(() => this.comp().then(r => f(r).comp()));
  }
}

export function of<B>(k: B): Effects<B> {
  return new Effects(() => Promise.resolve(k));
}

export function runEffects<A>(e: Effects<A>): Promise<A> {
  return e.comp();
}

export function thunk<A>(t: () => Effects<A>): Effects<A> {
  console.log("thunk ");
  return new Effects(() => t().comp());
}

export function wrapEffects<A>(f: () => A): Effects<A> {
  return new Effects(() => Promise.resolve(f()));
}

// takes an impure function an converts it to a computation
// in the effects monad
export function withEffects<A>(fn: any): (...as: any[]) => Effects<A> {
  return (...args: any[]) => new Effects(() => Promise.resolve(fn(...args)));
}

export function withEffectsP<A>(fn: (...as: any[]) => Promise<A>): (...a: any[]) => Effects<A> {
  return (...args: any[]) => new Effects(() => fn(...args));
}

export function fromPromise<A>(p: Promise<A>): Effects<A> {
  return new Effects(() => p);
}

export function ap<A, B>(fe: Effects<(a: A) => B>, ve: Effects<A>): Effects<B> {
  return fe.chain(f => ve.chain(v => of(f(v))));
}
