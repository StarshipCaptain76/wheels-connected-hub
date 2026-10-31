import { chooseCompetitionLeader } from './competition-leaders';
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
for (const competition of ['Concours', 'Rolls-Royce']) {
  const cars = [{ id: 'a', score: 8 }, { id: 'b', score: 8 }, { id: 'c', score: 7 }];
  const first = chooseCompetitionLeader(cars, null, () => 0);
  const last = chooseCompetitionLeader(cars, null, () => 0.99);
  assert(first?.id === 'a' && last?.id === 'b', `${competition}: random choice covers only tied best cars`);
  assert(chooseCompetitionLeader(cars, last, () => 0)?.id === 'b', `${competition}: refresh retains recorded draw`);
  assert(chooseCompetitionLeader([{ id: 'a', score: 9 }, { id: 'b', score: 8 }], last)?.id === 'a', `${competition}: leader changes with scores`);
}
assert(chooseCompetitionLeader([{ id: 'a', score: 8 }, { id: 'b', score: 8.00000000001 }], null)?.id === 'b', 'Only exact scores tie');
assert(chooseCompetitionLeader([], null) === null, 'No leader without scores');
console.log('competition-leaders ok');