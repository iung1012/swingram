# Plano v2 — Rede Social Adulta +18

Stack: **TanStack Start + Tailwind + shadcn + Supabase externo (você conecta)**. Mapa via conector **Google Maps**. Sem monetização agora (schema preparado). Sem Casa de Swing no MVP.

> **Aviso honesto**: você pediu "tudo de uma vez". Vou entregar tudo no escopo abaixo num único build, mas algumas peças avançadas (watermark dinâmico no servidor, screenshot detection, PhotoDNA, push notification real, KYC com liveness, anti-bot ML, reverse image search) **exigem serviços externos ou app nativo** e ficam como **stubs preparados** — interface pronta, integração real entra quando você contratar/decidir o provedor.

## 0. Pré-requisitos (você)
- Criar projeto Supabase próprio e me passar credenciais (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- Conectar Google Maps quando eu pedir

## 1. Schema (Postgres / Supabase)

```text
profiles            user_id, handle(@ único, lowercase), display_name, bio,
                    avatar_url, profile_type(single_m|single_f|single_nb|couple_mm|couple_ff|couple_mf),
                    interests[], birth_date, gender_seeking[],
                    city, lat_snap, lng_snap  -- grid 500m + offset aleatório fixo por user
                    share_location(bool), invisible_mode(bool),
                    nsfw_blur_default(bool), verified(bool), verified_at,
                    trust_score(int), created_at, last_seen_at

user_roles          user_id, role(admin|moderator|support|user)   [tabela separada]
user_2fa            user_id, totp_secret (criptografado), enabled, backup_codes[]

couple_links        id, user_a_id, user_b_id, status(pending|active|dissolved),
                    confirmed_at  -- AMBOS precisam aceitar

verification_requests  user_id, doc_front_url, doc_back_url, selfie_url,
                       status(pending|approved|rejected), reviewed_by,
                       reviewed_at, notes, retention_expires_at

posts               id, user_id, caption, nsfw(bool),
                    moderation_status(pending|approved|rejected),
                    created_at, deleted_at
post_media          post_id, url, width, height, order, ai_labels(jsonb null)
age_consent_records post_id, attestation_text, attestation_version, ip, ua, created_at
content_hashes      hash, reason(ncii|csam|spam), blocked_at  -- bloqueia reupload

likes               post_id, user_id  (animação fogo 🔥)
comments            id, post_id, user_id, body, status, created_at
saves               post_id, user_id

interests_sent      from_user, to_user, status(pending|accepted|rejected), created_at
conversations       id, user_a, user_b, unlocked(bool), created_at
messages            id, conversation_id, sender_id, body, status(sent|moderated|removed),
                    created_at, read_at

reports             id, reporter_id, target_type(user|post|comment|message|chat),
                    target_id, reason, details, status, handled_by, created_at
blocks              user_id, blocked_user_id, created_at
shadow_bans         user_id, reason, created_at

banners             id, image_url, link, position, active, order, created_at
audit_logs          id, admin_id, action, target_type, target_id, ip, payload(jsonb), created_at
proximity_pings     user_id, other_user_id, created_at  -- evita spam de alerta
moderation_queue    id, item_type(post|comment|message|verification), item_id,
                    status, priority, created_at

-- Preparado para futuro:
subscriptions       id, user_id, plan, status, processor_ref, renews_at, canceled_at
transactions        id, user_id, type, amount_cents, processor, status, created_at
private_albums      id, owner_id, name, unlock_mode(manual|match|paid)
album_access        album_id, viewer_id, granted_at
stories             id, user_id, media_url, expires_at  -- (apenas tabela, UI fase 2)
safety_checkins     id, user_id, meeting_with_id, location, trusted_contact, expires_at
```

RLS em tudo. Roles via `has_role(uuid, app_role)` SECURITY DEFINER. Storage buckets: `avatars` (público), `posts` (público), `verification` (privado, URL assinada só pro admin), `chat_media` (privado).

## 2. Auth & Verificação 18+

- Email/senha + Google OAuth (broker Lovable)
- **2FA TOTP** opcional (qrcode + códigos backup)
- Signup exige `birth_date` → bloqueia <18
- Modal disclaimer NSFW obrigatório no primeiro acesso, aceite versionado em `audit_logs`
- Onboarding wizard: tipo de perfil → @handle único → fotos → bio → interesses → cidade/localização → verificação
- **Vínculo de casal**: usuário convida outro pelo @, o convidado aceita, **ambos precisam estar verificados** antes do casal ficar `active`
- Página `/verificar`: upload RG/CNH (frente/verso) + selfie segurando documento → bucket privado → fila admin
- Selo "Verificado" + `trust_score` (verificação + tempo de conta - denúncias)

## 3. Feed, posts e interações

- Criar post: 1-10 fotos + descrição + toggle NSFW + checkbox "afirmo que sou maior e tenho consentimento dos retratados" (grava em `age_consent_records`)
- **Toda mídia entra com `moderation_status=pending`** → fila no painel admin → só aparece após aprovação
- Home com abas **Recomendações** (compatibilidade por interesses + proximidade) e **Todos** (cronológico)
- NSFW → blur por padrão, clique revela; preferência por usuário desliga o blur
- **Curtida fogo 🔥**: ícone com animação rápida (scale + 3 partículas subindo), contador
- Comentários (modera por denúncia), salvar
- Perfil: grid de posts, bio, selo, contadores, botões "Tenho interesse" / "Mensagem" (após aceite) / "Bloquear" / "Denunciar"

## 4. Busca, Mapa, Proximidade

- Busca por @, nome, cidade, tipo de perfil, interesses
- Filtro raio (5/10/25/50 km)
- **Mapa Google Maps**: pins em `lat_snap`/`lng_snap` (snap em grid de ~500m + offset aleatório por usuário, salvo na criação — nunca posição real)
- Modo invisível: usuário some do mapa mas continua vendo outros
- Alerta de proximidade compatível: server function checa periodicamente; toast in-app quando match + ≤ raio configurado + sem ping nas últimas 24h (`proximity_pings`)
- Rate limit: posição atualiza no máx 1x a cada 10 min

## 5. Interesse + Chat

- "Tenho interesse" → `interests_sent` pending
- Destinatário vê inbox de interesses; aceita → cria `conversation` com `unlocked=true`
- **Super chat liberado só após aceite mútuo + ambos verificados**
- Realtime via Supabase channels
- **Bloqueio anti-golpe** em contas <7 dias ou não verificadas: regex bloqueia telefones, links e palavras como "whats/telegram/instagram" no chat (com aviso)
- Lista de conversas, não-lidas, denunciar mensagem

## 6. Denúncias & Moderação (usuário)

- Botão denunciar em: usuário, post, comentário, mensagem (motivo: spam/abuso/perfil falso/menor/NCII/outro)
- Bloquear usuário (sumiço total mútuo)
- **Denúncia de "menor de idade" tem prioridade máxima** na fila e bloqueia o conteúdo automaticamente até revisão

## 7. Painel Admin (RBAC)

Acesso por role; **moderator NÃO vê documentos de verificação** (só admin):

- **Dashboard**: usuários, posts pendentes, denúncias por prioridade, verificações pendentes
- **Verificações**: fila com preview (URL assinada), aprovar/rejeitar com nota
- **Posts pendentes**: aprovar/rejeitar/banir autor; hash da mídia rejeitada vai pra `content_hashes`
- **Denúncias**: fila ordenada por severidade, ações: ignorar / remover conteúdo / shadow ban / banir / suspender
- **Usuários**: buscar, ver perfil completo, aprovar/banir/desverificar/forçar logout
- **Chat**: ver mensagens reportadas com contexto
- **Banners**: CRUD (upload, link, posição, ordem, ativo)
- **Audit log**: toda ação admin gravada (quem, o quê, IP, quando)
- **Shadow ban**: usuário continua usando, mas posts/mensagens não aparecem pra ninguém

## 8. Segurança & Privacidade

- 2FA TOTP, sessão revogável
- Documentos em bucket privado, URL assinada por 5 min, só admin
- LGPD: página de privacidade, exportar dados, deletar conta (soft delete 30 dias)
- Aceite de termos versionado
- `<meta name="robots" content="noindex">` por padrão (decisão sua depois)
- Audit log de toda ação sensível
- Server-side validation (Zod) em tudo

## 9. O que fica como STUB (interface pronta, integração depois)

| Stub | Por quê |
|---|---|
| Moderação por IA de imagem | Você escolheu humana 100% — fica fácil ligar Gemini depois |
| PhotoDNA (CSAM) | Microsoft exige NDA |
| Watermark dinâmico com @viewer | Precisa de pipeline server-side de imagem, faço em build futuro |
| Screenshot detection | Só funciona em app nativo |
| Push notification real | Precisa PWA + VAPID (faço quando você pedir) |
| KYC com liveness | Provedor pago (Idwall/Stripe Identity) |
| Reverse image search | TinEye/Google Vision pagos |
| Pagamento (CCBill/Segpay) | Você precisa contratar |
| Stories, álbuns privados, casas de swing, safety check-in, monetização | Schema preparado, UI em builds futuros |

## 10. Ordem de execução do build

1. Schema completo + RLS + roles + storage buckets
2. Auth + 2FA + signup gate 18+ + disclaimer
3. Onboarding + perfil + @ único + casal vinculado
4. Verificação (upload + fila admin)
5. Posts + feed + curtida fogo + comentários + saves
6. Busca + mapa + proximidade
7. Interesse + chat realtime + anti-golpe
8. Denúncias + bloqueio
9. Painel admin completo (RBAC + audit)
10. Polimento, dark mode, mobile-first, meta tags

## Avisos finais
- Sem moderação por IA, **você vai precisar revisar manualmente cada post** antes de aparecer. Em dezenas de uploads/dia isso já vira gargalo.
- Vou usar Supabase externo: você me passa as 3 envs (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) via add_secret quando começarmos.
- Hospedagem padrão Lovable (Cloudflare) aceita por enquanto, mas para produção séria você vai migrar pra host adult-friendly.
- Push real, screenshot detection e watermark exigem PWA/native + infra específica — quando quiser, abrimos build separado.

Aprova esse plano que eu começo pela etapa 1.