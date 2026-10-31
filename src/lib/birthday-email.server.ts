import { emailShell, escapeHtml, SITE_ORIGIN } from './email.server';

// Same verified sender already used by newsletter editions.
export const BIRTHDAY_FROM = 'Just Wheels <news@notify.justwheels.co.za>';

export interface BirthdayNotice {
  member_id: string;
  display_name: string | null;
  member_number: number | null;
  town: string | null;
  phone: string | null;
  favourite_ride: string | null;
  bio: string | null;
  birthday_day: number;
  birthday_month: number;
  recipient_email: string;
  recipient_lang: string | null;
  notice_date: string;
}

export function birthdayNoticeKey(notice: Pick<BirthdayNotice, 'member_id' | 'notice_date' | 'recipient_email'>) {
  return `birthday-${notice.member_id}-${notice.notice_date}-${notice.recipient_email.toLowerCase()}`;
}

export function buildBirthdayEmail(notice: BirthdayNotice) {
  const af = notice.recipient_lang === 'af';
  const name = notice.display_name || (af ? 'Klublid' : 'Club member');
  const subject = af ? `Verjaarsdag vandag: ${name}` : `Birthday today: ${name}`;
  const date = new Intl.DateTimeFormat(af ? 'af-ZA' : 'en-ZA', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, notice.birthday_month - 1, notice.birthday_day)));
  const details = [
    [af ? 'Naam' : 'Name', name],
    [af ? 'Lidnommer' : 'Member number', notice.member_number],
    [af ? 'Verjaarsdag' : 'Birthday', date],
    [af ? 'Dorp' : 'Town', notice.town],
    [af ? 'Telefoon' : 'Phone', notice.phone],
    [af ? 'Gunsteling wiele' : 'Favourite ride', notice.favourite_ride],
    [af ? 'Oor die lid' : 'About the member', notice.bio],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `<tr><th style="text-align:left;vertical-align:top;padding:6px 14px 6px 0">${escapeHtml(String(label))}</th><td style="padding:6px 0;white-space:pre-line">${escapeHtml(String(value))}</td></tr>`).join('');
  const intro = af ? `${name} verjaar vandag. Stuur gerus 'n verjaarsdagwens namens Just Wheels!` : `${name} celebrates a birthday today. Please send a birthday wish on behalf of Just Wheels!`;
  return { subject, html: emailShell(subject, `<p>${escapeHtml(intro)}</p><table style="border-collapse:collapse">${details}</table><p><a href="${SITE_ORIGIN}/admin/members">${af ? 'Maak ledebestuur oop' : 'Open member management'}</a></p>`) };
}