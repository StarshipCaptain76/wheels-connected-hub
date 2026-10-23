import { scoreConcoursAnswers, weightedAverage, firstPlaceIds, formatConcoursScore } from "./concours-score";
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
function rejects(fn: () => unknown) { try { fn(); } catch { return; } throw new Error("Expected invalid answer rejection"); }
assert(scoreConcoursAnswers({ a: "yes", b: "no", c: 5 }, [{ id: "a", scoring_type: "yes_no" }, { id: "b", scoring_type: "yes_no" }, { id: "c", scoring_type: "scale_1_10" }]).totalScore === 5, "Each question has equal weight");
assert(scoreConcoursAnswers({ a: "na", b: 8 }, [{ id: "a", scoring_type: "yes_no_na" }, { id: "b", scoring_type: "scale_1_10" }]).totalScore === 8, "N/A excluded from denominator");
rejects(() => scoreConcoursAnswers({ a: "na" }, [{ id: "a", scoring_type: "yes_no_na" }]));
rejects(() => scoreConcoursAnswers({ a: "yes" }, [{ id: "a", scoring_type: "scale_1_10" }]));
rejects(() => scoreConcoursAnswers({ a: 11 }, [{ id: "a", scoring_type: "count" }]));
assert(scoreConcoursAnswers({ a: 0 }, [{ id: "a", scoring_type: "count" }]).totalScore === 0, "Count zero is scored");
assert(weightedAverage([{ total_score: 10, weight: 1 }, { total_score: 4, weight: 0.5 }]).average === 8, "Members weight 1; spectators 0.5");
assert(firstPlaceIds([{ id: "a", average_score: 8.04 }, { id: "b", average_score: 8.01 }]).join() === "a", "Display rounding does not create ties");
assert(firstPlaceIds([{ id: "a", average_score: 8 }, { id: "b", average_score: 8 }, { id: "c", average_score: 7 }]).join() === "a,b", "Only equal first-place vehicles enter draw");
assert(formatConcoursScore(6.666666666666667) === "6.7", "Spectator score rounds to one decimal");
assert(formatConcoursScore(7.333333333333333) === "7.3", "Average rounds to one decimal");
assert(formatConcoursScore(8) === "8.0", "Whole scores keep one decimal place");
assert(formatConcoursScore(null) === "", "Missing average formats to empty");
console.log("concours-score ok");