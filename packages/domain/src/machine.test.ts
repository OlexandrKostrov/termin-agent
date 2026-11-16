import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { defineMachine } from './machine.js';

const light = defineMachine<'red' | 'green' | 'off'>('light', 'red', {
  red: ['green', 'off'],
  green: ['red', 'off'],
  off: [],
});

describe('defineMachine', () => {
  it('derives states and terminal states from the table', () => {
    expect(light.states).toEqual(['red', 'green', 'off']);
    expect(light.terminalStates).toEqual(['off']);
    expect(light.isTerminal('off')).toBe(true);
    expect(light.targets('red')).toEqual(['green', 'off']);
  });

  it('allows listed transitions and rejects others with a typed error', () => {
    expect(light.transition('red', 'green')).toBe('green');
    try {
      light.transition('off', 'red');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).toAppError()).toEqual({
        code: 'ILLEGAL_TRANSITION',
        message: 'light: off → red is not allowed',
        details: { machine: 'light', from: 'off', to: 'red', allowed: [] },
      });
    }
  });
});
