import { DomainError } from './errors.js';

/**
 * A finite state machine as a plain transition table. No library: the
 * table is the documentation, and it is trivially exhaustively testable.
 */
export interface Machine<S extends string> {
  readonly name: string;
  readonly states: readonly S[];
  readonly terminalStates: readonly S[];
  readonly initial: S;
  isTerminal(state: S): boolean;
  canTransition(from: S, to: S): boolean;
  /** Returns `to` or throws `ILLEGAL_TRANSITION`. */
  transition(from: S, to: S): S;
  targets(from: S): readonly S[];
}

export function defineMachine<S extends string>(
  name: string,
  initial: NoInfer<S>,
  table: Readonly<Record<S, readonly NoInfer<S>[]>>,
): Machine<S> {
  const states = Object.keys(table) as S[];
  const terminalStates = states.filter((s) => table[s].length === 0);
  const canTransition = (from: S, to: S): boolean => table[from].includes(to);
  return {
    name,
    states,
    terminalStates,
    initial,
    isTerminal: (s) => table[s].length === 0,
    canTransition,
    targets: (from) => table[from],
    transition(from, to) {
      if (!canTransition(from, to)) {
        throw new DomainError('ILLEGAL_TRANSITION', `${name}: ${from} → ${to} is not allowed`, {
          machine: name,
          from,
          to,
          allowed: [...table[from]],
        });
      }
      return to;
    },
  };
}
