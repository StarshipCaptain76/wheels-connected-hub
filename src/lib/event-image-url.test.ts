import { strict as assert } from "node:assert";
import { concoursSponsorImageUrl } from "./event-image-url";

const stored = "https://storage.example/storage/v1/object/public/gallery/events/concours-sponsors/logo.png";
const url = concoursSponsorImageUrl("event-id", stored);
assert.ok(url.startsWith("/api/public/event-image?id=event-id&k=sponsor&v="));
assert.notEqual(url, concoursSponsorImageUrl("event-id", `${stored}new`));
assert.equal(concoursSponsorImageUrl("event-id", "https://example.com/logo.png"), "https://example.com/logo.png");
console.log("Sponsor image URL tests passed");