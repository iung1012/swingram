-- =========================================================
-- CHAT: mídia em mensagens + read receipts + correções de RLS
-- O bucket "chat_media" e suas policies de storage já existem.
-- =========================================================

-- 1) COLUNAS DE MÍDIA EM MESSAGES
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_path TEXT,
  ADD COLUMN IF NOT EXISTS media_kind TEXT;

-- body deixa de ser obrigatório (mensagem pode ser só-mídia),
-- mas a mensagem não pode ser totalmente vazia.
ALTER TABLE public.messages ALTER COLUMN body DROP NOT NULL;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_present;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_present
  CHECK (
    (body IS NOT NULL AND length(btrim(body)) > 0)
    OR media_path IS NOT NULL
  );

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_media_kind_chk;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_media_kind_chk
  CHECK (media_kind IS NULL OR media_kind IN ('image', 'video'));

-- 2) DELETE DA PRÓPRIA MENSAGEM
-- A policy anterior ("msg delete staff") só permitia staff, então o botão
-- "Excluir" do autor falhava silenciosamente. Passa a permitir o autor.
DROP POLICY IF EXISTS "msg delete staff" ON public.messages;
DROP POLICY IF EXISTS "msg delete own or staff" ON public.messages;
CREATE POLICY "msg delete own or staff" ON public.messages FOR DELETE
  USING (auth.uid() = sender_id OR public.is_staff(auth.uid()));

-- 3) DELETE DA CONVERSA POR UM PARTICIPANTE
-- Não havia policy de DELETE em conversations (botão "Excluir conversa" era inócuo).
DROP POLICY IF EXISTS "conv delete participant" ON public.conversations;
CREATE POLICY "conv delete participant" ON public.conversations FOR DELETE
  USING (auth.uid() IN (user_a, user_b) OR public.is_staff(auth.uid()));

-- 4) READ RECEIPTS
-- A policy de UPDATE só deixa o autor alterar a própria mensagem, então o
-- destinatário não conseguiria marcar read_at. Função SECURITY DEFINER restrita
-- a marcar como lidas apenas as mensagens recebidas pelo chamador.
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND auth.uid() IN (c.user_a, c.user_b)
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  UPDATE public.messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id <> auth.uid()
    AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(UUID) TO authenticated;
