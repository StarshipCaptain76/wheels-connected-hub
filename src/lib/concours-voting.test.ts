import { filterVotingReadyEventIds, MIN_VOTING_VEHICLES } from "./concours-voting";
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }

assert(MIN_VOTING_VEHICLES === 2, "Voting requires at least two vehicles");
assert(filterVotingReadyEventIds(["a"], new Map([["a", 0]])).length === 0, "Event with no cars is not votable");
assert(filterVotingReadyEventIds(["a"], new Map([["a", 1]])).length === 0, "Event with one car is not votable");
assert(filterVotingReadyEventIds(["a", "b"], new Map([["a", 2], ["b", 7]])).join() === "a,b", "Events with two or more cars are votable");
assert(filterVotingReadyEventIds(["a", "b"], new Map([["a", 2]])).join() === "a", "Only carless events are filtered out");
assert(filterVotingReadyEventIds(["a"], new Map()).length === 0, "Missing count is treated as no cars");
console.log("concours-voting ok");
