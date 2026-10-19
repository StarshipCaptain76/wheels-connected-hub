import { selectConcoursQuestionIds, canSeeIdleCompetition, concoursQuestionPool, prepareConcoursSelection } from './concours-questions.ts';
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
const mixed = Array.from({ length: 15 }, (_, i) => ({ id: `road${i}`, category: 'Roadworthy', active: true }));
mixed.push({ id: 'paint', category: 'Exterior', active: true }, { id: 'retired', category: 'Roadworthy', active: false });
const roadBank = concoursQuestionPool(mixed, 'Roadworthy').map(q => q.id);
const roadSelected = prepareConcoursSelection(roadBank, ['paint'], 10, false);
const guestBank = concoursQuestionPool(mixed, null).map(q => q.id);
const roadDraw = selectConcoursQuestionIds(roadBank, roadSelected, 10, 'oct31:car', guestBank);
assert(roadDraw.allIds.length === 10 && roadDraw.allIds.every(id => roadBank.includes(id)), '31 October members get ten roadworthy questions only');
assert(roadDraw.spectatorIds.length === 5 && JSON.stringify(roadDraw.spectatorIds) === JSON.stringify(selectConcoursQuestionIds(guestBank, [], 10, 'oct31:car').spectatorIds), '31 October guests get five random questions from the full active bank, ignoring the member category');
assert(Array.from({length: 100}, (_, i) => selectConcoursQuestionIds(roadBank, roadSelected, 10, `oct31:car${i}`, guestBank)).some(draw => draw.spectatorIds.includes('paint')), 'Questions outside Roadworthy remain eligible for guests');
assert(JSON.stringify(prepareConcoursSelection(roadBank, roadSelected, 10, true)) === JSON.stringify(roadSelected), 'Manual selection keeps exactly the admin chosen questions');
let rejected = false;
try { prepareConcoursSelection(roadBank, [...roadSelected.slice(0, 9), 'paint'], 10, true); } catch { rejected = true; }
assert(rejected, 'Out-of-category manual questions are rejected');
rejected = false;
try { prepareConcoursSelection(roadBank.slice(0, 9), [], 10, false); } catch { rejected = true; }
assert(rejected, 'Insufficient category bank cannot silently reduce the configured ten');