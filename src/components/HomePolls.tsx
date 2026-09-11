import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Plus } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  addPollOption,
  castVote,
  listHomePolls,
  type HomePoll,
} from "@/lib/polls.functions";

export function HomePolls({ asPage = false }: { asPage?: boolean }) {
  const { lang } = useI18n();
  const isAf = lang === "af";
  const qc = useQueryClient();
  const vote = useServerFn(castVote);
  const addOpt = useServerFn(addPollOption);

  const [hydrated, setHydrated] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setHydrated(true);
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
      void qc.invalidateQueries({ queryKey: ["home-polls"] });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const { data } = useQuery({
    queryKey: ["home-polls"],
    queryFn: async () => {
      try {
        return await listHomePolls();
      } catch (e) {
        console.error("[home-polls]", e);
        return [] as HomePoll[];
      }
    },
    staleTime: 30_000,
    enabled: hydrated,
  });

  const polls = data ?? [];
  if (!hydrated) return null;
  if (polls.length === 0 && !asPage) return null;

  async function onVote(pollId: string, optionId: string) {
    if (!signedIn || busy) return;
    setBusy(pollId);
    setErr(null);
    try {
      const next = await vote({ data: { pollId, optionId } });
      qc.setQueryData(["home-polls"], next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : isAf ? "Kon nie stem nie" : "Could not vote");
    } finally {
      setBusy(null);
    }
  }

  async function onAdd(pollId: string) {
    const label = (drafts[pollId] ?? "").trim();
    if (!signedIn || busy || label.length < 3) return;
    setBusy(pollId);
    setErr(null);
    try {
      const next = await addOpt({ data: { pollId, label } });
      qc.setQueryData(["home-polls"], next);
      setDrafts((d) => ({ ...d, [pollId]: "" }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : isAf ? "Kon nie byvoeg nie" : "Could not add option");
    } finally {
      setBusy(null);
    }
  }

  const Heading = asPage ? "h1" : "h2";

  return (
    <section id="polls" className="scroll-mt-24 border-b-2 border-ink bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="font-display text-sm tracking-widest text-primary">
            {isAf ? "KLUB-PEILINGS" : "CLUB POLLS"}
          </span>
        </div>
        <Heading className="font-display text-3xl tracking-wide sm:text-4xl">
          {isAf ? "Klub-peilings" : "Club polls"}
        </Heading>
        <p className="mt-1 text-sm text-ink/70">
          {isAf
            ? "Een keuse per peiling. Jy kan jou stem later verander."
            : "One choice per poll. You can change your vote later."}
        </p>

        {err && (
          <p className="mt-3 rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
            {err}
          </p>
        )}

        {polls.length === 0 ? (
          <p className="mt-6 text-sm text-ink/60">
            {isAf ? "Geen oop peilings tans nie." : "No open polls right now."}
          </p>
        ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              isAf={isAf}
              signedIn={signedIn}
              busy={busy === poll.id}
              draft={drafts[poll.id] ?? ""}
              onDraft={(v) => setDrafts((d) => ({ ...d, [poll.id]: v }))}
              onVote={(optionId) => void onVote(poll.id, optionId)}
              onAdd={() => void onAdd(poll.id)}
            />
          ))}
        </div>
        )}
      </div>
    </section>
  );
}

function PollCard({
  poll,
  isAf,
  signedIn,
  busy,
  draft,
  onDraft,
  onVote,
  onAdd,
}: {
  poll: HomePoll;
  isAf: boolean;
  signedIn: boolean;
  busy: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onVote: (optionId: string) => void;
  onAdd: () => void;
}) {
  const title = isAf && poll.title_af ? poll.title_af : poll.title_en;
  const question = isAf && poll.question_af ? poll.question_af : poll.question_en;
  const max = Math.max(1, ...poll.options.map((o) => o.vote_count));
  const total = poll.options.reduce((s, o) => s + o.vote_count, 0);

  return (
    <div className="rounded-xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{title}</p>
      <h3 className="mt-1 font-display text-2xl leading-tight text-ink">{question}</h3>
      <p className="mt-1 text-xs text-ink/55">
        {total} {isAf ? (total === 1 ? "stem" : "stemme") : total === 1 ? "vote" : "votes"}
      </p>

      <ul className="mt-4 space-y-2">
        {poll.options.map((o) => {
          const label = isAf && o.label_af ? o.label_af : o.label_en;
          const mine = poll.my_vote_option_id === o.id;
          const pct = Math.round((o.vote_count / max) * 100);
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={!signedIn || busy}
                onClick={() => onVote(o.id)}
                aria-pressed={mine}
                className={`relative block w-full overflow-hidden rounded-md border-2 px-3 py-2 text-left text-sm ${
                  mine
                    ? "border-primary bg-primary/10 font-bold"
                    : "border-ink bg-paper hover:bg-ink/5"
                } disabled:cursor-not-allowed disabled:hover:bg-paper`}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-primary/15"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center justify-between gap-3">
                  <span>
                    {label}
                    {mine ? (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {isAf ? "Jou stem" : "Your vote"}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-ink/70">{o.vote_count}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {!signedIn && (
        <Link
          to="/auth"
          className="mt-4 inline-flex items-center rounded-md border-2 border-ink bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          {isAf ? "Meld aan om te stem" : "Sign in to vote"}
        </Link>
      )}

      {signedIn && poll.can_add_option && (
        <div className="mt-4 flex gap-2">
          <input
            value={draft}
            maxLength={80}
            onChange={(e) => onDraft(e.target.value)}
            placeholder={isAf ? "Voeg ’n opsie by…" : "Add an option…"}
            className="min-w-0 flex-1 rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={busy || draft.trim().length < 3}
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAf ? "Voeg by" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
