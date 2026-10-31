import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Trophy } from 'lucide-react';
import { getMemberCompetitionLeaders, getPublicCompetitionLeaders } from '@/lib/competition-leaders.functions';
import { concoursImageUrl } from '@/lib/event-image-url';
import { formatConcoursScore } from '@/lib/concours-score';
import { useI18n } from '@/i18n/I18nProvider';

export function LiveCompetitionLeaders({ eventId, signedIn }: { eventId: string; signedIn: boolean }) {
  const { lang } = useI18n();
  const member = useServerFn(getMemberCompetitionLeaders);
  const publicRead = useServerFn(getPublicCompetitionLeaders);
  const query = useQuery({ queryKey: ['competition-leaders', eventId, signedIn],
    queryFn: () => signedIn ? member({ data: { eventId } }) : publicRead({ data: { eventId } }),
    refetchInterval: 10_000, staleTime: 0 });
  if (query.isError) return <p className="mt-5 text-sm">{lang === 'af' ? 'Regstreekse tellings tydelik onbeskikbaar.' : 'Live scores temporarily unavailable.'}</p>;
  if (!query.data?.length) return null;
  return <div className="mt-6 border-t border-current/30 pt-4" aria-live="polite">
    <p className="flex items-center gap-2 text-xs font-bold uppercase"><Trophy className="h-4 w-4" />{lang === 'af' ? 'Regstreekse voorlopers' : 'Live leaders'}</p>
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {query.data.map(leader => <div key={leader.competition} className="flex min-w-0 items-center gap-3">
        <img src={concoursImageUrl(leader.vehicleId)} alt={leader.label} className="h-20 w-24 shrink-0 rounded object-cover" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase">{leader.competition === 'idle' ? 'Rolls-Royce Start & Idle' : 'Concours Mini'}</p>
          <p className="break-words font-display text-2xl">{lang === 'af' ? leader.labelAf || leader.label : leader.label}</p>
          <p className="text-sm font-bold">{formatConcoursScore(leader.score)} / 10 · {leader.submissionCount} {leader.competition === 'idle' ? (lang === 'af' ? 'toetse' : 'runs') : (lang === 'af' ? 'stemme' : 'votes')}</p>
          {leader.tiedCount > 1 && <p className="text-xs">{lang === 'af' ? 'Loting tussen gelyke beste tellings' : 'Recorded draw between tied best scores'}</p>}
          <p className="text-xs">{lang === 'af' ? 'Voorlopig · beoordeling duur voort' : 'Provisional · judging continues'}</p>
        </div>
      </div>)}
    </div>
  </div>;
}