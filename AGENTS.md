<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep Concours question selection in the shared pure selector and reuse it for loading and submission; configured totals must not drift between paths.
- Insert member scores once rather than upserting; members have insert-own permissions, and completed votes are locked.
- Idle capture setup is keyed by event vehicle ID and saved with owner/admin checks before sensors start; never share setup fields between cars.
- Keep captured sensor results until saving succeeds so a network failure can be retried without recapturing.
