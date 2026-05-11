import { Header } from "@/components/Header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield } from "lucide-react";

const TermsAndPrivacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container pt-10 md:pt-14 pb-6 md:pb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
              Termos e privacidade
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight max-w-3xl">
            Transparência sobre seus <span className="text-primary">dados</span> e nosso serviço
          </h1>
          <p className="text-lg text-muted-foreground mt-4 max-w-3xl">
            Saiba como processamos informações, quais regras aplicamos e seus direitos como usuário.
          </p>
        </div>
      </section>

      <div className="container pt-4 pb-8">
        <div className="space-y-8">

          {/* Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
              
              <section className="space-y-4">
                <h2 className="text-2xl font-bold">1. Introdução</h2>
                <p>
                  Bem-vindo ao "Tá Certo Isso?". Este documento estabelece os termos de uso e a política de privacidade para a utilização do nosso serviço de verificação de fatos via WhatsApp e nossa plataforma de analytics. Ao utilizar nossos serviços, você concorda com as práticas descritas aqui.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold">2. Fluxo de Processamento de Mensagens</h2>
                <p>
                  Para o funcionamento técnico do serviço, utilizamos uma infraestrutura que integra o WhatsApp com nossos sistemas de análise. É importante que você entenda como as mensagens trafegam:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Infraestrutura Técnica:</strong> Todas as mensagens enviadas nos grupos onde o nosso bot está presente são tecnicamente processadas pela <em>Evolution API</em> e encaminhadas para o sistema de automação <em>n8n</em>. Isso é necessário para que o sistema possa "ler" e identificar quando ele está sendo acionado.
                  </li>
                  <li>
                    <strong>Filtragem de Privacidade:</strong> Embora todas as mensagens passem por esse fluxo técnico inicial, <strong>nós descartamos imediatamente</strong> qualquer mensagem que não seja direcionada ao bot.
                  </li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold">3. Armazenamento e Análise de Dados (IA)</h2>
                <div className="bg-muted/50 p-4 rounded-md border-l-4 border-primary">
                  <p className="font-medium">
                    Apenas mensagens explicitamente direcionadas ao bot são armazenadas e analisadas pela Inteligência Artificial.
                  </p>
                </div>
                <p>
                  O processamento por IA e o armazenamento em nosso banco de dados ocorrem <strong>exclusivamente</strong> nas seguintes situações:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Quando você envia uma mensagem diretamente para o número do bot (conversa privada/DM).</li>
                  <li>Quando você menciona o bot (ex: <code>@nomedobot</code>) em um grupo.</li>
                  <li>Quando você responde a uma mensagem do bot na conversa privada com ele/DM.</li>
                </ul>
                <p>
                  Nestas situações, entendemos que você está solicitando ativamente o nosso serviço de verificação.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold">4. Exibição Pública de Dados</h2>
                <p>
                  Ao solicitar uma verificação (interagindo com o bot conforme descrito na seção 3), você concorda que o conteúdo da sua solicitação poderá ser tornado <strong>público</strong> em nosso site de analytics.
                </p>
                <p>
                  As informações que podem ser armazenadas e exibidas publicamente incluem:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>O texto original da sua mensagem ou encaminhamento.</li>
                  <li>Descrições geradas por IA de imagens enviadas.</li>
                  <li>Descrições geradas por IA de vídeos enviados.</li>
                  <li>Transcrições de áudios enviados.</li>
                  <li>O resultado da verificação (Veredito) gerado pela nossa IA.</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Nota:</strong> Não exibimos publicamente seu número de telefone ou nome pessoal no painel de analytics, focando apenas no conteúdo da notícia/informação verificada.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold">5. Responsabilidade do Usuário</h2>
                <p>
                  O usuário é o único responsável pelo conteúdo que envia para análise. O serviço "Tá Certo Isso?" atua como uma ferramenta de auxílio à verificação de fatos e não deve ser utilizado para:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Enviar conteúdo ilegal, ofensivo, pornográfico ou que viole direitos autorais.</li>
                  <li>Tentar explorar vulnerabilidades do sistema.</li>
                  <li>Spam ou envio massivo de mensagens automatizadas.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold">6. Limitação de Responsabilidade</h2>
                <p>
                  Nossas análises são geradas por Inteligência Artificial e, embora nos esforcemos pela precisão, podem ocorrer erros ou "alucinações" (informações incorretas geradas pela IA). O "Tá Certo Isso?" não garante 100% de precisão nos vereditos e não se responsabiliza por decisões tomadas com base nessas informações. Recomendamos sempre verificar fontes oficiais.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold">7. Alterações nos Termos</h2>
                <p>
                  Podemos atualizar estes termos a qualquer momento. O uso contínuo do serviço após as alterações constitui aceitação dos novos termos.
                </p>
              </section>

          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndPrivacy;
