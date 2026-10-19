import { selectConcoursQuestionIds, canSeeIdleCompetition } from './concours-questions.ts';
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
const bank = Array.from({ length: 120 }, (_, i) => `q${i}`);
const picks = selectConcoursQuestionIds(bank, bank.slice(0, 5), 5, 'event:car');
assert(picks.allIds.length === 5, 'Configured five means five member questions, not ten');
assert(picks.spectatorIds.length === 3, 'Guests receive half of five, rounded up');
assert(selectConcoursQuestionIds(bank, bank.slice(0, 10), 10, 'event:car').spectatorIds.length === 5, 'Half of ten is five');
const fullSelection = selectConcoursQuestionIds(bank.slice(0, 5), bank.slice(0, 5), 5, 'event:car');
assert(fullSelection.spectatorIds.length === 3, 'Guest draw includes admin picks, not just remaining questions');
assert(JSON.stringify(picks.spectatorIds) === JSON.stringify(selectConcoursQuestionIds(bank, bank.slice(0, 5), 5, 'event:car').spectatorIds), 'Draw is stable during submission');
assert(!canSeeIdleCompetition(false, false), 'Guests cannot see Rolls-Royce competition');
assert(canSeeIdleCompetition(true, false), 'Members can see Rolls-Royce competition');
assert(canSeeIdleCompetition(false, true), 'Admins can see Rolls-Royce competition');
console.log('Concours rules passed');