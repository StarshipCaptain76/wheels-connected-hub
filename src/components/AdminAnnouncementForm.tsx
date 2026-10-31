import { useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendMemberAnnouncement } from '@/lib/announcements.functions';
import { useI18n } from '@/i18n/I18nProvider';

const inputClass = 'mt-1 w-full rounded border-2 border-ink/30 bg-paper px-3 py-2 text-sm text-ink';
export function AdminAnnouncementForm() {
  const { lang } = useI18n(); const af = lang === 'af';
  const send = useServerFn(sendMemberAnnouncement); const qc = useQueryClient();
  const [titleEn, setTitleEn] = useState(''); const [bodyEn, setBodyEn] = useState('');
  const [titleAf, setTitleAf] = useState(''); const [bodyAf, setBodyAf] = useState('');
  const [confirming, setConfirming] = useState(false); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  async function submit() {
    if (busy) return;
    const fingerprint = JSON.stringify({ titleEn, bodyEn, titleAf, bodyAf });
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() };
    const requestId = pending.current.id;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await send({ data: { requestId, titleEn, bodyEn, titleAf, bodyAf } });
      setMessage(af ? `Gestuur aan ${result.sent} lede.` : `Sent to ${result.sent} members.`);
      setTitleEn(''); setBodyEn(''); setTitleAf(''); setBodyAf(''); setConfirming(false); pending.current = null;
      await qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send announcement.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 border-t-2 border-ink pt-5">
    <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><Megaphone className="h-5 w-5 text-primary" />{af ? 'Lede-aankondiging' : 'Member announcement'}</h2>
    <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); setConfirming(true); setMessage(''); setError(''); }}>
      <fieldset disabled={busy || confirming} className="space-y-3 disabled:opacity-70">
        <label className="block text-xs font-bold text-ink">Title (English)<input required maxLength={120} value={titleEn} onChange={e => setTitleEn(e.target.value)} className={inputClass} /></label>
        <label className="block text-xs font-bold text-ink">Message (English)<textarea required maxLength={2000} rows={4} value={bodyEn} onChange={e => setBodyEn(e.target.value)} className={inputClass} /></label>
        <details><summary className="cursor-pointer text-xs font-bold text-ink">Afrikaans ({af ? 'opsioneel' : 'optional'})</summary>
          <label className="mt-3 block text-xs font-bold text-ink">Titel<input maxLength={120} value={titleAf} onChange={e => setTitleAf(e.target.value)} className={inputClass} /></label>
          <label className="mt-3 block text-xs font-bold text-ink">Boodskap<textarea maxLength={2000} rows={4} value={bodyAf} onChange={e => setBodyAf(e.target.value)} className={inputClass} /></label>
        </details>
      </fieldset>
      {!confirming && <Button type="submit" disabled={busy || !titleEn.trim() || !bodyEn.trim()}><Send className="mr-2 h-4 w-4" />{af ? 'Stuur aan alle lede' : 'Send to all members'}</Button>}
      {confirming && <div className="space-y-3 border-l-4 border-primary pl-3">
        <p className="text-sm font-bold text-ink">{af ? 'Stuur hierdie aankondiging aan alle aktiewe klubleden?' : 'Send this announcement to all active club members?'}</p>
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={() => void submit()}><Send className="mr-2 h-4 w-4" />{busy ? (af ? 'Stuur…' : 'Sending…') : (af ? 'Bevestig en stuur' : 'Confirm and send')}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>{af ? 'Kanselleer' : 'Cancel'}</Button></div>
      </div>}
      {error && <p role="alert" className="text-sm text-primary">{error}</p>}
      {message && <p role="status" className="text-sm font-bold text-ink">{message}</p>}
    </form>
  </section>;
}