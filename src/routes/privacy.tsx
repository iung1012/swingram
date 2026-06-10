import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Brasa Swing" },
      { name: "description", content: "Política de Privacidade da plataforma Brasa Swing. Saiba como seus dados são coletados, usados e protegidos." },
      { property: "og:title", content: "Política de Privacidade — Brasa Swing" },
      { property: "og:description", content: "Política de Privacidade da plataforma Brasa Swing." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout
      title="Política de Privacidade"
      lastUpdated="Última atualização: 8 de junho de 2026"
    >
      <p>
        A presente Política de Privacidade descreve como o <strong>Brasa Swing</strong> coleta, utiliza, armazena, compartilha e protege os dados pessoais de seus usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).
      </p>

      <p>Ao utilizar o Brasa Swing, você declara estar ciente e de acordo com esta Política.</p>

      <h2>1. Quem Somos (Controlador de Dados)</h2>
      <p>
        O Brasa Swing é uma plataforma digital de interação social destinada exclusivamente a maiores de 18 anos, permitindo a criação de perfis, visualização de usuários próximos, troca de mensagens e compartilhamento de conteúdos permitidos pelos Termos de Uso e pelas Diretrizes da Comunidade.
      </p>
      <p><strong>Controlador:</strong> Brasa Swing</p>
      <p><strong>Contato do Encarregado (DPO):</strong> suporte@brasaswing.com.br</p>
      <p><strong>Contato de Segurança Infantil (Child Safety):</strong> suporte@brasaswing.com.br</p>

      <h2>2. Dados Coletados</h2>
      <p>O Brasa Swing pode coletar os seguintes dados:</p>

      <h3>2.1. Dados fornecidos pelo usuário</h3>
      <ul>
        <li>Nome ou apelido</li>
        <li>E-mail</li>
        <li>Data de nascimento</li>
        <li>Gênero e preferências</li>
        <li>Foto(s) de perfil</li>
        <li>Biografia e informações do perfil público</li>
        <li>Conteúdos enviados (mensagens, fotos, vídeos, posts)</li>
        <li>Interesses e tags de perfil</li>
        <li>Documentos para verificação de identidade</li>
      </ul>

      <h3>2.2. Dados coletados automaticamente</h3>
      <ul>
        <li>Endereço IP</li>
        <li>Informações do dispositivo e navegador</li>
        <li>Sistema operacional</li>
        <li>Localização aproximada ou precisa (quando autorizada)</li>
        <li>Registros de acesso e uso da plataforma</li>
        <li>Data e hora de acessos</li>
        <li>Páginas visitadas e ações realizadas</li>
        <li>Token de notificações push</li>
      </ul>

      <h2>3. Bases Legais para Tratamento (LGPD)</h2>
      <p>O tratamento de dados pessoais no Brasa Swing é fundamentado nas seguintes bases legais:</p>
      <ul>
        <li><strong>Consentimento (Art. 7º, I):</strong> Coleta de localização precisa, envio de notificações push, uso de cookies não essenciais.</li>
        <li><strong>Execução de Contrato (Art. 7º, V):</strong> Criação de conta, funcionamento do serviço, suporte ao usuário.</li>
        <li><strong>Legítimo Interesse (Art. 7º, IX):</strong> Prevenção de fraudes, segurança da plataforma, melhorias do serviço, análises estatísticas anonimizadas.</li>
        <li><strong>Cumprimento de Obrigação Legal (Art. 7º, II):</strong> Retenção de registros de acesso (Marco Civil da Internet), atendimento a ordens judiciais.</li>
      </ul>

      <h2>4. Finalidade do Uso dos Dados</h2>
      <p>Os dados pessoais são utilizados para:</p>
      <ul>
        <li>Criar e gerenciar contas de usuário</li>
        <li>Permitir interação entre usuários</li>
        <li>Exibir usuários próximos e visualização em mapa</li>
        <li>Enviar notificações sobre atividades na plataforma</li>
        <li>Garantir segurança, prevenção de fraudes e abusos</li>
        <li>Verificar idade e identidade dos usuários</li>
        <li>Moderar conteúdos e aplicar os Termos de Uso</li>
        <li>Cumprir obrigações legais e regulatórias</li>
        <li>Melhorar a experiência do usuário</li>
        <li>Gerar estatísticas anonimizadas sobre uso da plataforma</li>
      </ul>

      <h2>5. Conteúdos da Comunidade e Privacidade</h2>
      <p>
        <strong>5.1.</strong> O Brasa Swing permite conteúdos de uma comunidade adulta 18+ apenas quando respeitam consentimento, privacidade, estes Termos e as Diretrizes da Comunidade. Em áreas públicas, não é permitido publicar conteúdo íntimo/sexual explícito, pornográfico ou ilegal. Em interações privadas, continuam obrigatórios consentimento, maioridade, privacidade, autorização das pessoas retratadas e cumprimento da lei.
      </p>
      <p>
        <strong>5.2.</strong> Conteúdos enviados em chats, perfis ou publicações podem ser armazenados para fins de funcionamento do serviço, moderação e investigação de denúncias, e cumprimento de ordens legais.
      </p>
      <p>
        <strong>5.3.</strong> O Brasa Swing não compartilha conteúdos privados com terceiros, salvo por obrigação legal, ordem judicial, segurança da comunidade ou investigação de denúncias nos limites permitidos pela lei.
      </p>
      <p>
        <strong>5.4.</strong> Para moderação, segurança e cumprimento dos Termos, mídias públicas, fotos de perfil, thumbnails de vídeo e outros sinais relacionados ao conteúdo podem ser processados por filtros, revisão administrativa e ferramentas automatizadas ou assistidas por IA. Esse tratamento é limitado às finalidades de classificação, ocultação contextual, investigação de denúncias, prevenção de abuso e proteção da comunidade.
      </p>

      <h2>6. Cookies e Tecnologias de Rastreamento</h2>
      <p><strong>6.1.</strong> O Brasa Swing utiliza cookies e tecnologias similares para:</p>
      <ul>
        <li><strong>Cookies essenciais:</strong> autenticação, sessão do usuário, preferências de segurança</li>
        <li><strong>Cookies de funcionalidade:</strong> preferências de idioma e configurações</li>
        <li><strong>Cookies analíticos:</strong> métricas e estatísticas somente quando habilitados</li>
        <li><strong>LocalStorage/SessionStorage:</strong> cache de dados para melhor performance</li>
      </ul>
      <p>
        <strong>6.2.</strong> O usuário pode gerenciar cookies através das configurações do navegador. A desativação de cookies essenciais pode afetar o funcionamento do serviço.
      </p>

      <h2>7. Notificações Push</h2>
      <ul>
        <li><strong>7.1.</strong> O Brasa Swing pode enviar notificações push mediante autorização do usuário.</li>
        <li><strong>7.2.</strong> Para isso, coletamos e armazenamos tokens de dispositivo que identificam seu aparelho para entrega das notificações.</li>
        <li><strong>7.3.</strong> As notificações podem incluir: mensagens recebidas, curtidas, comentários e comunicações do serviço.</li>
        <li><strong>7.4.</strong> O usuário pode desativar notificações a qualquer momento nas configurações do dispositivo ou do navegador.</li>
      </ul>

      <h2>8. Compartilhamento de Dados</h2>
      <p>O Brasa Swing <strong>não vende dados pessoais</strong>.</p>
      <p>O compartilhamento poderá ocorrer apenas:</p>
      <ul>
        <li>com provedores de serviços essenciais (ex: hospedagem, análises);</li>
        <li>para cumprimento de obrigações legais;</li>
        <li>mediante ordem judicial ou requisição de autoridade competente;</li>
        <li>em caso de fusão, aquisição ou venda de ativos (com aviso prévio).</li>
      </ul>

      <h3>8.1. Parceiros e Provedores</h3>
      <ul>
        <li><strong>Flask + PostgreSQL:</strong> Hospedagem do backend, autenticação e banco de dados</li>
        <li><strong>Cloudflare:</strong> CDN e segurança de rede</li>
      </ul>

      <h2>9. Transferência Internacional de Dados</h2>
      <ul>
        <li><strong>9.1.</strong> Alguns de nossos provedores de serviço podem processar dados em servidores localizados fora do Brasil.</li>
        <li>
          <strong>9.2.</strong> Nesses casos, garantimos que a transferência ocorre apenas para países com nível adequado de proteção de dados ou mediante cláusulas contratuais padrão que assegurem a proteção dos seus dados conforme a LGPD.
        </li>
      </ul>

      <h2>10. Armazenamento e Segurança</h2>
      <ul>
        <li>
          <strong>10.1.</strong> O Brasa Swing adota medidas técnicas e administrativas para proteger os dados contra acessos não autorizados, vazamentos ou usos indevidos.
        </li>
        <li>
          <strong>10.2.</strong> Medidas de segurança incluem: criptografia de dados em trânsito (HTTPS), hashing de senhas, controle de acesso, monitoramento de atividades suspeitas e backups regulares.
        </li>
        <li><strong>10.3.</strong> Os dados são armazenados apenas pelo tempo necessário para cumprir as finalidades descritas.</li>
        <li><strong>10.4.</strong> Registros de segurança são mantidos para detecção e investigação de atividades maliciosas.</li>
      </ul>

      <h2>11. Tempo de Retenção dos Dados</h2>
      <table>
        <thead>
          <tr>
            <th>Tipo de Dado</th>
            <th>Período de Retenção</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Dados de conta (perfil, preferências)</td>
            <td>Enquanto a conta estiver ativa</td>
          </tr>
          <tr>
            <td>Mensagens e conversas</td>
            <td>Enquanto a conta estiver ativa</td>
          </tr>
          <tr>
            <td>Registros de acesso (IP, logs)</td>
            <td>6 meses (Marco Civil da Internet)</td>
          </tr>
          <tr>
            <td>Dados após exclusão de conta</td>
            <td>Até 30 dias (backup), logs por 6 meses</td>
          </tr>
          <tr>
            <td>Denúncias e moderação</td>
            <td>2 anos após resolução</td>
          </tr>
        </tbody>
      </table>

      <h2>12. Direitos do Titular dos Dados</h2>
      <p>Nos termos da LGPD, o usuário pode solicitar:</p>
      <ul>
        <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e obter cópia;</li>
        <li><strong>Correção:</strong> atualizar dados incompletos ou desatualizados;</li>
        <li><strong>Anonimização ou bloqueio:</strong> de dados desnecessários ou tratados em desconformidade;</li>
        <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado;</li>
        <li><strong>Eliminação:</strong> exclusão de dados, quando legalmente possível;</li>
        <li><strong>Informação sobre compartilhamento:</strong> saber com quem seus dados foram compartilhados;</li>
        <li><strong>Revogação do consentimento:</strong> retirar consentimento a qualquer momento.</li>
      </ul>
      <p>
        Solicitações podem ser feitas pelo e-mail <strong>suporte@brasaswing.com.br</strong>. Responderemos em até 15 dias.
      </p>

      <h2>13. Conta, Exclusão e Retenção</h2>
      <ul>
        <li><strong>13.1.</strong> O usuário pode solicitar a exclusão da conta a qualquer momento através das configurações do aplicativo.</li>
        <li><strong>13.2.</strong> Ao excluir a conta, seus dados pessoais serão removidos em até 30 dias.</li>
        <li><strong>13.3.</strong> Alguns dados poderão ser mantidos para cumprimento de obrigações legais (registros de acesso por 6 meses) ou prevenção de fraudes.</li>
        <li><strong>13.4.</strong> Conteúdos já compartilhados com outros usuários (mensagens enviadas) não serão excluídos das contas dos destinatários.</li>
      </ul>

      <h2>14. Proibição para Menores</h2>
      <ul>
        <li><strong>14.1.</strong> O Brasa Swing não coleta intencionalmente dados de menores de 18 anos.</li>
        <li><strong>14.2.</strong> Caso seja identificado uso indevido por menor, a conta será imediatamente encerrada e todos os dados serão excluídos.</li>
        <li>
          <strong>14.3.</strong> Se você é pai ou responsável e acredita que seu filho forneceu dados ao Brasa Swing, entre em contato imediatamente através de suporte@brasaswing.com.br.
        </li>
        <li>
          <strong>14.4.</strong> O Brasa Swing adota padrão de tolerância zero para exploração e abuso sexual infantil (CSAE) e material de abuso sexual infantil (CSAM).
        </li>
        <li><strong>14.5.</strong> O aplicativo disponibiliza mecanismo in-app de feedback e denúncia (botões de denúncia de perfis e posts), além do canal de suporte.</li>
        <li>
          <strong>14.6.</strong> Ao receber denúncia ou identificar potencial CSAM, o Brasa Swing poderá remover conteúdo, restringir contas, preservar registros necessários para investigação e cooperar com autoridades competentes.
        </li>
      </ul>

      <h2>15. Incidentes de Segurança</h2>
      <p>
        <strong>15.1.</strong> Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, o Brasa Swing comunicará:
      </p>
      <ul>
        <li>A Autoridade Nacional de Proteção de Dados (ANPD);</li>
        <li>Os titulares afetados, quando aplicável.</li>
      </ul>
      <p>
        <strong>15.2.</strong> A comunicação incluirá a descrição da natureza dos dados afetados, informações sobre os titulares envolvidos, medidas técnicas e de segurança utilizadas, riscos relacionados ao incidente e medidas que foram ou serão adotadas.
      </p>

      <h2>16. Alterações desta Política</h2>
      <ul>
        <li><strong>16.1.</strong> Esta Política de Privacidade poderá ser atualizada a qualquer momento.</li>
        <li><strong>16.2.</strong> A versão vigente estará sempre disponível no aplicativo com a data da última atualização.</li>
        <li><strong>16.3.</strong> Alterações significativas serão comunicadas através do aplicativo ou por e-mail.</li>
      </ul>

      <h2>17. Legislação e Foro</h2>
      <p>
        Esta Política é regida pelas leis da República Federativa do Brasil, em especial a Lei nº 13.709/2018 (LGPD) e a Lei nº 12.965/2014 (Marco Civil da Internet), ficando eleito o foro da comarca da capital do estado de São Paulo – SP, com renúncia a qualquer outro.
      </p>

      <h2>18. Contato</h2>
      <p>Para dúvidas, solicitações ou reclamações relacionadas a esta Política de Privacidade:</p>
      <ul>
        <li><strong>E-mail do Encarregado (DPO):</strong> suporte@brasaswing.com.br</li>
        <li><strong>Contato de Segurança Infantil (Child Safety):</strong> suporte@brasaswing.com.br</li>
        <li><strong>Suporte geral:</strong> Através do aplicativo (Menu → Ajuda)</li>
        <li><strong>ANPD:</strong> Em caso de não resolução, você pode contatar a Autoridade Nacional de Proteção de Dados em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a></li>
      </ul>
    </LegalLayout>
  );
}
