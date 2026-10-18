import Link from 'next/link';
export function AccountPicker({accounts,selected,path}:{accounts:{id:string;username:string|null;disconnectedAt:Date|null}[];selected:string;path:string}) {
 return <nav aria-label="Choose Instagram account" className="flex flex-wrap items-center gap-2"><span className="text-sm text-[var(--color-muted)]">Account:</span>{accounts.map(account=><Link key={account.id} href={`${path}?account=${account.id}`} aria-current={account.id===selected?'page':undefined} className={`btn ${account.id===selected?'btn-primary':'btn-quiet'}`}>@{account.username ?? 'Instagram account'}{account.disconnectedAt?' · reconnect needed':''}</Link>)}</nav>;
}
