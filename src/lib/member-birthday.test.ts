import { birthdaySchema, birthdayIsToday } from './member-birthday';
function assert(v: unknown, message: string) { if (!v) throw new Error(message); }
assert(birthdayIsToday({ month: 10, day: 31 }, new Date('2026-10-31T06:28:00Z')), 'Max birthday is 31 October');
assert(birthdayIsToday({ month: 10, day: 31 }, new Date('2026-10-30T22:00:00Z')), 'Birthday matching uses Johannesburg midnight');
assert(!birthdayIsToday({ month: 10, day: 31 }, new Date('2026-10-30T21:59:59Z')), 'No early birthday notice');
assert(!birthdaySchema.safeParse({ month: 4, day: 31 }).success, 'Invalid calendar dates rejected');
assert(birthdaySchema.safeParse({ month: 2, day: 29 }).success, 'Leap day can be stored without birth year');
console.log('member-birthday ok');