import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Brasa Swing" },
      { name: "description", content: "Termos de Uso da plataforma Brasa Swing. Leia as regras, diretrizes e condições de uso." },
      { property: "og:title", content: "Termos de Uso — Brasa Swing" },
      { property: "og:description", content: "Termos de Uso da plataforma Brasa Swing." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout
      title="Termos de Uso"
      lastUpdated="Última atualização: 8 de junho de 2026"
    >
      <p>
        Bem-vindo(a) ao <strong>Brasa Swing</strong>. Ao acessar, criar uma conta ou utilizar qualquer funcionalidade da plataforma, você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso. Caso não concorde, não utilize a plataforma.
      </p>

      <p>Ao se cadastrar na plataforma, você consente expressamente com:</p>
      <ul>
        <li>Todos os termos e condições aqui descritos;</li>
        <li>A coleta e uso de sua localização geográfica para funcionamento do aplicativo;</li>
        <li>A declaração de que possui 18 (dezoito) anos ou mais de idade;</li>
        <li>A Política de Privacidade do Brasa Swing;</li>
        <li>A assunção integral dos riscos decorrentes de interações com outros usuários.</li>
      </ul>

      <h2>1. Sobre o Brasa Swing</h2>
      <p>
        O Brasa Swing é uma plataforma digital de interação social destinada exclusivamente a maiores de 18 anos, permitindo a criação de perfis, visualização de usuários próximos em mapa, troca de mensagens, compartilhamento de conteúdos em feed e interações permitidas pelas Diretrizes da Comunidade, respeitados os limites legais e estes Termos.
      </p>

      <h2>2. Idade Mínima e Proibição para Menores</h2>
      <ul>
        <li><strong>2.1.</strong> O uso do Brasa Swing é <strong>exclusivo para maiores de 18 (dezoito) anos</strong>.</li>
        <li><strong>2.2.</strong> É <strong>expressamente proibido</strong> o acesso, cadastro ou uso por menores de idade.</li>
        <li><strong>2.3.</strong> Ao se cadastrar, o usuário declara, sob responsabilidade legal, que possui 18 anos completos ou mais.</li>
        <li><strong>2.4.</strong> O Brasa Swing poderá solicitar documentos para verificação de idade a qualquer momento.</li>
        <li><strong>2.5.</strong> Caso seja identificado uso por menor de idade, a conta será <strong>imediatamente encerrada</strong>, sem aviso prévio, e as autoridades competentes poderão ser notificadas.</li>
      </ul>

      <h2>3. Conteúdo Adulto, Espaços Públicos e Interações Privadas</h2>
      <p>
        <strong>3.1.</strong> O Brasa Swing é uma comunidade 18+ para conexões adultas, conversas privadas e interações consensuais. A classificação 18+ define o público da plataforma e não transforma perfis, publicações, comentários, chats públicos ou outras áreas públicas em espaços para conteúdo íntimo/sexual explícito, pornográfico ou ilegal.
      </p>
      <p>
        <strong>3.2.</strong> São permitidos perfis adultos, conversas consensuais, linguagem adulta moderada e fotos ou vídeos próprios ou autorizados, desde que:
      </p>
      <ul>
        <li>envolvam somente pessoas maiores de 18 anos;</li>
        <li>haja consentimento expresso de todas as pessoas retratadas;</li>
        <li>respeitem os limites de exposição pública definidos nestes Termos;</li>
        <li>não infrinjam estes Termos, as Diretrizes da Comunidade ou a lei brasileira.</li>
      </ul>
      <p><strong>3.3.</strong> Todo conteúdo publicado é de responsabilidade exclusiva do usuário que o enviou.</p>
      <p>
        <strong>3.4.</strong> Para apoiar a aplicação dessas regras, o Brasa Swing pode usar controles de visibilidade, filtros de mídia, denúncias, bloqueios, revisão humana e ferramentas automatizadas ou assistidas por IA para classificar, ocultar, remover ou encaminhar conteúdos para avaliação quando houver indícios de violação.
      </p>

      <h2>4. Conteúdo Proibido</h2>
      <p>É terminantemente proibido publicar, enviar ou divulgar no Brasa Swing, conforme o caso:</p>
      <ul>
        <li><strong>a)</strong> qualquer conteúdo envolvendo ou simulando crianças ou adolescentes, mesmo que fictício;</li>
        <li><strong>b)</strong> conteúdos íntimos sem consentimento (inclusive "revenge porn");</li>
        <li><strong>c)</strong> exploração sexual, violência, estupro, tráfico de pessoas ou crimes correlatos;</li>
        <li><strong>d)</strong> conteúdo íntimo/sexual explícito ou pornográfico em perfis, posts, comentários, chats públicos ou qualquer outra área pública;</li>
        <li><strong>e)</strong> conteúdos com contexto sexual envolvendo animais (zoofilia);</li>
        <li><strong>f)</strong> conteúdos ilegais, discriminatórios, de ódio ou que incentivem crimes;</li>
        <li><strong>g)</strong> violação de direitos autorais, direito de imagem ou privacidade de terceiros;</li>
        <li><strong>h)</strong> spam, publicidade não autorizada, golpes ou esquemas fraudulentos;</li>
        <li><strong>i)</strong> prostituição, comercialização de serviços sexuais ou qualquer atividade ilegal.</li>
      </ul>

      <h2>5. Proteção de Mídias e Conteúdo de Terceiros</h2>
      <p>É expressamente proibido aos usuários do Brasa Swing:</p>
      <ul>
        <li><strong>5.1.</strong> Copiar, baixar, salvar ou armazenar quaisquer fotos, vídeos, imagens ou outros conteúdos de mídia publicados por outros usuários;</li>
        <li><strong>5.2.</strong> Tirar capturas de tela (print screen) ou gravar a tela contendo mídias de outros usuários;</li>
        <li><strong>5.3.</strong> Utilizar ferramentas de terceiros, extensões de navegador ou qualquer outro meio técnico para extrair ou baixar conteúdos;</li>
        <li><strong>5.4.</strong> Redistribuir, compartilhar, revender ou publicar em qualquer outra plataforma conteúdos obtidos de outros usuários;</li>
        <li><strong>5.5.</strong> Criar cópias, arquivos ou backups de mídias que não sejam de sua própria autoria.</li>
      </ul>
      <p>
        A violação dessas regras pode resultar em banimento permanente da plataforma, além de responsabilização civil e criminal conforme a legislação brasileira, incluindo a Lei nº 12.965/2014 (Marco Civil da Internet) e a Lei nº 13.709/2018 (LGPD).
      </p>

      <h2>6. Funcionalidades da Plataforma</h2>
      <p>O Brasa Swing oferece as seguintes funcionalidades principais:</p>
      <ul>
        <li>Criar perfil público com foto, biografia e interesses;</li>
        <li>Visualizar usuários próximos no mapa interativo;</li>
        <li>Enviar e receber mensagens privadas;</li>
        <li>Criar posts com fotos e vídeos no feed público;</li>
        <li>Interagir com posts de outros usuários (curtidas, comentários);</li>
        <li>Verificação de conta para maior confiabilidade;</li>
        <li>Bloqueio de usuários indesejados;</li>
        <li>Denúncia de conteúdos e perfis inadequados.</li>
      </ul>

      <h2>7. Moderação e Sanções</h2>
      <ul>
        <li><strong>7.1.</strong> O Brasa Swing poderá remover conteúdos, limitar funcionalidades, suspender ou excluir contas que violem estes Termos ou a legislação brasileira, sem aviso prévio.</li>
        <li><strong>7.2.</strong> Usuários podem denunciar conteúdos ou perfis através das ferramentas do aplicativo.</li>
        <li><strong>7.3.</strong> A moderação pode incluir: advertência, remoção de conteúdo, suspensão temporária ou banimento permanente.</li>
        <li><strong>7.4.</strong> Decisões de moderação são finais e não geram direito a reembolso ou indenização.</li>
      </ul>

      <h2>8. Padrões de Segurança Infantil (Child Safety Standards)</h2>
      <ul>
        <li><strong>8.1.</strong> O Brasa Swing adota política de <strong>tolerância zero</strong> para exploração e abuso sexual infantil (CSAE) e material de abuso sexual infantil (CSAM), incluindo tentativa de aliciamento (grooming).</li>
        <li><strong>8.2.</strong> É estritamente proibido publicar, solicitar, compartilhar, armazenar, promover ou tentar distribuir qualquer conteúdo relacionado a CSAE/CSAM.</li>
        <li><strong>8.3.</strong> O aplicativo disponibiliza mecanismos in-app de feedback e denúncia por meio dos botões de denúncia de perfis/posts e também pelo canal de suporte.</li>
        <li><strong>8.4.</strong> Ponto de contato específico para segurança infantil: <strong>suporte@brasaswing.com.br</strong> (assunto recomendado: "Child Safety").</li>
        <li><strong>8.5.</strong> Ao identificar possível CSAM, o Brasa Swing poderá remover imediatamente o conteúdo, restringir ou encerrar a conta envolvida, preservar registros necessários e cooperar com autoridades competentes, conforme a lei.</li>
        <li><strong>8.6.</strong> O Brasa Swing declara cumprir as leis e regulações aplicáveis de proteção à criança e ao adolescente.</li>
      </ul>

      <h2>9. Isenção de Responsabilidade</h2>
      <p>O BRASA SWING É UMA PLATAFORMA DE CONEXÃO E NÃO SE RESPONSABILIZA POR:</p>
      <ul>
        <li><strong>9.1.</strong> Conteúdos publicados, enviados ou compartilhados por usuários;</li>
        <li><strong>9.2.</strong> Veracidade das informações fornecidas pelos usuários em seus perfis;</li>
        <li><strong>9.3.</strong> Comportamento, ações ou omissões de usuários dentro ou fora da plataforma;</li>
        <li><strong>9.4.</strong> <strong>Encontros presenciais</strong> entre usuários, incluindo quaisquer danos físicos, emocionais, materiais ou morais decorrentes;</li>
        <li><strong>9.5.</strong> Golpes, fraudes, extorsões ou qualquer conduta ilícita praticada por usuários;</li>
        <li><strong>9.6.</strong> Vazamento de conteúdos íntimos por terceiros;</li>
        <li><strong>9.7.</strong> Danos decorrentes de relações iniciadas através da plataforma;</li>
        <li><strong>9.8.</strong> Falhas técnicas, indisponibilidade temporária ou perda de dados;</li>
        <li><strong>9.9.</strong> Ações de terceiros que acessem a conta do usuário por negligência deste.</li>
      </ul>
      <p>O usuário reconhece que utiliza a plataforma por sua conta e risco, assumindo integralmente a responsabilidade por suas interações e encontros com outros usuários.</p>

      <h2>10. Recomendações de Segurança</h2>
      <p>O Brasa Swing recomenda fortemente que os usuários:</p>
      <ul>
        <li><strong>a)</strong> Verifiquem a identidade de outros usuários antes de encontros presenciais;</li>
        <li><strong>b)</strong> Realizem primeiros encontros em locais públicos e movimentados;</li>
        <li><strong>c)</strong> Informem pessoas de confiança sobre encontros marcados;</li>
        <li><strong>d)</strong> Não compartilhem informações financeiras ou senhas;</li>
        <li><strong>e)</strong> Denunciem comportamentos suspeitos ou abusivos;</li>
        <li><strong>f)</strong> Confiem em seus instintos e abandonem situações desconfortáveis.</li>
      </ul>

      <h2>11. Garantias e Limitações</h2>
      <ul>
        <li><strong>11.1.</strong> O Brasa Swing é fornecido "COMO ESTÁ" e "CONFORME DISPONÍVEL", sem garantias de qualquer tipo, expressas ou implícitas.</li>
        <li><strong>11.2.</strong> O Brasa Swing não garante que o serviço será ininterrupto, seguro, livre de erros ou que atenderá a expectativas específicas do usuário.</li>
        <li><strong>11.3.</strong> O Brasa Swing não garante resultados específicos, como encontrar parceiros, fazer conexões ou obter qualquer resultado particular do uso da plataforma.</li>
        <li><strong>11.4.</strong> Em nenhuma circunstância a responsabilidade total do Brasa Swing perante o usuário excederá o valor pago pelo usuário nos últimos 12 meses de uso do serviço, ou R$ 100,00 (cem reais), o que for maior.</li>
      </ul>

      <h2>12. Indenização</h2>
      <p>
        <strong>12.1.</strong> O usuário concorda em indenizar, defender e isentar o Brasa Swing, seus administradores, funcionários, parceiros e prestadores de serviço de quaisquer reclamações, perdas, danos, custos ou despesas (incluindo honorários advocatícios) decorrentes de:
      </p>
      <ul>
        <li>Violação destes Termos de Uso pelo usuário;</li>
        <li>Conteúdo publicado ou compartilhado pelo usuário;</li>
        <li>Conduta do usuário na plataforma ou em encontros presenciais;</li>
        <li>Violação de direitos de terceiros pelo usuário;</li>
        <li>Uso indevido da plataforma pelo usuário.</li>
      </ul>

      <h2>13. Direitos Autorais e Licença</h2>
      <p>
        Ao publicar conteúdo no Brasa Swing, o usuário declara possuir todos os direitos necessários e concede ao aplicativo uma licença gratuita, não exclusiva e mundial para exibição e distribuição dentro da plataforma.
      </p>

      <h2>14. Uso de Localização</h2>
      <ul>
        <li><strong>14.1.</strong> O Brasa Swing utiliza a localização geográfica do usuário para exibir perfis de pessoas próximas, calcular distâncias e permitir a visualização em mapa.</li>
        <li><strong>14.2.</strong> A coleta de localização depende da autorização expressa do usuário no dispositivo. Sem essa permissão, a localização por IP será utilizada como alternativa.</li>
        <li><strong>14.3.</strong> O usuário pode desativar a localização a qualquer momento nas configurações do dispositivo, ciente de que isso afetará a experiência de uso.</li>
        <li><strong>14.4.</strong> A localização é armazenada de forma segura e utilizada exclusivamente para as finalidades descritas nestes Termos e na Política de Privacidade.</li>
      </ul>

      <h2>15. Privacidade e Dados</h2>
      <p>
        O tratamento de dados pessoais seguirá a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018). Informações detalhadas constam na <Link to="/privacy">Política de Privacidade</Link> do Brasa Swing.
      </p>

      <h2>16. Alterações dos Termos</h2>
      <p>
        O Brasa Swing poderá atualizar estes Termos a qualquer momento. O uso contínuo do aplicativo após alterações implica aceitação automática da versão atualizada. Alterações significativas serão comunicadas através do aplicativo.
      </p>

      <h2>17. Disposições Gerais</h2>
      <ul>
        <li><strong>17.1.</strong> A invalidade de qualquer disposição destes Termos não afetará a validade das demais.</li>
        <li><strong>17.2.</strong> A tolerância do Brasa Swing quanto a eventuais violações não implica renúncia ao direito de exigir o cumprimento dos Termos.</li>
        <li><strong>17.3.</strong> Estes Termos constituem o acordo integral entre o usuário e o Brasa Swing.</li>
      </ul>

      <h2>18. Legislação e Foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil, ficando eleito o foro da comarca da capital do estado de São Paulo – SP, com renúncia a qualquer outro, por mais privilegiado que seja.
      </p>
    </LegalLayout>
  );
}

import { Link } from "@tanstack/react-router";
