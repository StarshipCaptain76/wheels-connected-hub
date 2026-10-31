import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMemberBirthday, saveMemberBirthday } from '@/lib/member-birthday.functions';
import { useI18n } from '@/i18n/I18nProvider';

export function MemberBirthdayField({ userId }: { userId?: string }) {
  const { lang } = useI18n();
  const load = useServerFn(getMemberBirthday);
  const save = useServerFn(saveMemberBirthday);
  const query = useQuery({ queryKey: ['member-birthday', userId ?? 'me'], queryFn: () => load({ data: { userId } }) });
  const [day, setDay] = useState(''); const [month, setMonth] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { setDay(query.data ? String(query.data.day) : ''); setMonth(query.data ? String(query.data.month) : ''); }, [query.data]);
  async function submit() {
    setBusy(true); setMessage('');
    try {
      await save({ data: { userId, birthday: day || month ? { day: Number(day), month: Number(month) } : null } });
      await query.refetch(); setMessage(lang === 'af' ? 'Verjaarsdag gestoor' : 'Birthday saved');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save birthday.'); }
    finally { setBusy(false); }
  }
  return <div className="my-3 space-y-2 text-ink">
    <p className="text-xs font-bold uppercase">{lang === 'af' ? 'Verjaarsdag · slegs jy en klubadmins' : 'Birthday · only you and club admins'}</p>
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">{lang === 'af' ? 'Dag' : 'Day'}<input aria-label={lang === 'af' ? 'Verjaarsdag dag' : 'Birthday day'} type="number" min={1} max={31} value={day} onChange={e => setDay(e.target.value)} className="mt-1 block w-20 rounded border-2 border-ink bg-paper px-2 py-2" /></label>
      <label className="text-xs">{lang === 'af' ? 'Maand' : 'Month'}<select aria-label={lang === 'af' ? 'Verjaarsdag maand' : 'Birthday month'} value={month} onChange={e => setMonth(e.target.value)} className="mt-1 block rounded border-2 border-ink bg-paper px-2 py-2">
        <option value="">—</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1)))}</option>)}
      </select></label>
      <Button type="button" disabled={busy || query.isLoading || query.isError} onClick={() => void submit()}><Save className="mr-2 h-4 w-4" />{lang === 'af' ? 'Stoor verjaarsdag' : 'Save birthday'}</Button>
    </div>
    {query.isError && <p className="text-xs text-primary">{lang === 'af' ? 'Kon nie verjaarsdag laai nie.' : 'Could not load birthday.'}</p>}
    {message && <p className="text-xs" role="status">{message}</p>}
  </div>;
}