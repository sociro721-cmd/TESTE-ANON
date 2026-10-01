import React, { useEffect } from 'react';
import {
  ArrowLeft,
  Shield,
  FileText,
  Lock,
  HelpCircle,
  AlertTriangle,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Users,
  QrCode,
  Info,
  Clock,
  Sparkles,
  ShoppingBag,
  Scale,
  BookOpen,
} from 'lucide-react';
import { WHATSAPP_SUPPORT_URL } from '../types';

interface InstitutionalPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenBuyRoom?: () => void;
}

export const InstitutionalPage: React.FC<InstitutionalPageProps> = ({
  currentPath,
  onNavigate,
  onOpenBuyRoom,
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPath]);

  // Determine active route key
  const activeRoute = currentPath.replace(/\/+$/, '') || '/quem-somos';

  const NAV_LINKS = [
    { path: '/quem-somos', label: 'Quem Somos', icon: Info },
    { path: '/como-funciona', label: 'Como Funciona', icon: QrCode },
    { path: '/termos', label: 'Termos de Uso', icon: FileText },
    { path: '/privacidade', label: 'Privacidade', icon: Lock },
    { path: '/regras', label: 'Regras & Diretrizes', icon: Shield },
    { path: '/suporte', label: 'Suporte', icon: HelpCircle },
    { path: '/denunciar', label: 'Denunciar', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Breadcrumb & Quick Nav */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
            aria-label="Voltar para a página inicial"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar ao Início</span>
          </button>

          {/* Horizontal scrollable nav for quick switching between institutional pages */}
          <nav className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-[70vw] sm:max-w-none scrollbar-thin">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = activeRoute === link.path;
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => onNavigate(link.path)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 flex-1 w-full">
        {/* ===================== QUEM SOMOS ===================== */}
        {activeRoute === '/quem-somos' && (
          <article className="space-y-8 animate-in fade-in duration-150">
            <header className="space-y-3 pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Info className="h-3.5 w-3.5" />
                Institucional
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Quem Somos
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Conheça a proposta, os princípios e o funcionamento do AnônQr.
              </p>
            </header>

            <section className="space-y-4 text-slate-300 text-sm leading-relaxed">
              <p>
                O <strong>AnônQr</strong> é uma plataforma de comunicação digital voltada à criação, disponibilização e utilização de salas de conversa temáticas e privativas.
              </p>
              <p>
                Nossa proposta central é oferecer uma experiência simples, moderna e prática de comunicação, com ênfase no controle de acesso, privacidade e usabilidade sem fricções desnecessárias.
              </p>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Users className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-white">Salas Privadas e Abertas</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Oferecemos tanto espaços abertos para interação comunitária quanto salas privativas fechadas, acessíveis exclusivamente através de links diretos, senhas ou QR Codes.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <QrCode className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-white">Acesso Prático e Direto</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Acesso rápido por meio de links exclusivos, códigos de entrada ou leitura de QR Code diretamente pelo celular ou navegador, sem necessidade de baixar aplicativos externos.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-white">Ciclos Temporizados</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Salas com duração pré-determinada, cujo histórico é descartado ao término da sessão contratada, promovendo higiene de dados e foco na conversa presente.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Shield className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-white">Compromisso com a Verdade</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Não prometemos anonimato absoluto, segurança incondicional ou impossibilidade de identificação. Agimos com transparência e em estrito cumprimento às normas legais vigentes.
                </p>
              </div>
            </section>

            <section className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-xs text-slate-400 space-y-2">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-emerald-400" />
                Princípios de Operação
              </h3>
              <p>
                O AnônQr não estimula, não compactua e não tolera a prática de atos ilícitos. A liberdade de comunicação deve coexistir com o respeito aos direitos de terceiros e à legislação brasileira.
              </p>
            </section>
          </article>
        )}

        {/* ===================== COMO FUNCIONA ===================== */}
        {activeRoute === '/como-funciona' && (
          <article className="space-y-8 animate-in fade-in duration-150">
            <header className="space-y-3 pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <QrCode className="h-3.5 w-3.5" />
                Guia Passo a Passo
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Como Funciona o AnônQr
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Entenda o fluxo completo de utilização, desde o acesso até o encerramento das salas.
              </p>
            </header>

            <div className="space-y-4">
              {[
                {
                  step: '01',
                  title: 'Acesse a Plataforma',
                  desc: 'Você pode acessar o AnônQr através de qualquer navegador moderno, seja em computador ou smartphone Android e iPhone.',
                },
                {
                  step: '02',
                  title: 'Busca e Localização',
                  desc: 'Utilize a barra de pesquisa do Hero para encontrar uma sala específica via link, código ID ou buscar perfis de usuários cadastrados através do @nick.',
                },
                {
                  step: '03',
                  title: 'Entrada na Sala',
                  desc: 'A entrada pode ser realizada clicando no link direto de convite, digitando a senha da sala ou apontando a câmera do celular para o QR Code gerado.',
                },
                {
                  step: '04',
                  title: 'Aquisição de Salas Privadas',
                  desc: 'Salas com capacidade para até 10 pessoas ou salas duplas podem ser adquiridas individualmente através da vitrine da plataforma, com pagamento via PIX.',
                },
                {
                  step: '05',
                  title: 'Contagem Regressiva e Duração',
                  desc: 'Salas temporárias contam com duração determinada (ex: 1 hora, 2 horas, 24 horas). O tempo é validado continuamente pelo servidor após a ativação.',
                },
                {
                  step: '06',
                  title: 'Acesso e Permanência Responsável',
                  desc: 'A permanência nas salas depende do cumprimento das regras de convivência da sala e dos Termos de Uso do AnônQr.',
                },
                {
                  step: '07',
                  title: 'Identidade e Perfil',
                  desc: 'Você pode participar de forma anônima com pseudônimo gerado aleatoriamente, ou criar uma conta no Supabase para ter Nick exclusivo e foto de perfil.',
                },
                {
                  step: '08',
                  title: 'Mecanismos de Suporte e Denúncia',
                  desc: 'Caso identifique qualquer comportamento inadequado ou enfrente problemas técnicos com salas, utilize nossa Central de Suporte e o canal de Denúncia.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 transition-colors"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 font-mono font-bold text-sm border border-emerald-500/20">
                    {item.step}
                  </span>
                  <div className="space-y-1">
                    <h2 className="text-sm sm:text-base font-bold text-white">{item.title}</h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {onOpenBuyRoom && (
              <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-base font-bold text-white">Pronto para criar sua própria sala?</h3>
                  <p className="text-xs text-slate-400">Escolha o plano ideal e converse com privacidade imediata.</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenBuyRoom}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition-all cursor-pointer shrink-0"
                >
                  Ver Salas Disponíveis
                </button>
              </div>
            )}
          </article>
        )}

        {/* ===================== TERMOS DE USO ===================== */}
        {activeRoute === '/termos' && (
          <article className="space-y-8 animate-in fade-in duration-150">
            <header className="space-y-3 pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5" />
                Documento Legal
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Termos de Uso
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Última atualização: Setembro de 2026. Aplicável a todos os usuários da plataforma AnônQr.
              </p>
            </header>

            <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">1. Aceitação dos Termos</h2>
                <p>
                  Ao acessar ou utilizar a plataforma AnônQr, seus sites, recursos de comunicação, salas de bate-papo e serviços correlatos, você declara ter lido, compreendido e concordado integralmente com estes Termos de Uso e com a nossa Política de Privacidade. Caso não concorde com qualquer disposição aqui contida, você deve interromper imediatamente o uso da plataforma.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">2. Objeto e Natureza do Serviço</h2>
                <p>
                  O AnônQr disponibiliza ferramentas tecnológicas para a criação, gerenciamento e participação em salas de conversação digital em tempo real. O serviço destina-se a comunicações pessoais, colaborativas e temáticas, sujeitas às limitações técnicas e operacionais da infraestrutura disponível.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">3. Responsabilidade do Usuário</h2>
                <p>
                  O usuário é exclusiva e integralmente responsável por:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Todas as mensagens, textos, imagens, vídeos, arquivos e conteúdos que enviar ou transmitir nas salas;</li>
                  <li>A veracidade das informações fornecidas no cadastro (nome, e-mail e Nick);</li>
                  <li>A guarda e o sigilo de seus links de acesso, códigos de sala e senhas privativas;</li>
                  <li>Qualquer atividade realizada sob sua conta ou identidade de acesso.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white text-rose-300">4. Condutas e Conteúdos Estritamente Proibidos</h2>
                <p>
                  É expressamente vedado utilizar o AnônQr para qualquer finalidade ilícita, imoral ou que viole direitos de terceiros. Sem prejuízo de outras proibições legais, é terminantemente proibido veicular, produzir ou compartilhar:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  <li>Conteúdo que envolva pornografia infantil, exploração, abuso sexual de menores ou qualquer ato análogo (CSAM);</li>
                  <li>Ameaças de morte, agressão física, apologia ao suicídio, autoflagelação ou violência ilícita;</li>
                  <li>Práticas fraudulentas, golpes financeiros, pirâmides, esquemas de extorsão ou phishing;</li>
                  <li>Disseminação de códigos maliciosos, vírus, invasão de sistemas ou tentativas de comprometer a segurança da infraestrutura;</li>
                  <li>Divulgação não autorizada de dados pessoais de terceiros (como CPF, endereço residencial, telefone, dados bancários ou doxxing);</li>
                  <li>Assédio moral, perseguição (stalking), difamação, injúria e racismo nos termos da legislação penal brasileira;</li>
                  <li>Falsa identidade (impersonificação) visando lesar terceiros ou cometer fraudes.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">5. Moderação, Suspensão e Encerramento</h2>
                <p>
                  O AnônQr reserva-se o direito de, a seu exclusivo critério ou mediante denúncia fundamentada, remover conteúdos, suspender sessões, encerrar salas privativas ou bloquear contas de usuários que descumpram estes Termos, sem prejuízo da adoção das medidas cíveis e criminais cabíveis e da colaboração com as autoridades públicas competentes.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">6. Compras, Pagamentos e Salas Privadas</h2>
                <p>
                  A aquisição de salas privativas temporárias ou permanentes segue as condições e valores estipulados no momento da contratação. A liberação do acesso ocorre após a devida comprovação ou aprovação do pagamento pelo sistema.
                </p>
                <p>
                  Nas salas temporizadas, a contagem de tempo ocorre de forma contínua a partir do primeiro acesso válido do usuário. Encerrado o prazo contratado, a sala é finalizada e os dados de mensagens associados são descartados.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">7. Limitações de Responsabilidade e Disponibilidade Técnica</h2>
                <p>
                  O serviço é fornecido "no estado em que se encontra" ("as is"), podendo passar por manutenções periódicas, instabilidades temporárias de conexão ou atualizações. O AnônQr não se responsabiliza por perdas, lucros cessantes ou danos indiretos decorrentes de instabilidades na internet, falhas de telecomunicações de terceiros ou mau uso por parte dos participantes.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">8. Propriedade Intelectual</h2>
                <p>
                  A marca AnônQr, logotipos, códigos-fonte, arquitetura de software, design e elementos visuais pertencem exclusivamente aos desenvolvedores e detentores do projeto, sendo vedada a reprodução ou engenharia reversa sem autorização expressa.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">9. Canal de Atendimento e Alterações</h2>
                <p>
                  Estes Termos podem ser atualizados a qualquer tempo para refletir melhorias do sistema ou exigências regulatórias. Dúvidas sobre estes Termos de Uso devem ser encaminhadas ao canal oficial de suporte via WhatsApp oficial.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">10. Lei Aplicável e Foro</h2>
                <p>
                  Estes Termos são regidos e interpretados de acordo com a legislação da República Federativa do Brasil, em conformidade com a Lei nº 12.965/2014 (Marco Civil da Internet), a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD) e demais normas aplicáveis.
                </p>
              </section>
            </div>
          </article>
        )}

        {/* ===================== POLÍTICA DE PRIVACIDADE ===================== */}
        {activeRoute === '/privacidade' && (
          <article className="space-y-8 animate-in fade-in duration-150">
            <header className="space-y-3 pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Lock className="h-3.5 w-3.5" />
                LGPD (Lei nº 13.709/2018)
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Política de Privacidade
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Informações claras sobre o tratamento de dados pessoais na plataforma AnônQr.
              </p>
            </header>

            <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">1. Visão Geral e Princípios</h2>
                <p>
                  Esta Política de Privacidade descreve como o AnônQr trata os dados pessoais dos usuários em estrita observância à Lei Geral de Proteção de Dados Pessoais (LGPD - Lei Federal nº 13.709/2018). Coletamos e processamos apenas as informações estritamente necessárias para a prestação dos serviços de comunicação digital.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">2. Dados Pessoais Tratados</h2>
                <p>
                  Dependendo de como você interage com o AnônQr, os seguintes dados podem ser tratados:
                </p>
                <div className="space-y-2 pt-1">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <strong className="text-white block text-xs">A. Dados de Usuários Anônimos (Sem Cadastro)</strong>
                    <span className="text-xs text-slate-400">
                      Pseudônimo temporário atribuído localmente pelo navegador, identificador de sessão em memória e dados de conexão técnica temporária.
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <strong className="text-white block text-xs">B. Dados de Usuários Autenticados (Supabase)</strong>
                    <span className="text-xs text-slate-400">
                      Nome informado, endereço de e-mail cadastrado, @Nick público escolhido e URL de foto de perfil (quando enviada voluntariamente).
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <strong className="text-white block text-xs">C. Dados Técnicos e de Navegação</strong>
                    <span className="text-xs text-slate-400">
                      Endereço IP e registros de data/hora de acesso (registros de conexão exigidos pelo Art. 15 da Lei nº 12.965/2014 - Marco Civil da Internet), informações sobre dispositivo e navegador para segurança contra ataques de negação de serviço (DDoS) e abuso.
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <strong className="text-white block text-xs">D. Informações de Pagamentos e Compras</strong>
                    <span className="text-xs text-slate-400">
                      Identificador de transação PIX ou Mercado Pago, valor contratado, status da compra e data de solicitação para validação de ciclo da sala. O AnônQr não armazena números completos de cartão de crédito.
                    </span>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">3. Finalidades e Bases Legais do Tratamento</h2>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li><strong>Execução de Contrato (Art. 7º, V da LGPD):</strong> Viabilizar a criação de salas, autenticação de sessões, troca de mensagens em tempo real e entrega do serviço contratado;</li>
                  <li><strong>Cumprimento de Obrigação Legal (Art. 7º, II da LGPD):</strong> Guarda obrigatória de registros de acesso a aplicações de internet pelo prazo legal estipulado no Marco Civil da Internet;</li>
                  <li><strong>Legítimo Interesse e Segurança (Art. 7º, IX da LGPD):</strong> Prevenção a fraudes, proteção contra invasões cibernéticas e garantia de estabilidade do ambiente para todos os usuários.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">4. Ciclo de Vida e Retenção de Dados</h2>
                <p>
                  As salas privativas temporárias possuem ciclo de vida restrito: assim que o cronômetro da sala atinge zero, a sessão é encerrada pelo servidor e o histórico de mensagens daquela sala é excluído da memória ativa. Dados cadastrais de contas permanecem armazenados enquanto a conta estiver ativa ou até solicitação de exclusão pelo titular.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">5. Compartilhamento de Dados</h2>
                <p>
                  O AnônQr não comercializa nem compartilha dados pessoais para fins publicitários de terceiros. O compartilhamento ocorre exclusivamente com:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Provedores de infraestrutura e hospedagem essenciais (como Supabase para banco de dados e autenticação);</li>
                  <li>Intermediadores de pagamento para processamento de transações autorizadas pelo usuário;</li>
                  <li>Autoridades policiais ou judiciais mediante ordem judicial formal emitida por autoridade judiciária competente.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">6. Direitos do Titular de Dados</h2>
                <p>
                  Em conformidade com o Art. 18 da LGPD, o titular de dados pessoais possui os seguintes direitos:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Confirmação da existência de tratamento e acesso aos dados;</li>
                  <li>Correção de dados incompletos, inexatos ou desatualizados (disponível no perfil do usuário);</li>
                  <li>Eliminação dos dados pessoais tratados com consentimento (disponível na função "Excluir minha conta" no modal de autenticação);</li>
                  <li>Informações sobre as entidades públicas e privadas com as quais o controlador compartilhou dados;</li>
                  <li>Revogação do consentimento.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">7. Cookies e Armazenamento Local</h2>
                <p>
                  Utilizamos armazenamento local (`localStorage`) no navegador para guardar a identidade anônima temporária do usuário e tokens de sessão técnica. Não utilizamos cookies invasivos de rastreamento entre sites (cross-site tracking).
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-bold text-white">8. Contato do Encarregado pelo Tratamento de Dados (DPO)</h2>
                <p>
                  Para exercer seus direitos de privacidade ou esclarecer dúvidas sobre esta Política, entre em contato através do canal oficial de suporte:
                </p>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <p><strong className="text-white">Responsável pelo Atendimento de Privacidade:</strong> [informação a preencher]</p>
                  <p><strong className="text-white">Canal Institucional de Atendimento:</strong> [informação a preencher - contato@anonqr.com]</p>
                  <p><strong className="text-white">Atendimento Imediato via WhatsApp:</strong> Suporte Oficial AnônQr</p>
                </div>
              </section>
            </div>
          </article>
        )}

        {/* ===================== REGRAS & DIRETRIZES ===================== */}
        {activeRoute === '/regras' && (
          <article className="space-y-8 animate-in fade-in duration-150">
            <header className="space-y-3 pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <Shield className="h-3.5 w-3.5" />
                Convivência e Integridade
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Política de Conteúdo & Diretrizes da Comunidade
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Regras claras sobre o que é permitido e o que é terminantemente proibido nas salas do AnônQr.
              </p>
            </header>

            {/* Seção 1: Política de Conteúdo */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                Política de Conteúdo Proibido
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                O AnônQr foi criado para proporcionar diálogos construtivos, dinâmicos e privados. Para preservar a segurança de todos os usuários e cumprir a legislação, os seguintes conteúdos são estritamente vedados em qualquer sala (pública ou privada):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
                  <strong className="text-rose-300 font-bold block">1. Abuso e Exploração Infantil (Tolerância Zero)</strong>
                  <p className="text-slate-400">Qualquer material, alusão ou facilitação de exploração sexual de menores resulta em banimento imediato e notificação às autoridades policiais.</p>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
                  <strong className="text-rose-300 font-bold block">2. Violência e Ameaças Ilícitas</strong>
                  <p className="text-slate-400">Incentivo ao cometimento de crimes, ameaças de agressão física, terrorismo, apologia a homicídio ou autoflagelação.</p>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
                  <strong className="text-rose-300 font-bold block">3. Fraudes, Golpes e Phishing</strong>
                  <p className="text-slate-400">Tentativas de clonagem de contas, envio de links maliciosos, esquemas de pirâmide financeira e extorsão de participantes.</p>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
                  <strong className="text-rose-300 font-bold block">4. Exposição de Dados Pessoais (Doxxing)</strong>
                  <p className="text-slate-400">Compartilhar dados privados de terceiros (endereços residenciais, CPFs, números de telefone pessoais) sem autorização.</p>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
                  <strong className="text-rose-300 font-bold block">5. Assédio e Perseguição (Stalking)</strong>
                  <p className="text-slate-400">Comportamentos obsessivos, perseguição sistemática, intimidação verbal e discurso de ódio contra grupos protegidos por lei.</p>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
                  <strong className="text-rose-300 font-bold block">6. Comprometimento Técnico</strong>
                  <p className="text-slate-400">Ataques automatizados de spam, bots abusivos, sobrecarga de servidores ou exploração deliberada de vulnerabilidades.</p>
                </div>
              </div>
            </section>

            {/* Seção 2: Diretrizes da Comunidade */}
            <section className="space-y-4 pt-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <BookOpen className="h-5 w-5 text-emerald-400" />
                Diretrizes da Comunidade
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Para manter uma experiência agradável e segura para todos os participantes, incentivamos as seguintes práticas de convivência:
              </p>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Respeite a privacidade alheia:</strong>
                    <p className="text-slate-400 text-xs mt-0.5">O que é compartilhado em uma sala privativa não deve ser divulgado fora dela sem a concordância de todos os participantes.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Compartilhe links com responsabilidade:</strong>
                    <p className="text-slate-400 text-xs mt-0.5">Envie o link e a senha da sua sala apenas para as pessoas que você realmente deseja convidar.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Denuncie violações imediatamente:</strong>
                    <p className="text-slate-400 text-xs mt-0.5">Se presenciar comportamentos abusivos ou ilegais, utilize nosso canal de denúncia para que a equipe técnica possa agir.</p>
                  </div>
                </div>
              </div>
            </section>
          </article>
        )}

        {/* ===================== CENTRAL DE SUPORTE ===================== */}
        {activeRoute === '/suporte' && (
          <article className="space-y-8 animate-in fade-in duration-150">
            <header className="space-y-3 pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <HelpCircle className="h-3.5 w-3.5" />
                Atendimento Oficial
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Central de Suporte AnônQr
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Estamos prontos para ajudar com dúvidas, acessos, pagamentos e salas.
              </p>
            </header>

            {/* Categorias Comuns de Dúvidas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <QrCode className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-white">Problemas de Acesso</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dificuldades para entrar na sala via link, código ou QR Code? Verifique se a sala ainda está ativa ou se o tempo contratado expirou.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-white">Compras e Pagamento PIX</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Realizou o pagamento via PIX e precisa agilizar a liberação? Envie o comprovante pelo WhatsApp com o identificador da sala contratada.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-white">Duração e Timers das Salas</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O tempo de salas privativas é validado continuamente pelo servidor a partir do primeiro acesso. Quando zera, a sessão é finalizada com segurança.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Users className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-white">Conta, Nick e Foto</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dúvidas sobre o cadastro no Supabase, confirmação de e-mail, alteração de Nick público ou exclusão de conta? Fale conosco.
                </p>
              </div>
            </div>

            {/* Official WhatsApp Support CTA */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-emerald-500/40 text-center space-y-4 shadow-xl shadow-emerald-950/20">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="text-lg sm:text-xl font-bold text-white">Falar com o Suporte Oficial</h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Nosso atendimento é realizado através do canal oficial no WhatsApp para resolução rápida de dúvidas e verificação de pedidos.
                </p>
              </div>

              <a
                href={WHATSAPP_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-950/60 transition-all active:scale-95 cursor-pointer min-h-[44px]"
                aria-label="Abrir atendimento de suporte no WhatsApp oficial"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Iniciar Conversa no WhatsApp Oficial</span>
                <ExternalLink className="h-4 w-4 opacity-80 ml-1" />
              </a>
            </div>
          </article>
        )}

        {/* ===================== DENUNCIAR CONTEÚDO ===================== */}
        {activeRoute === '/denunciar' && (
          <article className="space-y-8 animate-in fade-in duration-150">
            <header className="space-y-3 pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5" />
                Segurança e Integridade
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Canal de Denúncias
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Como denunciar conteúdos ilícitos, abusos ou comportamentos que violem nossas regras.
              </p>
            </header>

            <div className="space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                O AnônQr repudia com veemência qualquer utilização da plataforma para finalidades ilícitas, abusivas ou lesivas a terceiros. Se você presenciou ou foi vítima de qualquer conduta inadequada em uma sala, siga as orientações abaixo para registrar sua denúncia formal.
              </p>

              <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-3">
                <h2 className="text-sm font-bold text-rose-300">O que deve ser denunciado:</h2>
                <ul className="list-disc pl-5 space-y-1 text-slate-300 text-xs">
                  <li>Conteúdo que envolva pornografia infantil ou abuso sexual de menores;</li>
                  <li>Ameaças contra a vida, apologia a crimes ou incitação à violência;</li>
                  <li>Golpes, tentativas de estelionato ou distribuição de links maliciosos;</li>
                  <li>Exposição não autorizada de dados pessoais (doxxing, vazamento de documentos);</li>
                  <li>Assédio persistente, perseguição e injúrias gravosas.</li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h2 className="text-sm font-bold text-white">Informações úteis para agilizar a apuração:</h2>
                <p className="text-xs text-slate-400">
                  Ao entrar em contato pelo canal de suporte, informe o máximo de detalhes disponíveis:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400 text-xs">
                  <li>O link da sala ou o ID da sala onde ocorreu o incidente;</li>
                  <li>O pseudônimo ou Nick da pessoa envolvida;</li>
                  <li>A data e o horário aproximado do fato;</li>
                  <li>Capturas de tela (prints) claras do conteúdo denunciado, quando possível.</li>
                </ul>
              </div>

              {/* Botão de Envio para o WhatsApp Oficial */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-rose-500/40 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Enviar Denúncia ao Suporte</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Nossa equipe técnica analisa relatórios de abuso para adoção das providências cabíveis, incluindo bloqueio de salas e contas.
                  </p>
                </div>

                <a
                  href={WHATSAPP_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 transition-all cursor-pointer min-h-[44px]"
                  aria-label="Encaminhar denúncia pelo WhatsApp oficial"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Encaminhar Denúncia via WhatsApp Oficial</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-80 ml-1" />
                </a>
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
};
