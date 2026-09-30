-- Policy DELETE manquante sur comments : l'auteur peut supprimer son commentaire.
-- Requis maintenant que l'API utilise des clients scopés utilisateur (RLS appliqué).

create policy "Comment authors can delete own comments"
  on public.comments for delete
  using (auth.uid() = author_id);
